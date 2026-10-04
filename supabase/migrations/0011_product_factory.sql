-- Additive migration: all existing site IDs and analytics remain unchanged.
begin;
alter table public.sites
  add column product_code text unique check (product_code ~ '^P[0-9]{3,6}$'),
  add column market text not null default 'Global' check (market in ('Korea','English','Global')),
  add column primary_language text not null default 'en',
  add column level smallint not null default 1 check (level between 1 and 3),
  add column version text not null default '1.0',
  add column status text not null default 'LIVE' check (status in ('IDEA','SPEC','BUILD','LIVE','HOLD','KILL','SCALE')),
  add column launch_date date,
  add column github_repo text,
  add column deploy_url text,
  add column adsense_enabled boolean not null default false,
  add column adsense_mapping_key text,
  add constraint adsense_mapping_required check (not adsense_enabled or nullif(adsense_mapping_key,'') is not null);
-- v0.1: one verified AdSense site domain belongs to exactly one product.
create unique index sites_adsense_mapping_unique on public.sites (lower(adsense_mapping_key)) where adsense_mapping_key is not null;
create index sites_product_status_idx on public.sites(status);
alter table public.sync_runs drop constraint sync_runs_source_check;
alter table public.sync_runs add constraint sync_runs_source_check check (source in ('gsc','ga4','bing','adsense'));
alter table public.integration_status drop constraint integration_status_source_check;
alter table public.integration_status add constraint integration_status_source_check check (source in ('gsc','ga4','bing','adsense'));
create table public.ideas (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(title) between 1 and 200), problem text not null,
 target_user text not null default '', market text not null check (market in ('Korea','English','Global')),
 primary_language text not null default 'en', acquisition_channel text not null default '',
 repeat_usage_potential text not null default '', ad_potential text not null default '', premium_potential text not null default '',
 competition text not null default '', build_difficulty text not null default '', maintenance_risk text not null default '',
 level_candidate smallint not null default 1 check (level_candidate between 1 and 3),
 scores jsonb not null, opportunity_score integer not null check (opportunity_score between 0 and 100),
 evidence text not null default '', notes text not null default '',
 status text not null default 'IDEA' check (status in ('IDEA','SPEC','BUILD','LIVE','HOLD','KILL','SCALE')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index ideas_score_idx on public.ideas(opportunity_score desc);
create trigger ideas_updated before update on public.ideas for each row execute function public.set_updated_at();
create table public.factory_weeks (
 week_start date primary key check (extract(isodow from week_start)=1),
 product_id uuid references public.sites(id) on delete set null,
 notes text not null default '', hypothesis text not null default '', success_metric text not null default '',
 result text not null default '', decision text not null default '', updated_at timestamptz not null default now()
);
create trigger factory_weeks_updated before update on public.factory_weeks for each row execute function public.set_updated_at();
create table public.adsense_daily_metrics (
 product_id uuid not null references public.sites(id) on delete cascade,
 metric_date date not null, currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
 estimated_earnings numeric not null, impressions bigint not null check(impressions>=0), page_views bigint not null check(page_views>=0),
 ad_requests bigint not null check(ad_requests>=0), matched_ad_requests bigint not null check(matched_ad_requests>=0), clicks bigint not null check(clicks>=0),
 ctr numeric, rpm numeric, coverage numeric,
 mapping_key text not null, synced_at timestamptz not null default now(),
 primary key(product_id,metric_date)
);
create index adsense_daily_date_idx on public.adsense_daily_metrics(metric_date desc);
-- Match upstream's single-admin + mandatory MFA, read-only browser model.
do $$ declare t text; begin
 foreach t in array array['ideas','factory_weeks','adsense_daily_metrics'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy "admin select" on public.%I as permissive for select to authenticated using(public.is_portfolio_admin())',t);
  execute format('create policy "require aal2" on public.%I as restrictive for select to authenticated using((select auth.jwt()->>''aal'')=''aal2'')',t);
 end loop;
end $$;
-- Reconcile integrations atomically on both insert and update.
create or replace function public.seed_integration_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.integration_status(site_id,source,enabled) values
 (new.id,'gsc',new.gsc_property is not null),(new.id,'ga4',new.ga4_property_id is not null),
 (new.id,'bing',new.bing_site_url is not null),(new.id,'adsense',new.adsense_enabled and new.adsense_mapping_key is not null)
 on conflict(site_id,source) do update set enabled=excluded.enabled;
 return new;
end $$;
create trigger sites_reconcile_integrations after update of gsc_property,ga4_property_id,bing_site_url,adsense_enabled,adsense_mapping_key on public.sites for each row execute function public.seed_integration_status();
insert into public.integration_status(site_id,source,enabled) select id,'adsense',false from public.sites on conflict do nothing;
commit;
