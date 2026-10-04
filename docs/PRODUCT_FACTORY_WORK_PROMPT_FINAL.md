# Product Factory v0.1 --- Work 실행 지시

이 작업은 첨부된 **4개 문서를 하나의 문서 세트로 사용**한다. 먼저 아래
순서와 역할을 이해한 뒤 작업한다.

## 1. 문서 읽는 순서와 역할

### ① `PRODUCT_FACTORY_WORK_PROMPT_FINAL.md`

현재 문서. **Work의 작업 방식과 전체 실행 지시서**다.\
먼저 읽고, 어떤 순서로 다른 문서를 참고하고 어떻게 작업할지 결정한다.

### ② `PRODUCT_FACTORY_SPEC.md`

**최상위 제품/시스템 요구사항(Source of Truth)** 이다.\
무엇을 왜 만드는지, v0.1 범위, 데이터/화면/AdSense/Analytics/Factory
요구사항을 정의한다.

### ③ `CODEX_BUILD.md`

SPEC을 실제 코드로 구현하기 위한 **개발 실행 순서와 품질 기준**이다.\
구현할 때 체크리스트처럼 사용한다.

### ④ `PRODUCT_STARTER_SPEC.md`

현재 Dashboard 자체의 핵심 구현 명세가 아니라, **향후 P002 이후 신규
서비스를 반복 생산하기 위한 Starter 규격**이다.\
Product Factory v0.1이 완성된 뒤 다음 제품 생산에 사용한다. 현재
Dashboard 구현 때문에 Starter를 과도하게 개발하지 않는다.

## 2. 문서 우선순위

내용이 충돌하면 다음 순서로 판단한다.

`PRODUCT_FACTORY_SPEC.md` \> `PRODUCT_FACTORY_WORK_PROMPT_FINAL.md` \>
`CODEX_BUILD.md` \> `PRODUCT_STARTER_SPEC.md`

단, 현재 문서의 **GitHub 계정 확인 지시와 사용자 승인 방식은 반드시
따른다.**

문서 내용을 다시 요약하는 데 시간을 쓰지 말고, 이해한 뒤 실제 구현에
사용한다.

------------------------------------------------------------------------

# GitHub 계정 --- 작업 전 반드시 확인

개발에 사용할 GitHub 계정은 **`hanmanju88@gmail.com`으로 로그인하는
GitHub 계정**이다.

GitHub 작업을 시작하기 전에 현재 연결/인증된 GitHub 계정이 이 이메일로
로그인하는 개발용 계정인지 확인한다.

-   올바른 계정임이 확인되면 계속 진행한다.
-   다른 계정이거나 확인할 수 없으면 **fork, repository 생성, push 등
    쓰기 작업을 하지 않는다.**
-   이 경우 사용자에게 올바른 GitHub 계정 연결/로그인을 요청한다.
-   이메일 주소를 GitHub username이라고 가정하지 않는다.
-   실제 username은 인증된 GitHub 계정에서 확인한다.

사용자가 미리 fork/clone/repository 생성을 할 필요는 없다.

올바른 계정 확인 후 Work가 직접 `jafforgehq/site-analytics-tool`을
fork하여 Product Factory repository를 준비한다. Fork가 기술적으로
불가능한 경우에만 안전한 import/clone 대안을 선택한다.

GitHub를 Source of Truth로 사용한다. 원본 MIT License/attribution을
유지한다.

------------------------------------------------------------------------

# 목표

`jafforgehq/site-analytics-tool`을 기반으로 개인용 **Product Factory
Dashboard v0.1**을 실제 구축한다.

연간 52\~72개의 웹서비스를 반복 출시하면서 다음을 통합 관리하는 Control
Center다.

-   Products / Portfolio
-   GA4
-   Google Search Console
-   Bing Webmaster
-   Google AdSense
-   제품별 광고수익
-   검색/트래픽 성장
-   Ideas
-   주간 Product Pipeline
-   IDEA / SPEC / BUILD / LIVE / HOLD / KILL / SCALE

------------------------------------------------------------------------

# 사용자 역할

사용자는 개발 세부사항을 판단하지 않는다. 가능한 한 **승인 / 거절 / A·B
선택**만 한다.

폴더구조, 라이브러리, DB index, UI 세부구현, migration, retry/error
handling, 테스트 등 일반적인 기술 선택은 best practice와 첨부 SPEC을
기준으로 스스로 결정하고 계속 진행한다.

다음 경우에만 사용자에게 요청한다.

1.  비용 발생
2.  데이터 삭제
3.  중요한 보안/권한 변경
4.  GitHub/Supabase/Google/Cloudflare 계정 승인
5.  요구사항 충돌로 제품 방향이 달라지는 경우

결정이 필요하면 길게 설명하지 말고 다음 형식을 사용한다.

**결정 필요**\
A. 권장안\
B. 대안\
**추천: A**\
이유: 1\~2문장

------------------------------------------------------------------------

# 구현 핵심

먼저 원본 repository를 분석하고 정상 baseline을 확보한 뒤 수정한다.

기존의 다음 기능은 최대한 보존한다.

-   GA4
-   Google Search Console
-   Bing Webmaster
-   Supabase
-   scheduled/manual sync
-   sync history
-   stale detection
-   uptime
-   search ranking
-   anomaly/forecast
-   export
-   single-admin security

추가/변경 핵심:

-   Site → Product domain 확장
-   Product Code / Market / Language / Level / Version / Status
-   Portfolio Business Overview
-   Products / Product Detail
-   Ideas Registry + Opportunity Score
-   Factory Week / 72 + Pipeline
-   **AdSense Management API**
-   **제품별 광고수익 attribution**
-   Supabase migrations/RLS
-   Sync/error/health 유지

P001은 다음 상태로 등록 가능하게 한다.

`P001 / IPOScore / iposcore.kr / Level 1 / LIVE`

GA4/GSC/Bing/AdSense credential은 준비되는 시점에 연결할 수 있게 한다.

------------------------------------------------------------------------

# AdSense

AdSense는 v0.1 필수다.

현재 공식 AdSense Management API의 인증, metrics, dimensions, filters를
확인한 후 구현한다. API field를 추측하지 않는다.

기존 GA4/GSC/Bing sync 패턴을 최대한 재사용하여 Supabase에 일별 데이터를
저장하고 제품별 Earnings/RPM/Clicks/Impressions 등을 Dashboard에서 볼 수
있게 한다.

Manual + Scheduled Sync, idempotent upsert, error logging을 지원한다.

------------------------------------------------------------------------

# 하지 않을 것

v0.1에서 다음은 만들지 않는다.

-   Stripe / Subscription
-   AI Idea Generator
-   자동 PRD Generator
-   Product Starter 자동생성
-   팀 기능
-   불필요한 Microservice/Infrastructure

Factory 자체 개발이 실제 제품 생산보다 커지지 않게 한다.

------------------------------------------------------------------------

# 품질 및 보안

각 주요 단계에서 lint/typecheck/test/build를 수행한다.

기존 GA4/GSC/Bing/sync/uptime/ranking/export 기능 regression을 확인한다.

Secret은 repository에 commit하지 않는다. Service-role credential은
browser에 노출하지 않는다.

------------------------------------------------------------------------

# 완료 조건

-   Product Factory 실행
-   Supabase migration 재현
-   Product CRUD
-   Ideas CRUD
-   Factory Pipeline
-   기존 GA4/GSC/Bing 기능 유지
-   AdSense integration
-   제품별 광고수익
-   Portfolio Overview
-   Sync/error 확인
-   테스트/build 성공
-   Cloudflare 배포 가능
-   README/설정문서 완료

계획만 작성하고 멈추지 않는다. 권한상 가능한 범위까지 **실제 구현 →
테스트 → 문서화 → 배포 준비**를 진행한다.

사용자에게는 의미 있는 단계가 완료됐거나 계정 승인/중요 의사결정이
필요할 때만 간단히 보고한다.
