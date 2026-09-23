-- Move the weekly digest trigger into the Supabase project so it is not
-- dependent on GitHub Actions schedule dispatch timing.
--
-- The two Vault secrets referenced below are provisioned during the
-- production rollout. Keeping the values in Vault means the cron command
-- never stores the project URL or scheduler credential in plain text.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'supabase_project_url'
  ) or not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'weekly_digest_cron_secret'
  ) then
    raise exception 'Supabase Cron requires supabase_project_url and weekly_digest_cron_secret Vault secrets';
  end if;

  if exists (select 1 from cron.job where jobname = 'weekly-gazette-digest') then
    perform cron.unschedule('weekly-gazette-digest');
  end if;

  perform cron.schedule(
    'weekly-gazette-digest',
    '0 14 * * 3',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_project_url') || '/functions/v1/send-weekly-digest',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'weekly_digest_cron_secret')
        ),
        body := '{}'::jsonb
      );
    $job$
  );

  if exists (select 1 from cron.job where jobname = 'weekly-gazette-digest-watchdog') then
    perform cron.unschedule('weekly-gazette-digest-watchdog');
  end if;

  perform cron.schedule(
    'weekly-gazette-digest-watchdog',
    '30 14 * * 3',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_project_url') || '/functions/v1/send-weekly-digest',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'weekly_digest_cron_secret')
        ),
        body := '{}'::jsonb
      );
    $job$
  );
end;
$$;
