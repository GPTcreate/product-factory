// Executes real migration SQL in embedded Postgres. Only hosted infrastructure
// (GoTrue auth helpers, Vault, pg_cron, pg_net) is stubbed; RLS and SQL are real.
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
const sql = (q) => db.exec(q);
await sql(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key); create table auth.mfa_factors(id uuid,user_id uuid,status text);
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
grant usage on schema auth to authenticated; grant execute on all functions in schema auth to authenticated;
create schema vault; create table vault.decrypted_secrets(name text,decrypted_secret text);
create schema cron; create table cron.job(jobname text primary key,schedule text,command text,active boolean default true);
create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.job values($1,$2,$3,true) on conflict(jobname) do update set schedule=$2,command=$3;return 1;end$$;
create function cron.unschedule(text) returns boolean language plpgsql as $$begin delete from cron.job where jobname=$1;return true;end$$;
create schema net; create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;`);
const files = (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();
for (const file of files) {
  const text = (await readFile("supabase/migrations/" + file, "utf8")).replace(
    /^create extension if not exists (pg_cron|pg_net);$/gm,
    "-- Infrastructure extension stubbed in this test",
  );
  await sql(text);
  console.log("migration", file, "OK");
}
const id = "11111111-1111-4111-8111-111111111111",
  admin = "22222222-2222-4222-8222-222222222222";
await sql(`insert into auth.users values('${admin}');insert into private.admin_users(user_id) values('${admin}');set role service_role;
insert into public.sites(id,name,domain,website_url,product_code,status,market,adsense_enabled,adsense_mapping_key) values('${id}','IPOScore','iposcore.kr','https://iposcore.kr','P001','LIVE','Korea',true,'iposcore.kr');`);
assert.equal(
  (await db.query("select * from public.integration_status")).rows.length,
  4,
);
await sql(
  `update public.sites set name='IPOScore updated',status='SCALE' where id='${id}';`,
);
assert.equal(
  (await db.query(`select status from public.sites where id='${id}'`)).rows[0]
    .status,
  "SCALE",
);
await assert.rejects(() =>
  sql(
    `insert into public.sites(name,domain,website_url,product_code) values('Duplicate','other.kr','https://other.kr','P001');`,
  ),
);
await assert.rejects(() =>
  sql(
    `insert into public.sites(name,domain,website_url,adsense_mapping_key) values('Duplicate','other.kr','https://other.kr','iposcore.kr');`,
  ),
);
await sql(`insert into public.ideas(title,problem,market,scores,opportunity_score) values('Test idea','Test problem','Korea','{}',50);
update public.ideas set title='Edited idea';
insert into public.factory_weeks(week_start,product_id,hypothesis) values('2026-10-05','${id}','Demand test') on conflict(week_start) do update set hypothesis=excluded.hypothesis;
insert into public.adsense_daily_metrics(product_id,metric_date,currency_code,estimated_earnings,impressions,page_views,ad_requests,matched_ad_requests,clicks,mapping_key) values('${id}','2026-10-01','USD',2,100,100,200,100,3,'iposcore.kr');
insert into public.adsense_daily_metrics(product_id,metric_date,currency_code,estimated_earnings,impressions,page_views,ad_requests,matched_ad_requests,clicks,mapping_key) values('${id}','2026-10-01','USD',3,100,100,200,100,3,'iposcore.kr') on conflict(product_id,metric_date) do update set estimated_earnings=excluded.estimated_earnings;`);
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from public.adsense_daily_metrics",
    )
  ).rows[0].n,
  1,
);
assert.equal(
  Number(
    (
      await db.query(
        "select estimated_earnings from public.adsense_daily_metrics",
      )
    ).rows[0].estimated_earnings,
  ),
  3,
);
await assert.rejects(() =>
  sql(
    `update public.sites set adsense_mapping_key='other.kr' where id='${id}';`,
  ),
);
const protectedTables = [
  "sites",
  "ideas",
  "factory_weeks",
  "adsense_daily_metrics",
];
for (const [sub, aal, allowed] of [
  [admin, "aal1", false],
  ["33333333-3333-4333-8333-333333333333", "aal2", false],
  [admin, "aal2", true],
]) {
  await sql(
    `reset role;set role authenticated;set request.jwt.claims='${JSON.stringify({ sub, aal })}';`,
  );
  for (const t of protectedTables) {
    const count = (await db.query(`select count(*)::int n from public.${t}`))
      .rows[0].n;
    assert.equal(count > 0, allowed, `${t}: ${sub}/${aal}`);
  }
  await assert.rejects(() =>
    sql(
      "insert into public.ideas(title,problem,market,scores,opportunity_score) values('Forbidden','x','Korea','{}',0);",
    ),
  );
}
await sql(`reset role;set role anon;`);
await assert.rejects(() =>
  db.query("select * from public.adsense_daily_metrics"),
);
await sql(
  `reset role;set role service_role;delete from public.ideas;delete from public.sites where id='${id}';`,
);
assert.equal(
  (await db.query("select count(*)::int n from public.adsense_daily_metrics"))
    .rows[0].n,
  0,
);
assert.equal(
  (await db.query("select product_id from public.factory_weeks")).rows[0]
    .product_id,
  null,
);
await sql("reset role;");
assert.equal(
  (
    await db.query(
      "select count(*)::int n from cron.job where jobname='product-factory-sync-adsense'",
    )
  ).rows[0].n,
  1,
);
await db.close();
console.log(
  "PASS: 13 migrations; Product/Ideas CRUD; weekly records; AdSense idempotency, attribution guard and cascades; admin + MFA RLS; no browser writes; cron registration.",
);
