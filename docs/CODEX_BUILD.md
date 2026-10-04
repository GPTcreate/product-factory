# CODEX BUILD --- PRODUCT FACTORY v0.1

기준 요구사항은 `PRODUCT_FACTORY_SPEC.md`이며 충돌 시 SPEC이 우선한다.

## 원칙

원본을 먼저 실행하고 구조를 이해한다. 기존 GA4/GSC/Bing/sync를
불필요하게 재작성하지 않는다. 작은 단계로 변경한다. Migration 호환성을
우선한다. Secret commit 금지. 외부 API 필드는 공식 정의 확인 후
구현한다. 각 단계 후 lint/typecheck/test/build를 수행한다.

## 구현 순서

1.  `jafforgehq/site-analytics-tool` fork 및 baseline 실행/테스트.
2.  Product Factory로 rebrand. MIT attribution 유지.
3.  Site 모델을 Product domain으로 확장. product_code, market, language,
    level, version, status, launch_date, repo, deploy URL, AdSense 필드
    추가.
4.  Navigation: Overview / Products / Ideas / Factory / System.
5.  Overview를 사업 포트폴리오 중심으로 변경. `0`, `No Data`,
    `Not Connected`를 구분.
6.  Ideas CRUD와 Opportunity Score 구현. AI 생성은 제외.
7.  Factory: Week/72, 현재 제품, IDEA→SPEC→BUILD→LIVE, Pipeline, notes.
    Workflow engine은 만들지 않는다.
8.  AdSense Management API 현재 인증/보고서/metrics/dimensions/filter를
    공식 정의로 확인.
9.  `adsense_daily_metrics` migration 작성. 기존 sync pattern을
    재사용하여 manual/scheduled sync, idempotent upsert, retry/error
    log, sync history 구현.
10. Product Detail \> Revenue 및 Overview 총 광고수익/제품별 ranking
    구현.
11. 기존 GA4/GSC/Bing/manual+scheduled
    sync/stale/error/uptime/ranking/export regression 테스트.
12. 신규 table RLS, service-role server only, `.env.example`에는
    변수명만.
13. README/docs에 local, Supabase, migration, GA4, GSC, Bing, AdSense,
    Cloudflare, scheduler, P001 연결 절차 작성.
14. 배포 검증.

## 최소 테스트

Product CRUD/schema, Ideas CRUD, Opportunity Score, AdSense response
mapping, idempotent upsert, no-data/not-connected UI,
lint/typecheck/build.

## 완료 보고

변경 파일, migrations, 신규 env vars, 사용자가 외부 콘솔에서 할 설정,
테스트 결과, known issues, P001 연결에 필요한 값, 다음 추천작업을
보고한다.
