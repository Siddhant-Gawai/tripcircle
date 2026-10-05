# Conversational place search

The frontend remains on GitHub Pages. Supabase handles Google sign-in, private saved places and the authenticated model endpoint. Groq serves `qwen/qwen3.8-27b`; no GPU server or training is required.

## Setup on another project

1. Apply the existing database setup in [database.md](database.md), then apply `supabase/place-search.sql` once. It creates saved-place policies and a private atomic quota counter.
2. Deploy `supabase/functions/place-search/index.ts` as `place-search`. Its `verify_jwt = false` setting is intentional: the handler validates each bearer token against Supabase Auth before reading private data or calling Groq. Anonymous accounts are rejected.
3. Add `GROQ_API_KEY` to the project's Edge Function secrets. Never use a `VITE_` variable or commit the key. Use Groq's free plan; this application does not purchase or upgrade any plan. Optionally set `GROQ_MODEL` to another Groq model supporting strict JSON schemas.
4. Point `src/config.ts` at your project and publish the frontend. For a different production domain, set `APP_ORIGIN` in Edge Function secrets. CORS also allows localhost development on ports 5173 and 4173.

## Behaviour and limits

- Chat accepts up to eight recent messages, each at most 600 characters. The backend selects at most three unique catalogue destinations. Unknown IDs or invalid responses are rejected.
- Accounts may make 20 uncached requests per UTC day; the whole app is limited to 50. Provider token and request limits still apply and can be reached earlier. Quotas reset at 05:30 IST. Failed provider calls consume a reservation.
- A bounded per-account in-memory cache reuses identical conversations for ten minutes. It is best-effort across Edge Function instances and resets on deployment. Cache keys are hashes; no conversations are persisted to the database.
- Saved places contain an account ID and destination reference, not duplicate destination records. Only the account can read, insert or delete them. Saving does not publish a place or add it to a trip automatically.
- Adding to a trip uses the existing organizer-checked shortlist RPC; a destination already on the shortlist is left in place.
- Catalogue keyword search uses no model calls. It does not interpret conversational exclusions or budgets. AI chat processes the conversation through Groq, so avoid entering sensitive personal information.
- Destination cards link to existing researched detail pages and photo attribution. Costs, availability, seasonal access and travel estimates need confirmation. No new places are generated or automatically published.

## Validation

Run `tests/place-search.sql` in an administrative SQL session; it tests own-account access, cross-account read/write rejection, anonymous access, protected quota execution and per-user/global limits. It rolls back all changes.

`tests/browser/place-search.spec.ts` covers anonymous catalogue search, contextual AI requests, unknown-ID filtering, saving across reloads and adding a destination to a trip. Model responses and auth are mocked; the deployed endpoint must also be checked with a real signed-in account after configuring its secret.

Run `node --test tests/server/place-search.test.mjs` for endpoint authentication, quota enforcement, output validation, safe failure handling and cache checks. CI includes this suite.
