begin;
create table public.analytics_extended_daily (
 site_id uuid not null references public.sites(id) on delete cascade, metric_date date not null,
 new_users bigint not null, returning_users bigint not null, engagement_seconds numeric not null,
 updated_at timestamptz not null default now(), primary key(site_id,metric_date)
);
create table public.analytics_event_daily (
 site_id uuid not null references public.sites(id) on delete cascade, metric_date date not null,
 event_name text not null, event_count bigint not null, updated_at timestamptz not null default now(),
 primary key(site_id,metric_date,event_name)
);
create table public.search_audience_daily (
 site_id uuid not null references public.sites(id) on delete cascade, metric_date date not null,
 dimension text not null check(dimension in ('country','device')), value text not null,
 clicks bigint not null, impressions bigint not null, ctr numeric, average_position numeric,
 updated_at timestamptz not null default now(),primary key(site_id,metric_date,dimension,value)
);
do $$ declare t text; begin
 foreach t in array array['analytics_extended_daily','analytics_event_daily','search_audience_daily'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy "admin select" on public.%I as permissive for select to authenticated using(public.is_portfolio_admin())',t);
  execute format('create policy "require aal2" on public.%I as restrictive for select to authenticated using((select auth.jwt()->>''aal'')=''aal2'')',t);
  execute format('create index on public.%I(metric_date)',t);
 end loop;
end $$;
-- Changing a mapping after revenue exists would mix two attribution histories.
create function public.guard_adsense_mapping() returns trigger language plpgsql set search_path='' as $$
begin
 if old.adsense_mapping_key is distinct from new.adsense_mapping_key and exists(select 1 from public.adsense_daily_metrics where product_id=old.id) then
  raise exception 'AdSense mapping has historical revenue; use a reviewed data migration to change attribution';
 end if;
 return new;
end $$;
create trigger sites_guard_adsense_mapping before update of adsense_mapping_key on public.sites for each row execute function public.guard_adsense_mapping();
commit;
