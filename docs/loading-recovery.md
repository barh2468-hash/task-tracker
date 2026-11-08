# Loading recovery and bounded file signing

## Incident evidence

The Supabase logs for 2026-11-05, 08:00–14:00 UTC (10:00–16:00 in
Asia/Hebron), show slow requests starting around 12:20 local time. Some
requests for profiles, history, attendance and notifications took 70–89
seconds. There were 170 statement-timeout errors across Storage, PostgREST,
Realtime and the metrics exporter, plus 21 idle-transaction terminations.
Storage signing also returned HTTP 544.

This establishes a backend slowdown. It does not establish whether CPU,
memory, disk throughput or another platform issue caused it. Historical host
metrics are still needed for that distinction. The existing authenticator
transaction limits were present during this investigation, and the live
verification found zero idle-in-transaction Data API connections. No database
schema, grants, policies or compute configuration were changed by this fix.

## Application fixes

- File panels previously regenerated signed URLs when parents passed freshly
  filtered arrays. Document panels also started two signing requests per file
  without a shared concurrency limit. File identity now controls effects, and
  all callers of the shared storage API use at most three signing requests at
  once. Duplicate pending requests coalesce. Successful URLs are reused in a
  bounded in-memory cache, renewed before their original deadline, and
  invalidated on account changes and file replacement/deletion. Failures are
  not cached. The auth callback only updates cache state; it never awaits an
  Auth or Data API request.
- Each file becomes available independently. A failed file link displays a
  localized retry action, while successful files remain usable. Returning to
  the window or reconnecting also retries link resolution.
- A valid auth session with a failed profile read previously entered the
  dashboard without a profile. Protected routes now show a recovery screen
  with retry and sign-out actions. Retrying reruns profile resolution and
  does not grant permissions or invent a fallback profile.
- New messages are connected to the existing Hebrew, English, Greek and
  Portuguese resources. User-entered file names are preserved.

## Verification

Run the focused regression suite:

```powershell
node --test src/services/api/signedUrlCache.test.js src/features/auth/recoveryTranslations.test.js src/features/projects/projectLoader.test.js src/hooks/realtimeRefresh.test.js src/services/fetchWithTimeout.test.js
npx eslint src
npm run build
```

The 37 focused tests pass. Source lint has no errors and retains nine existing
Fast Refresh warnings. Whole-workspace lint also scans unrelated generated
files under `outputs/accounting-reconstruction-20261008`, which contain ten
pre-existing errors.

A browser fixture exercised the actual providers, protected route, file
panels and shared cache with a simulated backend. It passed at 390 px in
Hebrew, English and Greek, including language switching, direction, accessible
messages, profile failure/retry, per-file failure/retry, account changes and
automatic URL renewal after a simulated hour. Fifteen parent rerenders and
language switches caused zero additional signing requests for an unchanged
set of files. Peak signing concurrency was three. No page errors or mobile
horizontal overflow occurred. These are local regression measurements, not a
claim that the historical server-resource problem has been resolved.

The frontend must be deployed for clients to receive these changes.

Reference: [Supabase signed URL caching](https://supabase.com/docs/guides/storage/cdn/smart-cdn#signed-urls-and-cdn-caching).
