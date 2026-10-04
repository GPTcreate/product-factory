-- AdSense daily refresh, UTC. Credential values remain in Vault.
create or replace function public.invoke_scheduled_sync(p_source text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if p_source not in ('gsc', 'ga4', 'bing', 'adsense') then
    raise exception 'Unknown sync source: %', p_source;
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'automation_secret';

  if v_url is null or v_secret is null then
    raise exception 'Missing Vault secret project_url or automation_secret';
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/scheduled-sync-' || p_source,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Automation-Secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

-- Only the scheduler (postgres) may invoke this - never the browser roles.
revoke all on function public.invoke_scheduled_sync(text) from public;
revoke all on function public.invoke_scheduled_sync(text) from anon, authenticated;


select cron.schedule('product-factory-sync-adsense','30 4 * * *',$$select public.invoke_scheduled_sync('adsense')$$);
