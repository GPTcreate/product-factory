# PRODUCT FACTORY SPEC v0.1

## 목적

매주 하나의 디지털 서비스를 기획·출시하고 여러 제품의 검색, 유입,
광고수익, 상태를 한 곳에서 관리한다. 연 52개를 기본 cadence로 하되 최대
72개의 V1 실험을 수행한다. KPI는 제품 개수가 아니라 장기 성장 디지털
자산의 발견이다.

## 사업 모델

-   V1: 무료 가치 제공 → 사용자·검색 트래픽·재방문 확보 → AdSense 수익.
-   V2: 사용성과 재방문이 검증된 Winner에만 저장, 알림, 자동화, 개인화,
    고급분석, Premium/Subscription 추가.
-   시장: Korea / English / Global을 동등 평가. 국내 검증 후 해외 진출을
    필수 순서로 두지 않는다.
-   실패 제품은 HOLD/KILL하여 유지보수를 제한한다.

## Product Level

-   Level 1: 별도 앱 DB 없음. Google Sheets, 크롤러, API, AI, 스케줄러
    사용 가능. P001 IPOScore가 현재 해당.
-   Level 2: Supabase/Postgres 등 앱 DB 사용. 사용자
    데이터·히스토리·상태 저장.
-   Level 3: 복잡한 상태, 다중 외부시스템, 실시간 처리, 사용자 상호작용
    등 복합 서비스.

## 주간 Cycle

금요일 시장탐색/Idea×Market 평가 → 토\~일 경쟁·유입·반복사용·광고·V2
검토 및 SPEC 확정 → 월\~목 Codex 구현/테스트/SEO/Analytics/배포 → 목요일
LIVE → 출시 후 HOLD/KILL/IMPROVE/SCALE/V2 판단.

## P001

P001 / IPOScore / iposcore.kr / Level 1 / LIVE. GA4, GSC, Bing, AdSense
연결 후 Factory 첫 실데이터 검증 제품으로 편입한다.

## Dashboard Base

`jafforgehq/site-analytics-tool`을 fork하여 확장한다. 기존 Multi-site
analytics, GA4, Google Search Console, Bing Webmaster, Supabase,
scheduled/manual sync, sync history, stale detection, uptime, ranking,
anomaly/forecast, export, single-admin security는 최대한 보존한다.

Frontend는 원본 React/Vite를 우선 유지하고 Cloudflare Pages + Supabase를
기본으로 한다. 개별 제품 기술스택은 Factory와 독립한다.

## 메뉴

-   Overview: Products, 상태, Users, PV, Search, Ad Revenue, 성장/감소
    Alert, Week/72.
-   Products: 제품 목록과 KPI 비교.
-   Product Detail: Overview / Traffic / Search / Revenue / Events /
    Health.
-   Ideas: Idea Backlog와 Idea×Market 평가.
-   Factory: Current Week / Pipeline / Experiments.
-   System: Integrations / Sync / Settings.

## Product Registry

id, product_code, name, domain, market, primary_language, level,
version, status(IDEA/SPEC/BUILD/LIVE/HOLD/KILL/SCALE), launch_date,
github_repo, deploy_url, ga4_property_id, gsc_property, bing_site,
adsense_enabled, adsense_mapping_key, created_at, updated_at.

기존 `site_id` 전면 rename은 migration 위험을 평가한다. 필요하면 DB 내부
식별자는 유지하고 application domain에서 Product로 추상화한다.

## Analytics

GA4 기본 KPI: Users, New Users, Returning Users, Sessions, Views,
Engagement, Core Action. 공통 이벤트: core_action, result_view, share,
outbound_click, signup, premium_view, checkout_start, purchase. 제품
고유 이벤트 허용.

## Search

GSC: Clicks, Impressions, CTR, Average Position, Query, Landing Page,
Country, Device. Bing: 기존 integration 유지.

## AdSense --- v0.1 필수

계정 전체가 아니라 제품별 광고수익 attribution이 목표다.
`adsense_daily_metrics` 개념: date, product_id, estimated_earnings,
impressions/page_views, ad_requests, clicks, ctr, rpm, coverage,
synced_at. 파이프라인: AdSense Management API → Supabase Edge Function →
daily metrics → Dashboard. 실제 metric/dimension/filter 이름과 단위는
구현 시 현재 공식 API 정의를 확인해 확정한다. 제품별 귀속 dimension을
추측해 하드코딩하지 않는다.

## Ideas

title/problem, target_user, market/language, acquisition_channel,
repeat_usage_potential, ad_potential, premium_potential, competition,
build_difficulty, maintenance_risk, level_candidate, opportunity_score,
evidence/notes, status.

Opportunity Score v0.1: Utility 20, Organic acquisition 20, Repeat usage
20, Advertising/PV 10, V2 premium 10, Competition/differentiation 10,
Automated operation 5, One-week MVP 5 = 100.

## SEO / Launch Readiness

GA4, GSC, Bing, AdSense readiness, sitemap.xml, robots.txt, canonical,
title, description, Open Graph, favicon, 적합한 structured data, search
engine verification.

## v0.1 Scope

포함: fork/baseline, rebrand, Product Registry, 기존 GA4/GSC/Bing 보존,
AdSense, 제품별 광고수익, Business Overview, Ideas, Factory
Week/Pipeline, Sync/Health, Supabase migration, 테스트, Cloudflare 배포
가능 상태. 제외: Stripe/subscription, 복잡한 AI idea generator, 자동
PRD, Starter 자동생성, 팀 권한.

## Definition of Done

기존 analytics regression 없음; migration 재현 가능; Product CRUD;
GA4/GSC/Bing 연결; AdSense sync 또는 fixture E2E; 제품별 광고수익;
Overview KPI+Revenue; Ideas CRUD; Week/Pipeline; sync 오류 식별; secret
미커밋; README에 local/Supabase/API/Cloudflare 설정.

## 설계 원칙

Factory 개발이 실제 제품 출시보다 커지지 않게 한다. 기존 정상기능을 이유
없이 재작성하지 않는다. GitHub가 source of truth다. Secret은 환경변수로
관리한다. 개별 제품은 Factory 스택에 종속되지 않는다. 반복되기 전 과도한
공통화를 피한다.
