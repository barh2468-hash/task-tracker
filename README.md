# MAYA Infrastructure Tracker

A field-operations tracker for MAYA's infrastructure projects: project and task
management, field attendance and work sessions, a live map, work diaries with
digital signatures, equipment registers, and email/push notifications for
managers and field crews.

Vite + React 19 single-page app, plain JavaScript (JSX, no TypeScript). No
SSR, no file-based routing — client-side routing via React Router. Backend is
Supabase (Postgres, Auth, Storage, Edge Functions).

## Tech stack

- **Frontend:** React 19, Vite 6, React Router 7, i18next (Hebrew/English),
  Leaflet (map), ExcelJS (import/export), `vite-plugin-pwa` (installable PWA
  with offline support and push notifications)
- **Backend:** Supabase — Postgres with Row Level Security, Auth, Storage,
  and Deno Edge Functions (email notifications, scheduled summaries)
- **Deploy:** Vercel (see [`vercel.json`](vercel.json))

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL and anon key
npm run dev
```

Other scripts:

```bash
npm run build     # production build to dist/
npm run preview   # preview a production build locally
npm run lint      # ESLint (flat config)
```

## Environment variables

Set these in `.env` for local development (see
[`.env.example`](.env.example)):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase project
  credentials used by the frontend.
- `RESEND_API_KEY`, `FROM_EMAIL` — set as Supabase Edge Function secrets
  (server-side only), used for outgoing notification emails.
- `CRON_SECRET` — Edge Function secret shared with `pg_cron` so scheduled
  functions can authenticate; also stored in Supabase Vault as
  `maya_cron_secret`. See [`CHANGELOG.md`](CHANGELOG.md) for setup steps.

## Project structure

```
src/
  services/
    supabase.js       # Supabase client — the only place it's constructed
    api/*.js           # thin 1:1 wrappers per Supabase resource
  features/<name>/     # one folder per feature, each self-contained:
    api.js              # composed business operations for the feature
    context (optional)  # a Context provider where the feature owns shared state
    components/         # feature-specific UI
  routes/               # one file per URL under /app/*, plus DashboardLayout
                        # (header/sidebar shell) and auth/setup gating pages
  components/, hooks/, utils/  # shared, feature-agnostic code only
  styles/globals.css    # the whole app's styling, one file — reuse existing
                        # class names rather than adding new CSS
```

Features currently under `src/features/`: `auth`, `projects`, `attendance`,
`work-diary`, `equipment`, `notifications`, `reporting`, `map`, `chat`,
`photos`, `pwa`, `offline`, `language`.

Every Supabase call goes through `src/services/supabase.js` and
`src/services/api/*.js`, or through a feature's own `api.js` — no other file
talks to the Supabase client directly.

`scripts/` holds one-off local admin utilities that use the Supabase Admin
API (service role key, never committed) — e.g. `reset-user-password.mjs` for
setting a user's password directly when email delivery isn't available.

## Backend (Supabase)

`supabase/` holds the schema, one-off SQL fixes, versioned migrations
(`supabase/migrations/`), and Edge Functions (`supabase/functions/`). This
frontend rewrite kept the same backend, RLS policies, and functions as
before — no schema changes were introduced by the rewrite itself.

Feature-by-feature migration/setup notes (which SQL file to run, what it
does, and what Edge Functions to deploy) are tracked in
[`CHANGELOG.md`](CHANGELOG.md).

## Deployment

Deploys to Vercel using the Vite framework preset
([`vercel.json`](vercel.json)): `npm run build` outputs to `dist/`, and all
routes rewrite to `index.html` for client-side routing.

```bash
git push
```

Vercel builds and deploys automatically from the connected branch.
