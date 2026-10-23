begin;

create table public.product_launch_checks (
 site_id uuid not null references public.sites(id) on delete cascade,
 item_key text not null check(item_key in ('core_flow','mobile','https','seo','sitemap','analytics','core_event','search','privacy','terms','contact','deployment','manual_sync','scheduled_sync')),
 status text not null default 'pending' check(status in ('pending','ready','waiting','not_applicable')),
 evidence_url text not null default '' check(length(evidence_url)<=2048),
 notes text not null default '' check(length(notes)<=5000),
 verified_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(site_id,item_key),
 check(status<>'ready' or length(trim(notes))>0 or length(evidence_url)>0)
);
create table public.product_tasks (
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null references public.sites(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 200),
 status text not null default 'todo' check(status in ('todo','doing','done','blocked')),
 priority text not null default 'normal' check(priority in ('high','normal','low')),
 owner text not null default '' check(length(owner)<=120),
 due_date date,
 week_start date check(week_start is null or extract(isodow from week_start)=1),
 evidence_url text not null default '' check(length(evidence_url)<=2048),
 notes text not null default '' check(length(notes)<=5000),
 updated_at timestamptz not null default now(),
 check(status<>'done' or length(trim(notes))>0 or length(evidence_url)>0)
);
create index product_tasks_site_updated on public.product_tasks(site_id,updated_at desc,id);
create index product_tasks_week on public.product_tasks(week_start) where week_start is not null;
create table public.product_review_goals (
 site_id uuid primary key references public.sites(id) on delete cascade,
 metric text not null check(metric in ('sessions','core_action','google_clicks','revenue')),
 target numeric not null check(target>0 and target<=1000000000000),
 window_days integer not null check(window_days between 7 and 90),
 minimum_days integer not null check(minimum_days between 1 and window_days),
 updated_at timestamptz not null default now()
);
create table public.product_reviews (
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null references public.sites(id) on delete cascade,
 period_start date not null,
 period_end date not null check(period_end>=period_start),
 metric text not null check(metric in ('sessions','core_action','google_clicks','revenue')),
 target numeric not null check(target>0),
 observed numeric check(observed>=0),
 coverage_days integer not null check(coverage_days>=0),
 suggestion text not null check(suggestion in ('INSUFFICIENT','IMPROVE','HOLD','SCALE')),
 decision text not null check(decision in ('HOLD','IMPROVE','SCALE','V2','DEFER')),
 notes text not null default '' check(length(notes)<=5000),
 reviewed_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index product_reviews_site_created on public.product_reviews(site_id,created_at desc);

do $$ declare t text; begin
 foreach t in array array['product_launch_checks','product_tasks','product_review_goals','product_reviews'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy "admin read" on public.%I for select to authenticated using ((select public.is_portfolio_admin()))',t);
  execute format('create policy "require aal2" on public.%I as restrictive for select to authenticated using ((select auth.jwt()->>''aal'')=''aal2'')',t);
 end loop;
 foreach t in array array['product_launch_checks','product_tasks','product_review_goals'] loop
  execute format('create trigger touch_updated before update on public.%I for each row execute function public.set_updated_at()',t);
 end loop;
end $$;

-- Copy only the existing Edge automation credential into the missing Vault slot.
-- No browser/user role can call this function or read the stored value.
create function public.prepare_factory_automation(p_secret text)
returns boolean language plpgsql security definer set search_path='' as $$
declare existing_secret text;
begin
 if p_secret is null or length(p_secret)<32 then raise exception 'Automation credential must contain at least 32 characters'; end if;
 perform pg_advisory_xact_lock(842991);
 select decrypted_secret into existing_secret from vault.decrypted_secrets where name='automation_secret';
 if found then return existing_secret=p_secret; end if;
 perform vault.create_secret(p_secret,'automation_secret');
 return true;
end;
$$;
revoke all on function public.prepare_factory_automation(text) from public,anon,authenticated;
grant execute on function public.prepare_factory_automation(text) to service_role;
revoke execute on function public.seed_integration_status() from public,anon,authenticated;

commit;
