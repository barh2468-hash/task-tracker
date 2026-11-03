# Disk I/O optimization — 2026-11-03

Project: `qopsdkmzvncamjrxjwni`.

## Changes

- Healthy realtime connections use a five-minute safety poll. The existing
  shorter interval remains the fallback when realtime is unavailable. Focus,
  reconnect and online events still refresh data. Hidden/offline tabs skip
  refresh reads; bursts coalesce and a slow read cannot overlap another read
  from the same subscription. GPR email details retain a one-minute safety
  poll because email-only links are not published as realtime events.
- Project lists fetch only each task's latest report. Opening a project fetches
  its complete report history, including older reports used by drawing batches.
  Pending offline reports are merged into that history. Visited project details
  are cached per account/project for offline access.
- Migration `20261103135625_reduce_disk_io.sql` caches identity and manager checks
  in seven SELECT policies and indexes global/project status-history ordering.
  Policy roles, restrictive policies, write checks and grants are preserved.

The database migration was applied to the live project. The frontend changes
take effect after the release is deployed and clients load it. The isolated
release checkout is `tmp/disk-io-release`. The existing recovery checkout under
`tmp/project-load-recovery` belongs to a separate recovery task and is preserved.
Unrelated shared-workspace contact edits are excluded from this release.

## Verification

Before applying the migration, `supabase/tests/disk_io_access_test.sql` compared
row counts and sorted identity digests for all 26 existing accounts and anon
across profiles, projects, workers, tasks, reports and history. Every result was
unchanged. It also verified policy roles, commands, permissiveness and write checks.
The test applies the migration inside a transaction and rolls everything back.
Run it with psql; when using the SQL API, inline its `\ir` migration first.

A warm-cache sample of the formerly failing 80-project embedded query changed
from 22.847 ms execution / 976 shared-block hits to 15.134 ms / 582 hits.
Planning changed from 65.654 ms to 60.501 ms. Both samples wrote zero temporary
blocks. These samples demonstrate reduced work, not a guarantee under load.
The frontend additionally avoids that deep query and cuts idle project safety
polls from 180/hour to 12/hour while realtime is healthy.

Performance Advisor's per-row auth/role evaluation findings dropped from 51 to
44. Security Advisor findings were unchanged. Existing advisories outside these
reads were not changed by this optimization.

Automated checks cover latest-versus-full report reads, account-scoped offline
caching, failures, refresh coalescing, connection loss, reconnect, visibility and
cleanup. A local browser fixture checks actual project details in Hebrew,
English and Greek at 390 px: loading, errors, retry, language switching, report
history, direction and horizontal overflow. No application console errors occurred.
The isolated release passed 68 functional tests, full ESLint (zero errors, nine
existing Fast Refresh warnings) and the production build.

## Follow-up measurement

Compare Supabase's Disk I/O, swap/memory and request/error charts over equivalent
traffic windows after the frontend deployment. SQL statistics do not expose the
remaining disk burst allowance or host swap usage. The approximately 97 GB of
temporary writes observed during diagnosis was a cumulative counter, not today's
usage; the source of all those writes has not been established.

Do not reset statistics just to make the warning disappear. If normal production
traffic still exhausts the allowance after deployment, use the host metrics to
decide whether a larger compute instance is warranted.

References:
- [Supabase high Disk I/O](https://supabase.com/kb/troubleshooting/exhaust-disk-io)
- [RLS performance](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations)
