-- Send managers a status-change summary at 17:00 Israel time every day.
-- Israel alternates between UTC+2 and UTC+3, so pg_cron invokes the Edge
-- Function at both possible UTC hours. The function sends only when the local
-- Asia/Jerusalem time is exactly 17:00.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'daily-status-summary-email'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'daily-status-summary-email',
    '0 14,15 * * *',
    $job$select net.http_post(
      url := 'https://qopsdkmzvncamjrxjwni.supabase.co/functions/v1/daily-status-summary',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', coalesce(
          (select decrypted_secret from vault.decrypted_secrets where name = 'maya_cron_secret' limit 1),
          ''
        )
      ),
      body := '{}'::jsonb
    );$job$
  );
end;
$$;
