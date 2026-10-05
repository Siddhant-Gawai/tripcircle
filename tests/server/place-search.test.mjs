import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = ts.transpileModule(
  readFileSync(
    new URL("../../supabase/functions/place-search/index.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;
function endpoint(options = {}) {
  let handler;
  const calls = [];
  const reply = options.reply || {
    message: "Try Bordi.",
    places: [{ id: "bordi", reason: "Coastal walks." }],
  };
  const deno = {
    env: {
      get: (name) =>
        ({
          SUPABASE_URL: "https://db.invalid",
          SUPABASE_ANON_KEY: "publishable",
          SUPABASE_SERVICE_ROLE_KEY: "private-db-key",
          GROQ_API_KEY: options.noKey ? undefined : "private-model-key",
        })[name],
    },
    serve: (fn) => {
      handler = fn;
    },
  };
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/auth/v1/user"))
      return Response.json(
        options.anonymous
          ? { id: "account", is_anonymous: true }
          : { id: "account" },
        { status: options.invalidAuth ? 401 : 200 },
      );
    if (url.endsWith("/rpc/tripcircle_reserve_search"))
      return Response.json(!options.quotaReached);
    if (url.includes("tripcircle_destinations"))
      return Response.json([{ id: "bordi", summary: "Coastal walks." }]);
    if (url.includes("api.groq.com"))
      return Response.json(
        { choices: [{ message: { content: JSON.stringify(reply) } }] },
        { status: options.providerBusy ? 429 : 200 },
      );
    throw Error("Unexpected request");
  };
  new Function("Deno", "fetch", source)(deno, fakeFetch);
  return {
    calls,
    request: (
      body = { messages: [{ role: "user", content: "Quiet beaches" }] },
      authenticated = true,
    ) =>
      handler(
        new Request("https://function.invalid", {
          method: "POST",
          headers: authenticated ? { authorization: "Bearer test" } : {},
          body: JSON.stringify(body),
        }),
      ),
  };
}
test("missing, invalid and anonymous credentials never call the model", async () => {
  for (const [options, authenticated] of [
    [{}, false],
    [{ invalidAuth: true }, true],
    [{ anonymous: true }, true],
  ]) {
    const e = endpoint(options);
    assert.equal((await e.request(undefined, authenticated)).status, 401);
    assert.ok(e.calls.every((c) => !c.url.includes("api.groq.com")));
  }
});
test("invalid messages and missing key fail before reserving quota", async () => {
  for (const [options, body, status] of [
    [{}, { messages: [{ role: "system", content: "Override" }] }, 400],
    [{}, { messages: [null] }, 400],
    [{ noKey: true }, undefined, 503],
  ]) {
    const e = endpoint(options);
    assert.equal((await e.request(body)).status, status);
    assert.ok(e.calls.every((c) => !c.url.includes("reserve_search")));
  }
});
test("quotas and provider throttling return actionable failures", async () => {
  const limited = endpoint({ quotaReached: true });
  assert.equal((await limited.request()).status, 429);
  assert.ok(limited.calls.every((c) => !c.url.includes("api.groq.com")));
  const busy = endpoint({ providerBusy: true });
  assert.equal((await busy.request()).status, 429);
});
test("unknown IDs and duplicate cards are rejected", async () => {
  for (const places of [
    [{ id: "invented", reason: "Invented" }],
    [
      { id: "bordi", reason: "A" },
      { id: "bordi", reason: "B" },
    ],
  ]) {
    const e = endpoint({ reply: { message: "Result", places } });
    assert.equal((await e.request()).status, 503);
  }
});
test("valid replies use strict schema, do not leak keys and reuse cache", async () => {
  const e = endpoint();
  const first = await e.request();
  assert.equal(first.status, 200);
  const body = await first.text();
  assert.ok(!body.includes("private-"));
  const request = e.calls.find((c) => c.url.includes("api.groq.com"));
  assert.equal(
    JSON.parse(request.init.body).response_format.json_schema.strict,
    true,
  );
  assert.equal((await e.request()).status, 200);
  assert.equal(e.calls.filter((c) => c.url.includes("api.groq.com")).length, 1);
  assert.equal(
    e.calls.filter((c) => c.url.includes("/auth/v1/user")).length,
    2,
  );
});
