# TripCircle

Peaceful places and one shared plan for a small group. Browse destinations from Ahmedabad, create a room, invite your people and decide the trip together.

[Open TripCircle](https://siddhant-gawai.github.io/tripcircle/)

![TripCircle homepage](docs/homepage.png)

## Small patch · 5 October 2026

A successful retry now clears the previous trip-decisions error after reloading the polls and overview. If a retry fails, the latest error remains visible. To check manually, interrupt the connection while loading trip decisions, restore it, then choose **Retry** and confirm the error disappears when the data loads.

## Ask TripCircle

Open **Ask TripCircle** (`#search`) to find destinations through chat and see the matches as photo cards. Signed-out visitors can search the catalogue without a model call. Signed-in visitors can ask follow-up questions, save destinations privately across devices and add saved places to a room they organize. **Use catalogue search** remains available if the AI quota or provider is unavailable.

The Supabase `place-search` Edge Function calls Groq's open Qwen model with strict structured output. It retrieves the catalogue itself, accepts only known destination IDs, and never creates destinations from model text. Photos, credits, source links and trip facts come from the existing records. This first version covers five researched destinations from Ahmedabad; it does not browse the web or verify current prices and bookings.

Setup and limits are documented in [place search setup](docs/place-search.md). The connected Relay database and Edge Function have been deployed. Keep `GROQ_API_KEY` exclusively in Edge Function secrets.

## Quick start

Requires Node.js 24.

```sh
npm ci --ignore-scripts
npm run dev
```

Open the printed URL ending in `/tripcircle/`. The included configuration uses the existing Supabase project. For your own project, follow [database setup](docs/database.md) and [Google sign-in setup](GOOGLE_SETUP.md).

```sh
npm run lint
npm run format:check
npm run build
npx playwright install chromium
npm run test:smoke
```

GitHub Actions runs lint, formatting, TypeScript, a production build, a bundle budget check and desktop/mobile Playwright smoke tests before deploying to Pages.

## What you can do

- Explore five destination pages with real photos, viewpoints, small-stay leads, source links and itineraries.
- Create private rooms with invite codes, or publish a trip preview others can request to join.
- Sign in with Google. Organizers approve every joining request.
- Shortlist places, mark date availability, suggest stays/transport and vote on options.
- Save a final itinerary, meeting details and budget; share comments and packing tasks.
- Tap a shortlisted photo or place name to view its details, then return to your trip.

The homepage links to a read-only demo room with sample itineraries, decisions, packing and discussion. Destination pages use `/places/<id>/` URLs with pre-rendered content, individual share metadata and a sitemap. Empty public trip listings are hidden. Destinations are public; room plans and discussion are for approved members.

## Project structure

```text
src/PublicShell.tsx       Public routes; no Supabase SDK in the initial bundle
src/PlannerApp.tsx        Lazy-loaded sign-in, room access and data operations
src/RoomPlanner.tsx       Lazy-loaded itinerary, shortlist and collaboration UI
src/RoomDecisions.tsx     Polls, options and final trip decisions
src/components/          Hero, destination cards, place detail, room list, preview
src/realtime.ts          Broadcast subscription and reconnect fallback
src/catalogue.json       Public catalogue fallback for fast/offline browsing
supabase/                Current database setup, content and follow-up SQL
scripts/                 Catalogue seeding and bundle budget check
tests/browser/          Desktop/mobile smoke tests
```

React, TypeScript, Vite and Supabase Postgres/Auth; hosted on GitHub Pages. Source is formatted with Prettier. The initial production JS is approximately **248 KB / 77 KB gzip**; the sign-in/Supabase and room-planner chunks load when needed. The old 480 KB entry is no longer used.

## Live updates status

Realtime is enabled by default. The production migration in [supabase/realtime.sql](supabase/realtime.sql) was applied and database-tested on 4 October 2026: owners and approved members can receive private room signals; pending members and outsiders cannot. Signals contain no private row content. The client refreshes via checked RPCs on changes, focus and actions; a one-minute fallback runs only if Realtime fails. Set `VITE_TRIPCIRCLE_REALTIME_ENABLED=false` to explicitly disable it. Public visitors refresh catalogue data on navigation and focus without loading the SDK. See [the access model](docs/access-model.md).

The unused number-only login endpoint has been disabled in the live database. Its historical profiles remain intact; the current frontend uses Google sign-in only.

## Deploy

Set **Settings → Pages → Source → GitHub Actions**, then push to `main`. The workflow publishes `dist/` only after its checks pass. The base path is configured in `vite.config.ts`.

## Photos and research

Photos are responsive WebP derivatives with individual credits and licence/source links. Only `bordi-beach.jpg` is retained for the WhatsApp/Open Graph preview; other original JPEGs are available at their source links. Dediapada links to the official gallery.

Research dates to 2 October 2026. Journey times and stays are planning leads; verify access, transport, availability and price before booking. This app does not book rooms or collect payments.

### Mobile and installation

Phones get safe-area bottom navigation, a sticky create button on destinations, swipable photo galleries, scrolling room sections and bottom sheets. The overview shows members and packing progress alongside trip decisions. Dark mode follows your device; reduced-motion settings are respected. Organizer invites can be opened directly in WhatsApp.

The installable PWA uses 192px and 512px icons. Its service worker caches only same-origin public pages and static assets, with network-first refresh and an offline fallback. Auth callback URLs, Supabase/API responses and private room data are never cached. Room edits require a connection.
