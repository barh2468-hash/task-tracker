-- Replace the previously unauthenticated attendance reminder job with a job
-- that reads its shared secret from Supabase Vault at invocation time.
--
-- Before applying this migration, create a Vault secret named
-- maya_cron_secret and set the same value as the CRON_SECRET Edge Function
-- secret. If the Vault secret is absent, the request deliberately carries an
-- empty value and the Edge Function rejects it with HTTP 401.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'attendance-check-in-reminders'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'attendance-check-in-reminders',
    '*/5 * * * *',
    $job$select net.http_post(
      url := 'https://qopsdkmzvncamjrxjwni.supabase.co/functions/v1/attendance-reminder',
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
