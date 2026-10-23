begin;
create table public.operational_alerts (
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null references public.sites(id) on delete cascade,
 source text not null check(source in ('ga4','gsc','bing','adsense')),
 severity text not null check(severity in ('info','warning','critical')),
 message text not null,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 resolved_at timestamptz,
 acknowledged_at timestamptz,
 unique(site_id,source)
);
create index operational_alerts_open on public.operational_alerts(last_seen_at desc) where resolved_at is null;
alter table public.operational_alerts enable row level security;
revoke all on public.operational_alerts from public,anon,authenticated;
grant select on public.operational_alerts to authenticated;
grant all on public.operational_alerts to service_role;
create policy "admin read" on public.operational_alerts for select to authenticated using((select public.is_portfolio_admin()));
create policy "require aal2" on public.operational_alerts as restrictive for select to authenticated using((select auth.jwt()->>'aal')='aal2');

create function public.refresh_operational_alerts() returns void
language sql security definer set search_path='' as $$
 with candidates as (
 select i.site_id,i.source,
 case when i.last_status='failed' then 'critical' when i.last_status='partial' or (i.last_status='running' and i.last_attempt_at<now()-interval '30 minutes') or i.last_success_at<now()-make_interval(hours=>i.stale_after_hours) then 'warning' else 'info' end severity,
 case when i.last_status='failed' then 'Collection failed. Open the original Sync history error.' when i.last_status='partial' then 'Partial collection. Inspect missing breakdowns.' when i.last_status='running' and i.last_attempt_at<now()-interval '30 minutes' then 'Collection has been running for more than 30 minutes.' when i.last_success_at<now()-make_interval(hours=>i.stale_after_hours) then 'Stored data is outside the freshness window.' else 'No successful collection has been verified.' end message
 from public.integration_status i join public.sites s on s.id=i.site_id
 where s.is_active and i.enabled and (i.last_status in ('failed','partial') or (i.last_status='running' and i.last_attempt_at<now()-interval '30 minutes') or (i.last_status is distinct from 'running' and (i.last_success_at is null or i.last_success_at<now()-make_interval(hours=>i.stale_after_hours))))
 ), saved as (
 insert into public.operational_alerts(site_id,source,severity,message)
 select site_id,source,severity,message from candidates
 on conflict(site_id,source) do update set severity=excluded.severity,message=excluded.message,last_seen_at=now(),resolved_at=null,
 acknowledged_at=case when operational_alerts.resolved_at is not null or operational_alerts.message<>excluded.message or operational_alerts.severity<>excluded.severity then null else operational_alerts.acknowledged_at end
 returning id
 )
 update public.operational_alerts a set resolved_at=now()
 where a.resolved_at is null and not exists(select 1 from candidates c where c.site_id=a.site_id and c.source=a.source);
$$;
revoke all on function public.refresh_operational_alerts() from public,anon,authenticated,service_role;
select cron.schedule('product-factory-monitor','5 * * * *',$$select public.refresh_operational_alerts()$$);
commit;
