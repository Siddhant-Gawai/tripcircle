# TripCircle

A public small-group trip planner: quiet destination pages, Google sign-in, private/public rooms, organizer approval, shared itineraries, place picks, discussion and packing checklists.

Live: https://siddhant-gawai.github.io/tripcircle/

## Public room planner

Apply `supabase/rooms.sql` and then `supabase/room-index.sql` after the existing schema migrations. It creates isolated room tables in `tripcircle_private`; all reads and writes go through `public.tripcircle_rooms`, with authenticated identity checks and room membership checks. Phone-only profiles from the original friends planner cannot access rooms. Public previews contain title, origin, summary, dates, budget and group size; invite codes, members, plans and discussion are protected. Organizers approve requests, enforce capacity and may remove members. Accepted members can pick a shortlisted place, share messages, add packing tasks and update task completion. Organizers manage the final shortlist, itinerary and visibility. Rooms refresh every 15 seconds; public listings every 20 seconds.

Google sign-in needs the one-time setup in [GOOGLE_SETUP.md](GOOGLE_SETUP.md). Until the Google provider is enabled, browsing works and creation/joining clearly reports that sign-in is unavailable. Account email is not returned in room previews or member lists. Sessions use a separate auth storage key from the original planner. Google account names are suggested as editable display names.

Run `tests/rooms.sql` transactionally to check private-room access, pending approval, owner controls, capacity, collaboration, removed-member access, anonymous previews and private-table isolation. No test identities or test rooms are retained. These tests do not complete a real Google sign-in.

Hash routes (`#place/<id>`, `#room/<id>`, `#join/<code>`, `#my-trips`) work on GitHub Pages without server rewrites. The original friends planner is no longer included in the frontend or navigation. Historical tables and migrations remain for data continuity; rooms use Google-authenticated membership. This release does not include expense splitting, booking, public moderation tooling or verified phone numbers. Wider stranger-group discovery should include reporting/moderation and community rules before promotion.

## Date polls and trip decisions

Apply `supabase/decisions.sql` after the room migrations. Approved members can mark availability for multiple date options and cast one changeable stay/transport vote per category. Members can suggest stays and transport with optional HTTPS links, group quotes and notes. Only organizers can add date polls, archive options and save confirmed details. Private `room_choices`, `choice_votes` and `room_overview` tables have RLS and no direct client grants; checked RPCs enforce existing room permissions. Votes from removed members are excluded. The overview includes destination, dates, stay, transport, budget per person, meeting point/time and unfinished task count. Confirmed dates/budget update public trip previews; meeting details and options stay inside approved rooms. Confirming an option does not make a booking. Room refreshes update polls and decisions automatically.

`tests/decisions.sql` checks availability, vote replacement, pending/removed access, cross-room choices, organizer confirmation, private projections, safe links and archived selections transactionally. Option removal is a reversible archive in the database; votes and historical records are retained.

---

A shared trip planner built around a real decision: where should 6–7 friends go from Ahmedabad for a peaceful October/November break?

## What works

- Five clickable destination pages with authentic photographs, summaries, viewpoints, itineraries, map links and small-stay leads.
- Mobile-first comparison with hills, forest and beach filters.
- Public read access; a verified organizer can edit destination details, shared dates and notes.
- Name and 10-digit number on first entry; number only to reopen the same unverified group profile across devices. No email, password, PIN or OTP. One changeable vote per number profile.
- Shared comments and suggestions with place tags, timestamps and removal of your own posts.
- Supabase persistence across devices; the shared plan refreshes every 20 seconds and on page focus.
- Aggregate vote counts without exposing individual voters to public readers.

The section below documents the original single-group planner, retained for compatibility. Expense splitting is future work.

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
| `tripcircle_private.participants` | Device token hash, name and optional legacy phone | No direct client access |
| `tripcircle_private.guest_votes` | One vote per device profile | Token-validated RPC only |
| `tripcircle_private.discussion` | Comments and suggestions | Token-validated writes, public projection without phones/tokens |
| `tripcircle_private.editors` | Organizer email allowlist | No direct client access |

Row-level security is enabled on every table. Narrowly scoped functions in the non-exposed private schema use `SECURITY DEFINER` to check organizer identity, validate participant device tokens, and return fixed public feed/aggregate projections. Both pin an empty search path, use fully qualified relations and revoke default public execution. Public wrappers use invoker security. Authorization never uses editable user metadata.

Reading the plan, names and discussion is public. Participation uses a random 122-bit device token whose SHA-256 hash is stored in the private schema. Phone numbers are stored privately. The number-only login RPC intentionally allows anyone knowing a number to reopen that group profile; this is not verified authentication and must not protect sensitive data. The database resolves a random session token to the shared number profile. Organizer access remains separate. The browser stores only token, display name, own vote and own post IDs. Tokens never grant organizer access. Use the same number on another device to restore the profile, vote and own-post controls. Clearing storage signs out locally. Votes are informal, not a verified one-person-one-vote election. Posting is limited to five posts/hour/profile, but this is not protection against determined abuse on a public site. Authentication is shared with Relay, although this frontend uses its own session-storage key. Do not place private expenses or personal information in public plan notes.

## Reproduce on a different Supabase project

1. Apply `supabase/schema.sql` once to a fresh project. It is an initial schema, not an idempotent migration.
2. Apply `supabase/participants.sql` once. Group members need no Supabase Auth account. Provision a verified organizer account separately if you need protected plan editing.
3. Provision an organizer in SQL (do not publish your real email in a seed file):

```sql
insert into tripcircle_private.editors(email) values ('organizer@example.com');
```

4. Replace the frontend URL and publishable key in `src/config.ts`.
5. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in a local shell and run `node scripts/seed.mjs`. The privileged key is used only by this server-side provisioning script.
6. Browsing and number-profile participation never call Supabase Auth, so there is no email redirect. The separate organizer login uses an existing verified account; Relay-wide Auth settings are unchanged.

The connected Relay schema and initial data were provisioned on 2 October 2026. The organizer allowlist was provisioned separately; no actual user account was created or password set.

## GitHub Pages deployment

Create a public repository named `tripcircle`, push this project to `main`, then choose **Settings → Pages → Source: GitHub Actions**. The included `.github/workflows/pages.yml` builds and deploys it. The expected path is `/tripcircle/`; update `vite.config.ts` if you choose a different repository name.

The frontend is public; organizer-only editing is enforced by Postgres, not by hiding buttons. Content edits save to Supabase immediately and are picked up by other viewers on refresh or within 20 seconds. Code changes require the Pages workflow to finish.

## Validation

- TypeScript type-check and production build: `npm run build`.
- Database authorization regression: `tests/permissions.sql`. Run through an administrative SQL session; it creates temporary test identities and uses a transaction that rolls everything back. Checks public reads, own-vote edits, forged-vote rejection, organizer edits and unconfirmed-organizer rejection.
- Confirm the owner can sign in and save changes after real email verification before sending the link to the group.

## Research

Sources live on each destination. Research was compiled on 2 October 2026. Road times are planning estimates; room availability, access, costs and seasonal waterfall flow are not confirmed. Authentic Commons photographs include credits and licence links. Ninai links to the official gallery; government photographs are not copied.

Participant permission regression checks are in `tests/participants.sql`. Run transactionally through SQL editor; all test data rolls back.

## Simple destination pages

After the initial schema and participant migrations, apply `supabase/simple-pages.sql`. Run the seed script to load destinations and their `details` JSON from `supabase/page-details.json`. Photos live in `public/photos/`; attribution is recorded in `CREDITS.md` and `supabase/photo-credits.json`. Hash routes such as `#place/jawhar` support share links and page refreshes on GitHub Pages. The separate Manage entry in the footer keeps organizer editing protected. Run `tests/simple-pages.sql` transactionally for no-phone participation checks.

## Number-only group profiles

Apply `supabase/number-login.sql` after the earlier migrations. The name is entered once; later entries need only the 10-digit Indian national number. Private `number_profiles` maps numbers to participants; `number_sessions` maps per-device capability hashes to that participant. Shared votes and posts remain in the existing tables. Logging out revokes only that device session. Existing +91 profiles are backfilled; if old profiles had duplicate numbers, the earliest is used and the others remain historical records. Anonymous profiles without numbers remain historical unless separately migrated. `tests/number-login.sql` checks two-device restoration, synchronized votes, post ownership, logout, phone validation and private-table isolation transactionally.
