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
});
test("public browsing stays light, hides empty trips and opens full place pages", async ({
  page,
}) => {
  const scripts: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "script") scripts.push(r.url());
  });
  await page.goto("");
  if (process.env.CAPTURE_README && test.info().project.name === "desktop")
    await page
      .locator(".public-hero")
      .screenshot({ path: "docs/homepage.png" });
  await expect(
    page.getByRole("heading", { name: "Places worth slowing down for" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Discover public trips" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Places", exact: true }),
  ).toBeVisible();
  const hero = page.locator(".public-hero");
  const image = hero.locator("figure");
  if (test.info().project.name === "mobile") {
    const textBounds = await hero.locator(".hero-copy").boundingBox(),
      imageBounds = await image.boundingBox();
    expect(imageBounds!.y).toBeGreaterThan(
      textBounds!.y + textBounds!.height - 1,
    );
    expect(imageBounds!.width).toBeGreaterThan(300);
  }
  await page.getByRole("button", { name: "Beach", exact: true }).click();
  await expect(page.locator(".card")).toHaveCount(2);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.locator(".card-link").filter({ hasText: "Jawhar" }).click();
  await expect(
    page.getByRole("heading", { name: "Jawhar", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Where to stay" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Wooded valley and green hillside/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "← Back to places" }),
  ).toBeVisible();
  expect(
    scripts.some((s) => s.includes("PlannerApp") || s.includes("RoomPlanner")),
  ).toBe(false);
});
test("join loads the planner on demand and validates the room code", async ({
  page,
}) => {
  await page.route("**/auth/v1/**", (r) =>
    r.fulfill({ json: { external: { google: true } } }),
  );
  await page.goto("");
  await page
    .getByRole("button", { name: "Join with a code", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Room code", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Room code", exact: true })
    .fill("not a code");
  await expect(
    page.getByRole("textbox", { name: "Room code", exact: true }),
  ).toHaveValue("NOTACODE");
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeVisible();
});
test("photo assets decode and WhatsApp metadata survives production build", async ({
  page,
  request,
}) => {
  await page.goto("");
  const ogImage = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  expect(ogImage).toContain("bordi-beach.jpg");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    /TripCircle/,
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    /quiet places/i,
  );
  for (const path of [
    "photos/bordi-beach.jpg",
    "photos/don-hills-960.webp",
    "photos/jawhar-valley-480.webp",
    "photos/guhagar-beach-480.webp",
  ]) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    expect((await response.body()).length).toBeGreaterThan(1000);
  }
  await expect(page.locator(".public-hero img")).toHaveJSProperty(
    "complete",
    true,
  );
  expect(
    await page
      .locator(".public-hero img")
      .evaluate((i: HTMLImageElement) => i.naturalWidth),
  ).toBeGreaterThan(0);
});

test("shortlisted photo opens its page and returns to the same room", async ({
  page,
}) => {
  const uid = "11111111-1111-4111-8111-111111111111",
    id = "22222222-2222-4222-8222-222222222222";
  await page.addInitScript(
    ({ uid }) => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = `${btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${btoa(JSON.stringify({ sub: uid, role: "authenticated", exp }))}.test`;
      localStorage.setItem(
        "tripcircle-public-auth",
        JSON.stringify({
          access_token: token,
          refresh_token: "test-only",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: uid,
            aud: "authenticated",
            email: "test@example.invalid",
            user_metadata: { name: "Test Member" },
          },
        }),
      );
    },
    { uid },
  );
  const room = {
    id,
    title: "Quiet weekend test",
    origin: "Ahmedabad",
    visibility: "private",
    capacity: 7,
    dates: "",
    budget: "",
    organizer: false,
    status: "approved",
    members: [
      { id: null, name: "Test Member", status: "approved", organizer: false },
    ],
    posts: [],
    votes: { jawhar: 1 },
    my_vote: "jawhar",
    plan: {
      days: [],
      notes: "",
      destinations: ["jawhar", "guhagar"],
      checklist: [],
    },
  };
  await page.route("**/auth/v1/**", (r) =>
    r.fulfill({ json: { external: { google: true } } }),
  );
  await page.route("**/rest/v1/rpc/tripcircle_rooms", (r) =>
    r.fulfill({
      json:
        r.request().postDataJSON().p_action === "view"
          ? room
          : r.request().postDataJSON().p_action === "mine"
            ? [room]
            : [],
    }),
  );
  await page.route("**/rest/v1/rpc/tripcircle_decisions", (r) =>
    r.fulfill({ json: { choices: [], overview: {} } }),
  );
  await page.goto(`#room/${id}`);
  const link = page.getByRole("link", {
    name: "View Jawhar: photos, viewpoints and stays",
  });
  await expect(link).toBeVisible();
  await link.locator("img").click();
  await expect(
    page.getByRole("heading", { name: "Jawhar", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "← Back to your trip" }).click();
  await expect(
    page.getByRole("heading", { name: "Quiet weekend test" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "✓ Picked · 1" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("destination URLs contain content before JavaScript and reload correctly", async ({
  page,
  request,
}) => {
  const response = await request.get("places/jawhar/");
  const html = await response.text();
  expect(response.ok()).toBe(true);
  expect(html).toContain("<h1>Jawhar</h1>");
  expect(html).toContain("/tripcircle/places/jawhar/");
  expect(html).toContain("Wooded valley and green hillside");
  await page.goto("places/jawhar/");
  await expect(
    page.getByRole("heading", { name: "Jawhar", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Where to stay" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "← Back to places" }).click();
  await expect(page.locator(".card")).toHaveCount(5);
});

test("visitors can explore the demo without signing in or loading the planner", async ({
  page,
}) => {
  const scripts: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "script") scripts.push(r.url());
  });
  await page.goto("#demo");
  await expect(page.getByText("SAMPLE ROOM · READ ONLY")).toBeVisible();
  for (const [tab, heading] of [
    ["Plan", "Day 1 · Travel & settle in"],
    ["Decisions", "Choose together"],
    ["Packing", "Who is bringing what?"],
    ["Discussion", "Comments & suggestions"],
  ]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await expect(page.locator(".card")).toHaveCount(2);
  expect(
    scripts.some((s) => s.includes("PlannerApp") || s.includes("RoomPlanner")),
  ).toBe(false);
});
