-- Optional: schedule the daily manager summary email.
-- Requires pg_cron and pg_net. Run only if you want Supabase to send the summary automatically every day.
-- Requires the maya_cron_secret Vault entry described in README.md.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- pg_cron runs in UTC. Invoke at both possible Israel 17:00 UTC offsets;
-- the Edge Function checks Asia/Jerusalem and sends only when the local hour is 17.
-- This keeps the schedule correct through daylight-saving changes without sending twice.
do $$
declare existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'daily-manager-summary-email'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'daily-manager-summary-email',
    '0 14,15 * * *',
    $job$select net.http_post(
      url := 'https://qopsdkmzvncamjrxjwni.supabase.co/functions/v1/daily-manager-summary',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', coalesce(
          (select decrypted_secret from vault.decrypted_secrets where name = 'maya_cron_secret' limit 1),
          ''
        )
      ),
      body := jsonb_build_object(
        'appUrl', 'https://infrastructure-tracker.vercel.app/app',
        'scheduled', true
      )
    );$job$
  );
end;
$$;
