# 제품 제작과 Product Factory 연결 가이드

새 제품을 기획하고 구현할 때 준비할 정보, 측정 이벤트, 검색 등록, Factory 등록과 Sync 검증을 정리한다. 제품 개발 담당자는 착수 전에 이 가이드를 읽고 [제품별 준비 기록 템플릿](templates/PRODUCT_ONBOARDING_TEMPLATE.md)을 해당 제품 저장소에 복사해 채운다.

**제품 → GA4·검색·광고 서비스에 측정값 전송 → Factory가 공급자 API에서 지표 수집 → 제품별 Dashboard에서 확인**하는 흐름이다. 제품 등록, 공급자 접근권한, 수동 수집 성공, 예약 수집 성공은 각각 확인한다.

기준: 2026-10-08, Factory 소스 `e5aea0d1cc2b6a0b7ba3bd23848091a9cef9df77`. 이 가이드는 기존 [Starter 최소 규격](PRODUCT_STARTER_SPEC.md)의 실행 절차를 보완한다.

## 1 제작과 연결의 진행 순서

| 단계         | 제품 담당자가 준비할 것                                    | 완료를 확인하는 방법                            |
| ------------ | ---------------------------------------------------------- | ----------------------------------------------- |
| 기획         | 제품 코드, 대상 사용자, 핵심 행동, 시장·언어, 성공 지표    | 제품별 준비 기록에 가설과 판단 기준 기재        |
| 구현         | 독립 저장소, 환경 분리, 핵심 기능, 이벤트, SEO·정책 페이지 | 로컬 핵심 흐름과 모바일 확인                    |
| 측정 준비    | 제품용 GA4 Property·측정 ID, GSC/Bing 속성, 필요한 권한    | 태그 수신과 계정의 보고서 접근을 각각 확인      |
| 출시         | 운영 도메인·HTTPS, 배포 URL·commit, 운영 설정              | 운영 주소에서 실제 핵심 행동과 이벤트 수신 확인 |
| Factory 등록 | 제품 정보와 검증한 공급자 식별자                           | Products에 제품 1개 등록, integration 상태 확인 |
| 수동 Sync    | 공급자별 첫 실행과 동일 기간의 원본 보고서                 | run ID·저장 행·Dashboard를 대조                 |
| 예약 운영    | 기존 공통 인증·job 준비, 제품 Active 상태                  | 예정 실행의 scheduled run과 갱신 지표 확인      |

AdSense 심사 등 대기 항목은 사유·담당자·다음 확인 조건을 남긴다. 제품 출시 준비와 모든 공급자의 연결 완료를 따로 기록한다.

## 2 공통 운영 설정과 제품별 준비

### Factory 운영자가 공통으로 준비하는 항목

기존 관리자 대시보드, Cloudflare Pages, Supabase 프로젝트와 Edge Function을 재사용한다. 제품 하나를 추가할 때 Factory를 새로 만들거나 migration·함수 배포를 반복할 필요는 없다.

| 공통 항목                | 사용하는 곳                  | 제품 추가 시 확인                                                 |
| ------------------------ | ---------------------------- | ----------------------------------------------------------------- |
| 관리자 계정·MFA          | Factory 로그인과 관리 요청   | 운영자가 기존 관리자 권한으로 접근 가능한지                       |
| Google OAuth와 읽기 권한 | GA4·GSC·AdSense 서버 수집    | 기존 인증의 Google 계정이 새 제품의 속성·보고서에도 접근 가능한지 |
| Bing 보고서 인증         | Bing 서버 수집               | 기존 인증 계정이 새 사이트에 접근 가능한지                        |
| 예약 호출 인증·job       | Supabase의 예약 수집         | 기존 인증과 job이 준비되고 실제 예정 실행이 검증됐는지            |
| Factory CORS·Auth URL    | 관리자 앱의 서버 호출·로그인 | Factory가 실행되는 origin이 허용되는지                            |

현재 코드는 Google OAuth 자격증명 한 세트, Bing API key 한 개, AdSense 계정 resource 한 개를 서버에서 공통으로 읽는다. 제품마다 다른 계정의 Secret을 Registry에 저장하는 기능은 없다. 제품별 권한을 공통 인증 계정에 부여할 수 있는지 먼저 확인한다.

소비자 제품의 도메인을 Factory의 CORS에 추가할 필요는 없다. 소비자 제품은 측정 태그를 통해 공급자에 데이터를 보내고, 관리자는 Factory에서 Sync를 실행한다.

### 각 제품을 만들 때 준비하는 항목

- 고유 제품 코드와 독립 저장소, 사용자 문제·핵심 기능·성공 지표.
- 운영 도메인·배포 URL·출시일·배포 commit.
- GA4 측정 ID와 숫자 Property ID, 태그 수신 증거.
- GSC 속성과 Bing 사이트의 정확한 식별자, 소유권·보고서 접근 확인.
- 광고를 쓰면 AdSense 상태와 실제 검증된 도메인 매핑.
- 기능과 데이터 흐름에 맞는 정책 페이지·연락처, 운영 인계 기록.

## 3 기획과 저장소 구성

V1의 핵심 행동을 하나 정한다. 예를 들어 계산기는 계산 완료, 검색 서비스는 유효한 결과 조회, 비교 서비스는 비교 결과 생성이 핵심 행동이다. 개발 전에 무엇을 성공으로 볼지 정하고 측정 이벤트와 연결한다.

Factory의 React/Vite 스택은 개별 제품에 강제하지 않는다. Level 1은 앱 DB를 사용하지 않는 구조이며 Sheets·API·크롤러·cron·serverless를 사용할 수 있다. Level 2는 제품 DB·migration·접근 제어·백그라운드 처리를 준비하고, Level 3은 제품별 아키텍처를 별도로 설계한다.

각 제품 저장소에는 다음 정보를 남긴다. 파일명은 제품의 기존 구조에 맞춰도 된다.

| 파일 또는 위치                         | 기록할 내용                                               |
| -------------------------------------- | --------------------------------------------------------- |
| `README.md`                            | 로컬 실행, 테스트, 빌드·배포, 필요한 환경변수 이름        |
| `product.json` 또는 기존 metadata 파일 | 제품 코드·시장·언어·레벨·버전·상태·도메인·핵심 행동       |
| `PRODUCT_ONBOARDING.md`                | 제품별 준비 기록, 공급자 식별자·권한 상태, 출시·Sync 증거 |
| `.env.example`                         | 실제 Secret을 제외한 변수 이름과 용도                     |
| 제품의 문서 폴더                       | 핵심 기능 범위, 이벤트 정의, 배포·복구 방법, 데이터 출처  |

metadata 파일은 현재 수동 등록을 위한 인계 자료다. Factory의 자동 manifest import 기능은 구현돼 있지 않다. [`product.json` 예시](#12-제품-metadata-예시)는 제안 형식이며 현재 서버 API의 요청 스키마와 구분한다.

## 4 제품 안에 구현할 측정과 검색 준비

### GA4 태그와 핵심 이벤트

사이트에는 웹 스트림의 Measurement ID인 `G-…`를 사용한다. Factory에는 Data API용 숫자 Property ID를 등록한다. 두 값은 제품별 준비 기록에 각각 적는다. [Google의 Property ID 설명](https://developers.google.com/analytics/devguides/reporting/data/v1/property-id).

현재 Factory는 등록된 GA4 Property 전체의 보고서를 읽으며 제품 도메인별 필터를 적용하지 않는다. **새 제품은 제품별 Property 분리를 기본으로 준비한다.** 기존 Property에 다른 제품의 데이터가 함께 들어 있다면 그 범위를 먼저 확인한다. 이벤트에 `product_code`를 붙이는 것만으로 Factory의 보고서 귀속이 분리되지는 않는다.

운영 태그와 개발·Preview 측정을 구분한다. 태그 중복 설치와 SPA의 중복 page view를 확인하고, 제품이 정한 동의·추적 설정에 맞춰 태그를 초기화한다.

| 공통 이벤트                  | 구현할 시점                            | 적용 대상                    |
| ---------------------------- | -------------------------------------- | ---------------------------- |
| `core_action`                | 핵심 처리가 성공했을 때                | 모든 제품의 핵심 행동        |
| `result_view`                | 사용 가능한 결과가 실제로 표시됐을 때  | 결과 화면이 있는 제품        |
| `share`                      | 제품이 정의한 공유 완료 또는 실행 시점 | 공유 기능이 있는 제품        |
| `outbound_click`             | 외부 출처·제휴·관련 링크를 열 때       | 외부 링크 사용을 측정할 제품 |
| `signup`                     | 가입·구독 신청이 성공했을 때           | 해당 기능이 있는 제품        |
| `premium_view`               | 유료 기능 설명을 확인할 때             | 해당 기능이 있는 제품        |
| `checkout_start`, `purchase` | 결제 시작·성공 시점                    | 결제를 실제 구현한 제품      |

공통 이름은 이 프로젝트의 이벤트 계약이다. Google이 권장하는 상거래 이벤트와 매개변수는 해당 제품의 구현 시 별도로 맞춘다. 버튼 클릭을 처리 성공과 동일하게 집계하지 않으며, 재렌더링으로 같은 완료 이벤트가 반복되지 않도록 한다.

이벤트 정의에는 발생 조건, 중복 방지 방식, 허용할 매개변수를 적는다. 이메일·원문 입력·인증 토큰 등은 분석 이벤트에 넣지 않는다. 제품의 URL query에도 이런 값이 들어가는지 확인한다.

Google tag 또는 GTM으로 이벤트를 보내고 Realtime·DebugView에서 수신을 확인한다. 현재 Factory는 일별 이벤트 **이름과 횟수**를 수집하며 임의 매개변수별 분석은 제공하지 않는다. [Google 이벤트 설정 가이드](https://developers.google.com/analytics/devguides/collection/ga4/events).

### 검색과 공개 페이지

- 페이지별 title·description, canonical, Open Graph, favicon을 준비한다.
- 공개 운영 페이지의 `robots.txt`·sitemap·HTTP 응답·noindex 상태를 확인한다.
- GSC와 Bing의 소유권 검증에 필요한 DNS·파일·메타 태그를 유지한다.
- 다국어 제품이면 언어별 URL과 hreflang을 설계한다.
- Factory 관리자 앱의 `noindex, nofollow` 설정을 소비자 제품에 그대로 복사하지 않는다.

GSC 속성을 만들고 sitemap을 제출하는 것은 보고서 데이터가 즉시 생긴다는 뜻이 아니다. 검색 노출 전에는 데이터 없음 상태가 정상일 수 있다.

### 기능에 맞는 정책과 연락처

Starter 기준으로 Privacy·Terms·Contact와 footer 링크를 준비한다. 광고, 뉴스레터, 계정, AI 처리, 결제를 실제로 쓰는지에 따라 해당 데이터 흐름과 사업자를 기록한다. 동의·쿠키 설정은 대상 시장과 실제 추적 방식에 맞춰 검토한다. 사용하지 않는 기능의 조항이나 실제로 지킬 수 없는 보관·삭제 약속을 넣지 않는다.

## 5 공급자별 연결에 필요한 정보

| 공급자  | 제품에서 준비할 것                          | Factory에 입력할 값                              | 운영자 측 조건                                   |
| ------- | ------------------------------------------- | ------------------------------------------------ | ------------------------------------------------ |
| GA4     | 제품 태그, 웹 스트림·측정 ID, 이벤트 수신   | 숫자 `ga4_property_id`                           | Analytics Data API와 해당 Property의 보고서 접근 |
| GSC     | 실제 속성, 소유권 검증, sitemap             | 정확한 `gsc_property`                            | Search Console API와 해당 속성 접근              |
| Bing    | 등록·검증된 사이트, 검색 설정               | 정확한 `bing_site_url`                           | 기존 Bing API 인증의 사이트 접근                 |
| AdSense | 광고 사용 여부, 승인 상태, 실제 사이트 등록 | `adsense_mapping_key`, 연결 시 `adsense_enabled` | AdSense API·보고서 권한, 공통 계정·통화 설정     |

GSC는 도메인 속성의 `sc-domain:example.com` 또는 URL-prefix 속성의 `https://example.com/`처럼 실제 서비스가 반환하는 식별자를 사용한다. 속성이 여러 제품을 포함하면 그 전체 범위가 수집될 수 있으므로 제품 범위와 맞춘다. [Search Console API의 속성·권한 계약](https://developers.google.com/webmaster-tools/v1/searchanalytics/query).

Bing은 현재 코드가 API key 방식의 보고서 수집을 사용한다. 제품 코드에 key를 넣지 않고 기존 서버 인증 계정의 등록 사이트 URL을 사용한다. [Bing API 접근 방식](https://learn.microsoft.com/en-us/bingwebmaster/getting-access).

AdSense는 실제 검증된 사이트 도메인인 `OWNED_SITE_DOMAIN_NAME`을 제품에 귀속한다. 현재 Factory는 검증된 도메인 하나를 제품 하나에만 매핑하며, 같은 도메인의 여러 서비스 수익을 자동 분할하지 않는다. 브라우저 주소만 보고 매핑을 추정하지 않는다. [AdSense 도메인 차원](https://developers.google.com/adsense/management/reference/rest/v2/Dimension).

AdSense 심사 중이면 연결을 끄고 대기 사유를 기록한다. 광고 스크립트가 있다는 사실을 수익 수집 성공으로 기록하지 않는다. 수익 이력이 있는 매핑 변경은 별도 데이터 계획이 필요하다. 보고 통화도 함께 확인한다. [현재 귀속·수익 계약](ADSENSE.md).

## 6 공개 설정과 서버 자격증명 구분

제품 저장소와 인계 문서에는 도메인·Property ID·Measurement ID·권한 확인 상태를 기록할 수 있다. 자격증명은 값 대신 저장 위치와 설정 여부를 기록한다.

| 구분                     | 예                                                                                   | 저장 위치                           |
| ------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------- |
| 제품의 공개 설정         | GA4 `G-…`, 검색 검증 메타 태그, 공개 광고 식별자                                     | 제품의 실제 스택에 맞는 공개 설정   |
| 제품 자체 서버 Secret    | 제품이 사용하는 외부 API Secret                                                      | 해당 제품 서버의 보호된 환경        |
| Factory의 공통 서버 인증 | `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `BING_WEBMASTER_API_KEY`             | 기존 Factory Supabase Edge Secrets  |
| Factory의 공통 운영 설정 | `GOOGLE_CLIENT_ID`, `ADSENSE_ACCOUNT`, `ADSENSE_CURRENCY_CODE`, `ALLOWED_APP_ORIGIN` | 기존 Factory 서버 설정              |
| Factory 예약 인증        | Edge `AUTOMATION_SECRET`, Vault `automation_secret`                                  | 기존 운영자의 보호된 저장·관리 경로 |

Google의 기존 인증은 사용할 서비스의 읽기 scope와 새 속성 접근권한을 모두 갖춰야 한다. API 활성화와 속성 등록만으로 기존 OAuth 동의 범위가 바뀌지는 않는다. 필요할 때만 본인이 기존 인증 경로로 추가 동의를 처리한다.

현재 OAuth helper의 읽기 scope는 GA4 `analytics.readonly`, GSC `webmasters.readonly`, AdSense `adsense.readonly`이며 모두 `https://www.googleapis.com/auth/` 접두어를 사용한다. 기존 동의 범위와 속성 접근이 충족되면 인증을 재발급할 필요가 없다. AdSense 보고서는 읽기 scope로 접근할 수 있다. [AdSense 보고서 인증 계약](https://developers.google.com/adsense/management/reference/rest/v2/accounts.reports/generate).

소비자 제품에는 Factory의 service role·자동화 키·공급자 refresh token을 넣지 않는다. 제품이 Factory 관리 함수를 호출하거나 직접 Factory DB에 쓰는 구조도 필요하지 않다. 제품 자체가 Supabase를 쓴다면 그 제품의 데이터 경계와 권한을 따로 설계한다.

현재 Factory의 `oauth:google` helper는 refresh token을 stdout에 출력한다. 본인 인증이 필요할 때 보호된 절차로 처리하며 agent의 자동 실행·수집 대상으로 사용하지 않는다.

## 7 Factory 제품 등록

관리자는 운영 Factory의 **Products → Add product**에서 등록한다. 기존 제품은 편집하고 동일 제품을 다시 생성하지 않는다. Factory UUID는 등록 후 생성되는 내부 ID이며 `P001` 같은 제품 코드와 다르다.

| UI 필드                      | 내부 필드             | 입력 기준                                                     |
| ---------------------------- | --------------------- | ------------------------------------------------------------- |
| Product code                 | `product_code`        | 관리상 필수로 준비. `P` + 3~6자리 숫자, 기존 코드와 중복 금지 |
| Name                         | `name`                | 필수, 1~120자                                                 |
| Domain                       | `domain`              | 필수, `example.com` 같은 호스트명. 스킴·경로 제외             |
| Website URL                  | `website_url`         | 필수, 실제 운영 HTTP(S) 주소. 운영은 HTTPS 확인               |
| Market                       | `market`              | `Korea`, `English`, `Global` 중 선택                          |
| Language                     | `primary_language`    | 기본 언어 코드, 예: `ko`, `en`                                |
| Level                        | `level`               | 1·2·3 중 실제 구조에 맞게 선택                                |
| Version                      | `version`             | 실제 제품 버전, 예: `1.0`                                     |
| Status                       | `status`              | `IDEA`, `SPEC`, `BUILD`, `LIVE`, `HOLD`, `KILL`, `SCALE`      |
| Launch date                  | `launch_date`         | 실제 출시일 `YYYY-MM-DD`. 미출시면 비워둠                     |
| GitHub repository URL        | `github_repo`         | 해당 제품의 소스 저장소 URL                                   |
| Deployment URL               | `deploy_url`          | 배포 확인에 사용할 URL                                        |
| GA4 property ID              | `ga4_property_id`     | 제품 보고서용 숫자 ID. `G-…` 제외                             |
| GSC property                 | `gsc_property`        | 검증한 속성의 정확한 식별자                                   |
| Bing site URL                | `bing_site_url`       | 등록 계정의 정확한 사이트 URL                                 |
| AdSense verified site domain | `adsense_mapping_key` | 실제 AdSense 사이트 도메인                                    |
| Enable AdSense               | `adsense_enabled`     | 매핑·보고서 접근이 준비된 광고 제품에서 선택                  |
| Active                       | `is_active`           | 예약 수집과 uptime 대상에 포함할지 선택                       |

제품 코드는 현재 폼·서버에서 비워둘 수 있지만 반복 운영을 위해 제품별 고유 코드 사용을 기본으로 한다. 연결하지 않은 공급자는 필드를 비워두며 예시 식별자를 넣지 않는다.

저장하면 GA4·GSC·Bing은 식별자 존재 여부에 따라 integration이 enabled로 정리된다. AdSense는 enable과 매핑을 함께 사용한다. **Enabled는 실행 대상 설정이며 인증·수집 성공 판정은 아니다.**

폼의 Active 기본값은 켜짐이다. 미출시·미검증 제품은 저장 전에 끄고, 예약 운영 준비가 된 시점에 켠다. 사업 상태 LIVE/HOLD/KILL과 Active는 별개다. 현재 수동 Sync는 Active가 꺼져 있어도 enabled된 공급자에 실행할 수 있다.

## 8 첫 수동 Sync 검증

1. 운영 Factory에서 기존 관리자 로그인과 MFA를 완료한다.
2. Products에서 해당 제품을 열고 저장한 공급자 식별자를 다시 확인한다.
3. 제품 상세의 **Manual sync → Run GA4** 등 준비된 공급자 하나만 실행한다.
4. **Sync history**에서 제품·공급자로 필터하고 실행 상세를 연다.
5. status·run ID·실행 시각·조회 기간·Rows fetched·Rows written·오류를 기록한다.
6. 동일 기간·시간대의 공급자 원본 보고서와 Factory의 Traffic/Search/Events/Revenue를 대조한다.
7. 같은 기간 재실행 시 저장 키 기준으로 지표가 중복되지 않는지 확인한다.
8. 공급자별 결과와 미연결 사유를 제품별 준비 기록에 남긴다.

기본 수집 범위는 GA4 최근 7일, GSC 10일, AdSense 14일이며 공통 날짜 helper가 UTC 어제까지의 범위를 계산한다. 공급자 보고 시간대와 후행 확정에 따른 차이는 대조 시 함께 기록한다. Bing은 API가 반환한 이력 범위를 사용하며 현재 adapter가 요청 날짜 범위를 반영하지 않는다.

UI 버튼은 기본 범위를 사용한다. 개발자 API에서 날짜를 지정할 때는 `rangeStart`와 `rangeEnd`를 함께 보낸다. `manual-sync`의 `siteId`는 Registry UUID이고, 공급자 식별자는 서버가 Registry에서 읽는다.

| 결과                     | 해석과 다음 확인                                                             |
| ------------------------ | ---------------------------------------------------------------------------- |
| `success`, 저장 행 있음  | 원본 값·날짜·제품 귀속과 Dashboard 반영 확인                                 |
| `success`, 0행           | API 접근 성공과 실데이터 없음 분리. 원본 기간·태그 수신·권한 확인            |
| `partial`                | 일부 지표는 저장됐지만 세부 수집에 실패 가능. metadata와 빠진 세부 항목 확인 |
| `failed`                 | 오류 코드의 설정·권한·공급자 원인 확인                                       |
| `skipped`                | integration enabled 여부 확인. 실행 이력이 새로 생기지 않을 수 있음          |
| `conflict` 또는 HTTP 409 | 같은 제품·공급자의 기존 실행 확인                                            |

`last_success_at`은 0행 성공이나 partial에도 갱신될 수 있다. 이 시각이나 HTTP 200만으로 실데이터 수집 완료를 판정하지 않는다. `Run all enabled`의 응답도 공급자별 결과를 확인한다. 오늘의 Realtime 이벤트가 오늘 즉시 Factory의 일별 지표로 보인다고 기대하지 않는다.

## 9 예약 수집과 운영 전환

제품마다 cron을 추가하지 않는다. 기존 공급자별 공통 job이 Active 제품을 읽고 enabled된 integration을 실행한다. 준비된 job이 이미 운영 중이면 새 제품의 Active·integration·권한을 검증한다. 공통 job이 꺼져 있거나 인증이 준비되지 않았다면 운영자가 공통 조건을 먼저 해결한다.

| 수집    | 기존 job 이름                  | 코드의 기본 KST 일정 |
| ------- | ------------------------------ | -------------------- |
| GSC     | `site-analytics-sync-gsc`      | 매일 13:00           |
| GA4     | `site-analytics-sync-ga4`      | 매일 13:10           |
| Bing    | `site-analytics-sync-bing`     | 매일 13:20           |
| AdSense | `product-factory-sync-adsense` | 매일 13:30           |
| Uptime  | `site-analytics-uptime`        | 매시 45분            |

표는 migration 기본값이며 실제 job 상태·일정은 운영 환경에서 읽어 확인한다. 자동화 키 일치와 정상 인증, 수동 수집의 실제 저장 성공을 확보한 후 필요한 기존 job만 운영 범위에 맞춰 활성화한다. 공통 job을 켜면 다른 Active 제품도 대상이 된다.

예정 시각 이후 `trigger_type=scheduled`인 run, 해당 제품·공급자의 저장 지표, Dashboard 갱신을 함께 확인한다. cron 요청 접수 성공은 공급자 보고서 수집 성공과 다르다. uptime 호출에는 오래된 기록 정리 동작이 있으므로 기존 보존 정책도 확인한다.

## 10 출시와 연결 완료 체크리스트

### 제품 출시 준비

- [ ] 제품 코드·저장소·시장·언어·핵심 행동과 성공 지표를 기록했다.
- [ ] 운영 도메인·HTTPS·배포 commit과 실제 출시일을 확인했다.
- [ ] 핵심 사용 흐름, 모바일, 오류·빈 결과 처리를 확인했다.
- [ ] GA4 태그와 실제 `core_action` 수신을 확인했다.
- [ ] SEO·canonical·sitemap·검색 소유권과 공개 페이지의 색인 설정을 확인했다.
- [ ] 실제 기능에 맞는 Privacy·Terms·Contact 및 필요한 추가 문서를 준비했다.
- [ ] 제품 README의 실행·배포·환경변수 이름과 복구 방법이 최신이다.

### Factory 연결 완료

- [ ] 기존 Registry에 제품 하나가 정확한 코드·URL·저장소로 등록됐다.
- [ ] 공급자 식별자와 공통 인증 계정의 제품별 접근권한이 맞다.
- [ ] 사용 가능한 공급자별 첫 Sync 결과·run ID·기간을 기록했다.
- [ ] 실제 보고서·저장 지표·Dashboard 값을 대조했다.
- [ ] 0행 성공·partial·실제 0·데이터 없음을 구분했다.
- [ ] 예약 운영 대상이면 실제 예정 실행과 갱신을 확인했다.
- [ ] 미준비 공급자는 사유·담당자·다음 조건을 기록했다.
- [ ] Product별 인계 기록에 Secret 값이 들어 있지 않다.

## 11 자주 막히는 항목

| 현상                                        | 먼저 확인할 것                                                     |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Run 버튼 비활성                             | 공급자 필드 저장 여부와 integration enabled 상태                   |
| `config_missing`                            | Registry 식별자와 공통 서버 설정의 존재 여부                       |
| `auth_error`, `invalid_credentials`         | 관리자 세션·MFA 또는 공급자 인증 중 어느 단계인지                  |
| `permission_denied`                         | 공통 인증 계정의 해당 Property·사이트 보고서 접근권한              |
| localhost에서 요청 차단                     | Factory origin의 CORS·Auth URL 설정. 제품 도메인과 구분            |
| `rate_limited`, `timeout`, `provider_error` | 공급자 상태·조회 범위·기존 실행 확인 후 제한된 재시도              |
| 이벤트는 보이는데 Factory 데이터 없음       | 숫자 Property ID, 조회 범위, 일별 보고 지연, Events 세부 수집 상태 |
| 여러 제품의 지표가 같음                     | 공용 GA4 Property 또는 넓은 GSC 속성을 중복 등록했는지             |
| AdSense 매핑 중복 오류                      | 같은 검증 도메인이 이미 다른 제품에 귀속됐는지                     |
| cron은 성공인데 지표 없음                   | scheduled run의 공급자 결과·실제 저장 행 확인                      |

## 12 제품 metadata 예시

아래는 준비 정보의 **제안 형식**이다. 예시 코드는 실제 제품 코드로 바꾸고 `null` 항목은 확인한 뒤 채운다. 현재 Factory에 자동 import하거나 이 객체를 `manage-sites` 요청으로 그대로 보내지 않는다.

```json
{
  "product_code": "P123",
  "name": "Example Product",
  "domain": "example.com",
  "website_url": "https://example.com/",
  "market": "Global",
  "primary_language": "en",
  "level": 1,
  "version": "1.0",
  "status": "BUILD",
  "core_action_name": "generate_result",
  "launch_date": null,
  "github_repo": null,
  "deploy_url": null,
  "is_active": false,
  "analytics": {
    "ga4_measurement_id": null,
    "ga4_property_id": null,
    "gsc_property": null,
    "bing_site_url": null
  },
  "adsense": {
    "enabled": false,
    "verified_site_domain": null
  }
}
```

`core_action_name`과 중첩된 `analytics`·`adsense`는 이 예시의 문서화 구조다. 현재 Registry 필드에는 표에 있는 최상위 `ga4_property_id`, `gsc_property`, `bing_site_url`, `adsense_enabled`, `adsense_mapping_key`를 UI에서 대응시켜 입력한다.

## 13 현재 Factory 환경에서의 확인 사항

2026-10-08 읽기 전용 점검 기준으로 기존 운영 Factory는 `https://product-factory-1ov.pages.dev`, Supabase ref는 `nemkjxdxswwtrlufcykp`다. P001의 Sync 이력·주요 지표는 0건이고 수집·uptime job 5개는 꺼져 있었다. Vault에는 `project_url` 이름만 확인됐다. 운영 준비 상태는 실행 전에 다시 확인한다.

localhost Origin의 관리 함수 preflight 응답은 운영 origin만 허용했다. 로컬 화면·fixture 검증과 실제 운영 쓰기를 구분하고, 초기 등록·Sync는 기존 운영 Factory에서 준비 상태에 맞춰 수행한다. 로컬 운영 쓰기가 필요하면 Factory의 기존 CORS·Auth 설정을 별도 범위에서 검토한다.

이 가이드 작성으로 제품 등록, Sync 호출, 계정 승인, job 활성화, Secret 변경 또는 배포를 실행하지 않는다. 현재 환경의 상세 증거는 저장소 루트의 `PRODUCT_FACTORY_LOCAL_HANDOFF_20261008.txt`를 참고한다.
