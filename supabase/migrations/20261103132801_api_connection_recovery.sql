-- PostgREST pooled connections were reused in an aborted transaction after
-- statement timeouts, returning 25P02 even for BEGIN on subsequent requests.
-- Scope the recovery limits to the Data API login role. Normal API statements
-- already have an 8s timeout; background database/cron connections are untouched.
alter role authenticator set transaction_timeout = '60s';
alter role authenticator set idle_in_transaction_session_timeout = '30s';

-- Refresh PostgREST's cache/pool so new connections inherit the role defaults.
notify pgrst, 'reload schema';
