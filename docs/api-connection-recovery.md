# Recovering aborted Data API connections

On 2026-11-03, PostgREST 14.5 connections remained in `idle in transaction
(aborted)` after statement timeouts. The pool reused those sessions and logged
`25P02` on `BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY`, making unrelated
project, attendance, profile and notification reads fail. Returning an empty
project list or changing project access policies does not recover this state.

The incident was recovered by terminating only aborted PostgREST connections
whose last command was a read-only `BEGIN`. The active application was then
verified to show 168 active projects, 175 archived projects and 6 personal
projects. No project data or RLS policies were changed.

Migration `20261103132801_api_connection_recovery.sql` adds a 60-second total
transaction limit and a 30-second idle transaction limit to the `authenticator`
login role, which is used by PostgREST. These limits allow the pool to replace
a stuck connection instead of retaining an open transaction indefinitely.
The existing 8-second statement limit is preserved. Database administration,
cron and direct background connections do not inherit these role defaults.

Apply the migration using the normal database deployment process, then run
`supabase/tests/api_connection_recovery_test.sql`. The migration also requests a
PostgREST schema/pool refresh so newly established connections use the limits.

For diagnosis, inspect `pg_stat_activity` for the PostgREST application and
correlate the first `57014` error with later `25P02` errors in the same session.
Inspect the original query timeout separately: the recovery limits bound the
impact of a failed connection but do not make an expensive query faster.

Emergency recovery for this specific read-only pool state:

```sql
select pid, pg_terminate_backend(pid) as recovered
from pg_stat_activity
where datname = current_database()
  and usename = 'authenticator'
  and application_name = 'PostgREST 14.5'
  and state = 'idle in transaction (aborted)'
  and query = 'BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY'
  and pid <> pg_backend_pid();
```

To roll back the additional limits, reset `transaction_timeout` and
`idle_in_transaction_session_timeout` on the `authenticator` role and request
a PostgREST schema reload. Do not disable RLS or grant additional table access
to address this connection state.

References: [Supabase connection management](https://supabase.com/docs/guides/database/connection-management)
and [PostgreSQL 17 client connection defaults](https://www.postgresql.org/docs/17/runtime-config-client.html).
