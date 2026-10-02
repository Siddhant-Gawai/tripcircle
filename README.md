# TripCircle

A shared trip planner built around a real decision: where should 6–7 friends go from Ahmedabad for a peaceful October/November break?

## What works

- Five researched destinations with travel estimates, itineraries, source links and caveats.
- Mobile-first comparison with hills, forest and beach filters.
- Public read access; a verified organizer can edit destination details, shared dates and notes.
- Name and phone entry with no email verification or OTP for group participation. One changeable vote per device profile.
- Shared comments and suggestions with place tags, timestamps and removal of your own posts.
- Supabase persistence across devices; the shared plan refreshes every 20 seconds and on page focus.
- Aggregate vote counts without exposing individual voters to public readers.

Expenses, multi-trip groups and date polls are future work. This version is a single shared shortlist, not a general booking service.

## Stack

React, TypeScript, Vite and Supabase Postgres/Auth. Static frontend deployed through GitHub Actions to GitHub Pages. No server runtime required on GitHub Pages.

## Run locally

```sh
npm ci --ignore-scripts
npm run dev -- --host 127.0.0.1
```

Open the printed URL ending in `/tripcircle/`. Build with `npm run build`. Node 24 is used in CI.

`src/config.ts` contains the Relay URL and a **publishable** browser key. Publishable keys are designed for browser exposure; access is enforced by database policies. Never add a service-role key to this file, frontend code or the repository.

## Database isolation and access model

Existing Relay data remains in its original schemas. This project adds:

| Object | Purpose | Access |
|---|---|---|
| `public.tripcircle_destinations` | Researched places | Public read, organizer update |
| `public.tripcircle_plan` | Shared dates and notes | Public read, organizer update |
| `public.tripcircle_votes` | One vote per account | Users read/write their own vote |
| `tripcircle_private.participants` | Device token hash, name and private phone | No direct client access |
| `tripcircle_private.guest_votes` | One vote per device profile | Token-validated RPC only |
| `tripcircle_private.discussion` | Comments and suggestions | Token-validated writes, public projection without phones/tokens |
| `tripcircle_private.editors` | Organizer email allowlist | No direct client access |

Row-level security is enabled on every table. Narrowly scoped functions in the non-exposed private schema use `SECURITY DEFINER` to check organizer identity, validate participant device tokens, and return fixed public feed/aggregate projections. Both pin an empty search path, use fully qualified relations and revoke default public execution. Public wrappers use invoker security. Authorization never uses editable user metadata.

Reading the plan, names and discussion is public. Participation uses a random 122-bit device token whose SHA-256 hash is stored in the private schema. Phone numbers are self-reported and stored privately; no phone lookup or recovery endpoint exists. The browser stores only token, display name, own vote and own post IDs. Tokens never grant organizer access. Clearing browser storage or using another device creates another profile; these are informal votes, not a verified one-person-one-vote election. Posting is limited to five posts/hour/profile, but this is not protection against determined abuse on a public site. Authentication is shared with Relay, although this frontend uses its own session-storage key. Do not place private expenses or personal information in public plan notes.

## Reproduce on a different Supabase project

1. Apply `supabase/schema.sql` once to a fresh project. It is an initial schema, not an idempotent migration.
2. Apply `supabase/participants.sql` once. Group members need no Supabase Auth account. Provision a verified organizer account separately if you need protected plan editing.
3. Provision an organizer in SQL (do not publish your real email in a seed file):

```sql
insert into tripcircle_private.editors(email) values ('organizer@example.com');
```

4. Replace the frontend URL and publishable key in `src/config.ts`.
5. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in a local shell and run `node scripts/seed.mjs`. The privileged key is used only by this server-side provisioning script.
6. The main Join flow never calls Supabase Auth, so it has no email redirect. The separate organizer login uses an existing verified account; Relay-wide Auth settings are unchanged.

The connected Relay schema and initial data were provisioned on 2 October 2026. The organizer allowlist was provisioned separately; no actual user account was created or password set.

## GitHub Pages deployment

Create a public repository named `tripcircle`, push this project to `main`, then choose **Settings → Pages → Source: GitHub Actions**. The included `.github/workflows/pages.yml` builds and deploys it. The expected path is `/tripcircle/`; update `vite.config.ts` if you choose a different repository name.

The frontend is public; organizer-only editing is enforced by Postgres, not by hiding buttons. Content edits save to Supabase immediately and are picked up by other viewers on refresh or within 20 seconds. Code changes require the Pages workflow to finish.

## Validation

- TypeScript type-check and production build: `npm run build`.
- Database authorization regression: `tests/permissions.sql`. Run through an administrative SQL session; it creates temporary test identities and uses a transaction that rolls everything back. Checks public reads, own-vote edits, forged-vote rejection, organizer edits and unconfirmed-organizer rejection.
- Confirm the owner can sign in and save changes after real email verification before sending the link to the group.

## Research

Sources live on each destination. Research was compiled on 2 October 2026. Road times are planning estimates; room availability, access, costs and seasonal waterfall flow are not confirmed. No images or text copied from tourism sites are included.

Participant permission regression checks are in `tests/participants.sql`. Run transactionally through SQL editor; all test data rolls back.
