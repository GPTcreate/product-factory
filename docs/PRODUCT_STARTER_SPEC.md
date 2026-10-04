# PRODUCT STARTER SPEC v0.1

P002 이후 신규 서비스를 반복 생산하기 위한 공통 최소 규격이다. 모든
서비스를 같은 프레임워크로 강제하지 않고 출시 준비와 측정만 표준화한다.

## 공통

Responsive web, 기본 error handling, 환경변수 분리, production build,
favicon/title/description, canonical, Open Graph, robots.txt,
sitemap.xml, GSC/Bing verification 준비, GA4, Factory 공통 이벤트
helper, secret client 노출 금지.

## Analytics Helper

공통 event naming: core_action, result_view, share, outbound_click,
signup, premium_view, checkout_start, purchase. 제품마다 필요한 이벤트만
사용하며 제품 고유 이벤트도 허용한다.

## Product Metadata

각 repository에 product_code, name, domain, market, primary_language,
level, version, status, core_action_name, launch_date를 구조화된
JSON/YAML 등으로 둔다. 향후 Factory 자동등록에 활용한다.

## SEO

Unique title/description, canonical, sitemap, robots, OG, 적합한
structured data. 다국어 제품은 i18n routing/hreflang을 설계한다. V1에서
번역을 강제하지 않지만 확장을 막는 하드코딩은 피한다.

## Level별

-   Level 1: 앱 DB 없음. Sheets/API/cron/crawler/serverless 허용.
-   Level 2: DB/migration/RLS/background jobs.
-   Level 3: 제품별 별도 아키텍처 설계.

## AdSense

광고형 V1은 핵심 UX를 방해하지 않도록 광고 위치를 설계하고 CLS를
최소화한다. 제품별 Factory attribution이 가능하도록 실제 AdSense 설정에
맞춰 매핑한다.

## Launch Checklist

Production deploy, domain/HTTPS, GA4 수신, core_action 확인, GSC,
sitemap, Bing, robots/canonical, OG, 404/500, mobile, secrets, Factory
Registry 등록, AdSense 대상이면 연결상태 기록.

## Definition of Done

핵심기능 사용 가능; production 배포; 모바일 사용 가능; Analytics 정상;
검색엔진 기본설정 완료; 치명적 오류 없음; Factory 등록; README에
실행/배포/환경변수 설명.

## 원칙

Starter를 만드는 데 제품보다 많은 시간을 쓰지 않는다. 두 제품 이상에서
반복되는 요소를 우선 공통화한다. 인증/DB/결제는 필요한 제품에만 넣는다.
