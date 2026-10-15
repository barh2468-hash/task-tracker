-- Hourly trigger for the vehicle-alerts Edge Function. The function itself
-- only acts at 07:xx Israel time on Sunday-Thursday and de-duplicates against
-- existing notifications, so extra invocations are harmless.
-- Uses the same Vault secret (maya_cron_secret) as the other scheduled jobs.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'vehicle-alerts-daily'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'vehicle-alerts-daily',
    '0 * * * *',
    $job$select net.http_post(
      url := 'https://qopsdkmzvncamjrxjwni.supabase.co/functions/v1/vehicle-alerts',
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
