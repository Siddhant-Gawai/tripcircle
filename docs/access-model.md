# Access model

`tripcircle_destinations` is publicly readable. Other projects sharing this Supabase database are unaffected by TripCircle's room access rules.

Room tables live in `tripcircle_private`, with RLS enabled and no direct `anon` or `authenticated` table grants. Public invoker RPC wrappers call narrow private functions that validate `auth.uid()` and membership. Display names from Google user metadata are suggestions only; they are never authorization claims.

Public previews include title, origin, dates, summary, budget and group size. They omit room codes, member identities, discussion and meeting details. Only organizers and approved members can read the shared plan. Pending/rejected visitors receive a preview/status. Organizers alone approve members, control visibility, save the itinerary and confirm decisions.

## Realtime updates

`supabase/realtime.sql` adds a named SELECT policy on `realtime.messages` for private empty broadcasts. It does not grant table reads or message sending. Users can receive their own user-topic notices; room-topic notices require organizer/approved membership. Database triggers send `{}` rather than rows, names, votes, notes or codes. Existing RPCs check permissions again when recipients refresh. A removed member cannot retrieve room data even if a previously authorized socket remains connected.

Public catalogue notifications contain no payload and are emitted only for public trip changes. Only the named TripCircle policy is replaced; unrelated Realtime policies and other projects are not changed.

This production migration was applied and tested on 4 October 2026. Realtime is enabled by default; set `VITE_TRIPCIRCLE_REALTIME_ENABLED=false` to disable it. Connection errors activate a one-minute fallback. Private room approval/rejection notices use a per-user channel so pending members can learn that their access changed.

## Retired number login

`supabase/retire-number-login.sql` revokes execution on both legacy number-login entry points. This is already applied on the connected project. Historical participants, votes and sessions are preserved. No number-only frontend or login implementation is included in the current repository.

The browser contains a publishable Supabase key. Service-role keys belong only in a local/admin environment and must never be added to the frontend or repository.
