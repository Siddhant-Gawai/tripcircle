import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const catalogue = JSON.parse(
  readFileSync(new URL("../../src/catalogue.json", import.meta.url), "utf8"),
);
test.beforeEach(async ({ page }) => {
  await page.route("**/rest/v1/tripcircle_destinations?*", (r) =>
    r.fulfill({ json: catalogue }),
  );
  await page.route("**/rest/v1/rpc/tripcircle_rooms", (r) =>
    r.fulfill({ json: [] }),
  );
  await page.route("**/auth/v1/**", (r) =>
    r.fulfill({ json: { external: { google: true } } }),
  );
});
test("catalogue search returns cards without model calls and requests sign-in to save", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/functions/v1/place-search", (r) => {
    calls++;
    return r.fulfill({ status: 401, json: { message: "Sign in" } });
  });
  await page.goto("#search");
  await page
    .getByRole("button", { name: "Quiet beaches", exact: true })
    .click();
  await expect(page.locator(".search-results .card")).toHaveCount(2);
  await expect(page.locator(".search-conversation")).toContainText(
    "catalogue matches",
  );
  expect(calls).toBe(0);
  await page
    .getByRole("button", { name: "Save place", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("tripcircle-search-return"),
    ),
  ).toBe("yes");
});
test("catalogue categories match whole words and keep plural searches", async ({
  page,
}) => {
  await page.goto("#search");
  const query = page.getByRole("textbox", {
    name: "What kind of trip would you like?",
  });
  await query.fill("research Jawhar");
  await page.getByRole("button", { name: "Find places", exact: true }).click();
  await expect(page.locator(".search-results .card")).toHaveCount(1);
  await expect(page.locator(".search-results")).toContainText("Jawhar");
  await query.fill("quiet beaches");
  await page.getByRole("button", { name: "Find places", exact: true }).click();
  await expect(page.locator(".search-results .card")).toHaveCount(2);
  await expect(page.locator(".search-results")).toContainText("Bordi");
  await query.fill("beaches or hills");
  await page.getByRole("button", { name: "Find places", exact: true }).click();
  await expect(page.locator(".search-results .card")).toHaveCount(4);
  await expect(page.locator(".search-results")).toContainText("Jawhar");
  await expect(page.locator(".search-results")).toContainText("Bordi");
});

test("AI follow-ups keep context, save across reloads and add to a trip", async ({
  page,
}) => {
  const uid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    room = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  await page.addInitScript(
    ({ uid }) => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = `${btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${btoa(JSON.stringify({ sub: uid, role: "authenticated", exp }))}.test`;
      localStorage.setItem(
        "tripcircle-public-auth",
        JSON.stringify({
          access_token: token,
          refresh_token: "test",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: uid,
            aud: "authenticated",
            user_metadata: { name: "Test" },
          },
        }),
      );
    },
    { uid },
  );
  const bookmarks: string[] = [];
  let queries: unknown[] = [];
  const added: string[] = [];
  await page.route("**/rest/v1/tripcircle_saved_places*", async (r) => {
    if (r.request().method() === "POST")
      bookmarks.push(r.request().postDataJSON().destination_id);
    if (r.request().method() === "DELETE") bookmarks.splice(0);
    await r.fulfill({
      json:
        r.request().method() === "GET"
          ? bookmarks.map((destination_id) => ({ destination_id }))
          : null,
    });
  });
  await page.route("**/rest/v1/rpc/tripcircle_rooms", (r) => {
    const action = r.request().postDataJSON().p_action;
    if (action === "shortlist")
      added.push(r.request().postDataJSON().p_data.destination);
    return r.fulfill({
      json:
        action === "mine"
          ? [{ id: room, title: "Our escape", organizer: true }]
          : action === "view"
            ? {
                id: room,
                title: "Our escape",
                origin: "Ahmedabad",
                visibility: "private",
                capacity: 7,
                members: [],
                plan: { destinations: [], days: [], notes: "", checklist: [] },
              }
            : [],
    });
  });
  await page.route("**/rest/v1/rpc/tripcircle_decisions", (r) =>
    r.fulfill({ json: { choices: [], overview: {} } }),
  );
  let failSearch = false;
  await page.route("**/functions/v1/place-search", (r) => {
    queries = r.request().postDataJSON().messages;
    if (failSearch)
      return r.fulfill({
        status: 503,
        json: { message: "Search temporarily unavailable." },
      });
    return r.fulfill({
      json: {
        message:
          "Bordi fits a quiet beach trip. Confirm your budget with the host.",
        places: [
          { id: "bordi", reason: "Quiet coastal walks." },
          { id: "invented-place", reason: "Must never render." },
        ],
      },
    });
  });
  await page.goto("#search");
  await expect(
    page.getByRole("heading", { name: "Saved places", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Quiet beaches", exact: true })
    .click();
  await expect(page.locator(".search-results .card")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "What kind of trip would you like?" })
    .fill("A shorter drive please");
  await page.getByRole("button", { name: "Find places", exact: true }).click();
  await expect(page.locator(".search-conversation .assistant")).toHaveCount(2);
  expect(queries).toHaveLength(3);
  failSearch = true;
  const query = page.getByRole("textbox", {
    name: "What kind of trip would you like?",
  });
  await query.fill("Any forest options?");
  await page.getByRole("button", { name: "Find places", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Search temporarily unavailable.",
  );
  await expect(page.locator(".search-results .card")).toHaveCount(0);
  await expect(query).toHaveValue("Any forest options?");
  await expect(page.locator(".search-conversation .user")).toHaveCount(2);
  failSearch = false;
  await page.getByRole("button", { name: "Find places", exact: true }).click();
  await expect(page.locator(".search-results .card")).toHaveCount(1);
  await expect(page.locator(".search-conversation .user")).toHaveCount(3);
  expect(queries).toHaveLength(5);
  await expect(query).toBeEmpty();
  await expect(page.locator(".place-search [role=alert]")).toHaveCount(0);
  await page.getByRole("button", { name: "Save place", exact: true }).click();
  await expect(page.locator(".saved-places .card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".saved-places .card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Add to trip shortlist", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`#room/${room}`));
  expect(added).toEqual(["bordi"]);
});
