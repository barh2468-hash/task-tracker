-- Optional: schedule the daily manager summary email.
-- Requires pg_cron and pg_net. Run only if you want Supabase to send the summary automatically every day.
-- Important: replace PROJECT_REF and ANON_OR_SERVICE_KEY before running.

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
      'Authorization', 'Bearer ANON_OR_SERVICE_KEY'
    ),
    body := jsonb_build_object('appUrl', 'https://task-tracker-orcin-alpha.vercel.app')
  );
  $$
);
