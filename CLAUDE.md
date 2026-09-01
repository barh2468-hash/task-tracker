# MAYA Infrastructure Tracker

Vite + React 19 SPA, plain JavaScript (JSX, no TypeScript). No SSR, no
file-based routing — client-side routing via React Router (`src/App.jsx`).

- `src/services/supabase.js` + `src/services/api/*.js` — the only files that
  call the Supabase client directly (thin 1:1 wrappers per resource). Every
  other file goes through these or through a feature's own `api.js`.
- `src/features/<name>/` — one folder per feature (auth, projects, attendance,
  work-diary, notifications, reporting, map, pwa, photos), each with its own
  `api.js` (composed business operations), a Context provider where it owns
  shared state, and `components/`.
- `src/routes/` — one file per URL under `/app/*`, plus `DashboardLayout.jsx`
  (header/sidebar shell) and the auth/setup gating pages.
- `src/components/`, `src/hooks/`, `src/utils/` — shared, feature-agnostic
  code only.
- `src/styles/globals.css` — the whole app's styling, ported as one file;
  reuse existing class names rather than adding new CSS.

`supabase/` (schema, migrations, Edge Functions) and
`tmp/pdfs/generate_project_flow_pdf.py` are untouched — same backend,
same RLS, same functions as before this frontend rewrite.

Scripts: `npm run dev` / `build` / `preview` / `lint` (Vite + ESLint flat
config). Env vars use the `VITE_*` prefix (see `.env.example`).
