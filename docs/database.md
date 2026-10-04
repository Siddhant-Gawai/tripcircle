# Database setup

## Fresh Supabase project

Apply these files in order through an administrative SQL session:

1. `supabase/bootstrap.sql`
2. `supabase/rooms.sql`
3. `supabase/room-index.sql`
4. `supabase/decisions.sql`

Replace `src/config.ts` with your project's URL and publishable key. Configure Google OAuth using `GOOGLE_SETUP.md`.

Seed public destination content using the server-side script:

```sh
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-server-side-key node scripts/seed.mjs
```

The script seeds only the destination catalogue. It does not create accounts, rooms or an old single-group plan. The static public fallback is `src/catalogue.json`; update it when changing the seed catalogue.

## Existing connected project

The room and decision tables already exist. Do not rerun bootstrap/table-creation files. Photo caption fixes and number-login revocation were applied on 3 October 2026. `supabase/retire-number-login.sql` is the reproducible revocation; no historical data was deleted.

## Realtime setup

1. Apply `supabase/realtime.sql`.
2. Run `tests/rooms.sql`, `tests/decisions.sql` and `tests/realtime.sql` transactionally through an admin SQL session; all test identities/data roll back.
3. Rebuild. Realtime defaults to enabled; set Actions variable `VITE_TRIPCIRCLE_REALTIME_ENABLED=false` only to disable it.
4. Check two browsers: accept a pending request, change a vote and post a comment. Confirm the second browser refreshes without waiting for the fallback.

The migration was applied on 4 October 2026 after user approval. Transactional database tests verified owner/approved access, denial for pending members/outsiders, malformed topics and empty notification payloads. Test fixtures were rolled back. Client smoke tests cover browsing and UI navigation with mocked APIs; they do not establish a real Google OAuth session or validate production RLS.
