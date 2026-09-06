-- Optional: schedule the daily manager summary email.
-- Requires pg_cron and pg_net. Run only if you want Supabase to send the summary automatically every day.
-- Important: replace PROJECT_REF and APP_URL before running. Before scheduling,
-- create the maya_cron_secret Vault entry described in README.md.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Runs every day at 18:00 UTC. For Israel time, adjust as needed.
-- Example Israel 18:00 winter is 16:00 UTC, summer is 15:00 UTC.
select cron.schedule(
  'daily-manager-summary-email',
  '0 16 * * *',
  $$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/daily-manager-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'maya_cron_secret' limit 1),
        ''
      )
    ),
    body := jsonb_build_object('appUrl', 'APP_URL')
  );
  $$
);
