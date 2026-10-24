# Product Factory 정상화와 운영 기능

## 2026-10-24 갱신

이 절이 아래 10/23 연결 기록보다 최신이다. 기존 세 제품 IPOScore·Holdwise·오늘슬로프는 모두 GA4·Search Console·Bing 매핑이 있으며 최근 수집 9건이 success다. 새 제품 두 개의 0행 응답은 보고서 데이터 대기이며 실제 방문이 없다는 뜻으로 단정하지 않는다. GSC·GA4·Bing의 10/24 정규 cron 실행도 succeeded다. 기존 정규 일정과 데이터는 보존했고 열린 운영 알림은 0건이다.

개인용 Google 인증을 위해 기존 Factory에 정적 소개·개인정보처리방침·이용 안내 페이지를 추가했다. 세 안내 경로는 HTTP 200이며 SDK나 데이터 조회 script가 없다. 관리자·MFA guard는 유지되고 익명 제품 상세 요청이 로그인으로 이동함을 실제 Pages 미리보기에서 검증했다. Pages의 HTML 주소 정규화와 충돌하는 rewrite 대신 기본 정적 파일 매칭과 SPA fallback을 사용한다.

기능 소스 `650ab01`의 CI [40099082915](https://github.com/GPTcreate/product-factory/actions/runs/40099082915)는 성공했고 [PR 1](https://github.com/GPTcreate/product-factory/pull/1)을 `accec96`으로 병합해 기존 Pages에 배포했다. CLI 실응답의 SHA-256이 `value` 필드에 있는 차이를 보완한 `3cd53ac`도 CI [40099545709](https://github.com/GPTcreate/product-factory/actions/runs/40099545709) 성공 후 [PR 2](https://github.com/GPTcreate/product-factory/pull/2)를 `335a7c6`으로 병합했다. 단위 테스트 225개, 보안 설정 테스트 10개, migration/RLS 15개, 합성 OAuth transport 10개 검증을 통과했다.

Google 브랜딩에 실제 안내 URL과 기존 Pages 승인 도메인을 저장해 `앱 게시` 버튼이 활성화됐다. 기존 Google 클라이언트의 암호화 보관본과 실제 Edge 설정 digest가 모두 일치한다. 현재 게시 상태는 여전히 테스트이며 최종 운영 전환과 본인 재동의의 실행 직전 확인을 기다린다. 새 토큰 교체는 아직 수행하지 않았고 기존 Google·예약 인증을 보존했다. 개인용 심사 예외와 동의 화면의 Google 경고는 별도이며, 새 운영 인증의 실제 교체와 수집 확인 전에는 7일 제한 해소를 완료로 기록하지 않는다.

AdSense는 기존 사이트 승인과 연결 매핑이 남아 있어 수집을 활성화하지 않는다. 새 프로젝트, 운영 DB 초기화, 공용 core 변경, 다른 작업 중단은 수행하지 않았다.

2026-10-23 기준. 기존 프로젝트를 복구하고 제품 출시·작업·평가 기록과 예약 운영 알림을 추가했다. 실제 공급자 연결 결과는 설정 존재 여부, API 호출, 저장과 화면 반영을 나눠 확인한다.

## 복구와 실제 연결

- 기존 Supabase `nemkjxdxswwtrlufcykp`의 복구 요청 후 `ACTIVE_HEALTHY`와 Auth health HTTP 200을 확인했다. 기존 사용자·관리자·verified TOTP·Registry를 보존했다.
- 본인 로그인 후 기존 Factory 대시보드와 제품 상세 읽기를 확인했다.
- P001 Bing 수동 수집에서 실제 report 11행이 저장됐다. 기존 Google 연결 실패는 OAuth 공통 설정 누락을 가리켰다.
- 자동화 준비는 기존 Edge `AUTOMATION_SECRET`이 있을 때만 Vault의 비어 있는 이름에 연결한다. 기존 Vault 값이 다르면 덮어쓰지 않는다. 생성·회전 기능이 아니다.
- 공통 job 상태와 Secret 존재 여부는 `System`에서 구분해 확인한다. 실제 예약 수집 검증 결과는 `.agent/evidence/normalization-20261023`의 최종 운영 기록을 따른다.

## 추가 기능

| 위치 | 기능과 동작 |
| --- | --- |
| 제품 상세 Launch | 출시 항목별 pending/ready/waiting/not_applicable, 증거 URL·메모·확인일 저장. ready에는 확인 근거 필요 |
| 제품 상세 Work | 개선 작업의 상태·우선순위·담당·기한·연결 주·완료 증거 저장. 완료에는 근거 필요 |
| 제품 상세 Review | 지표·목표·기간·관측 일수 설정, 실제 지표에 따른 규칙 제안과 운영자 판단 기록 |
| Factory | 선택 주의 완료일과 직전 주 동일 길이 구간 비교, 누락·통화·coverage·연결 작업, 텍스트 내보내기 |
| System | 보호된 서버 설정 존재 진단, 기존 자동화 인증의 Vault 연결, 예약 운영 알림과 확인 처리 |

평가는 최근 정상 수집과 최소 관측 일수가 충족되지 않으면 INSUFFICIENT다. 저장할 때 서버가 실제 DB 지표로 다시 계산한다. 제안은 목표 달성률에 따른 명시적 규칙이며 사업 판단이나 제품 상태 변경을 자동 실행하지 않는다. 기간 고유 사용자 합계를 만들지 않고 혼합 통화와 부분 관측의 증감률을 보류한다.

제품 상세의 GA4·검색 카드도 미수집을 `No Data`로 표시하도록 보완했다. 초기 목표 입력은 예시로 안내하며 운영 제품의 목표를 임의 생성하지 않는다.

## 저장과 권한

- `20261023030143_product_operations.sql`: 체크리스트, 개선 작업, 평가 목표·기록 테이블. 기존 데이터는 수정하지 않는 추가 migration이다.
- `20261023031400_operational_alerts.sql`: 중복을 합치는 운영 알림과 매시 5분 DB 모니터.
- 새 public 테이블은 RLS를 켜고 기존 관리자+aal2 SELECT만 허용한다. 브라우저 직접 쓰기는 금지하며 관리 함수에서 사용자 인증·MFA·관리자를 먼저 검증한다.
- `prepare_factory_automation`은 service role만 실행할 수 있고 결과 boolean만 반환한다. Secret 값은 응답·문서·로그에 전달하지 않는다.
- `refresh_operational_alerts`는 일반 클라이언트와 service role에서 직접 실행할 수 없다. DB scheduler가 실행한다.
- 외부 메시지는 발송하지 않는다. 외부 알림은 받을 채널·대상과 해당 인증 경로가 정해진 후 연결한다. DB가 정지하면 DB 내부 모니터도 멈추므로 별도 외부 가용성 감시와 구분한다.

## 검증

타입 검사, 225개 단위 테스트, 보호된 인증 전달 검사 7개, 15개 migration의 embedded PostgreSQL 검증, 브라우저 fixture와 기존 진단·metadata·운영 문제·OAuth transport 회귀 검증을 수행했다. 2026-10-23 18시 KST에 단위·인증·DB·타입·lint·format·build를 다시 통과했다. DB 검증에는 관리자+MFA 읽기, 직접 쓰기 거부, 저장 제약, 자동화 Secret 보존, 알림 중복 통합·해소를 포함한다.

브라우저 fixture는 실제 운영 API를 차단하고 체크리스트·작업·목표·평가의 저장과 재조회, 주간 보고서 다운로드, 모바일 가로 넘침을 검증한다. 실제 공급자·Auth·cron의 성공 증거와 합성 검증을 구분한다.

기존 privacy Fast Refresh와 큰 bundle 경고는 유지된다. Windows의 일부 기존 파일 포맷을 정리했고 전역 Git 설정이나 dependency 버전을 바꾸지 않았다. 별도 Deno 바이너리의 다운로드는 TLS 오류로 완료하지 못했다. Edge 배포와 실제 인증 요청의 실행 검증을 별도로 기록한다.

## 적용과 복구

DB migration을 먼저 적용하고 기존 `manage-factory`만 새 버전으로 배포한 뒤 프런트엔드를 기존 Pages Git 연동으로 배포한다. 기존 다른 Edge 함수나 사이트를 일괄 재배포하지 않는다.

문제 발생 시 이전 Pages deployment로 프런트엔드를 복구할 수 있다. 새 테이블의 사용자 기록을 삭제하는 migration rollback은 자동 수행하지 않는다. 관리 함수도 기존 Ideas/Week 동작을 보존한다. 자동화·알림 기능의 영향은 해당 job만 중지해 격리한다.

원래 미추적 문서는 `.agent/checkpoints/normalization-20261023-114448`에 백업하고 보존했다. 최신 GitHub 문서 commit `b94abd4`를 fast-forward로 가져온 뒤 `codex/normalize-20261023`에서 작업했다. 공용 core와 다른 프로젝트·프로세스는 변경하지 않았다.

## 실제 운영 확인과 남은 본인 작업

기능 소스는 `e16962f`, CI 설정은 `da2647d`에 반영했다. [GitHub CI 실제 실행](https://github.com/GPTcreate/product-factory/actions/runs/39894635479)은 모든 단계가 성공했다. 이후 운영 확인에서 배포 교체 직후 이전 lazy module을 찾지 못하는 문제를 발견해 보호 화면에 수동 새로고침 복구 안내를 추가했다. 원본 오류·내부 경로는 사용자 화면에 노출하지 않고 입력 손실 안내를 함께 표시한다. 이 복구 화면의 회귀 테스트 2개를 추가했다. 최종 release SHA와 Pages·CI 결과는 `.agent/evidence/normalization-20261023/progress.json`에 기록한다.

| 연결 | 실제 확인 | 남은 일 |
| --- | --- | --- |
| Supabase Auth/DB | ACTIVE_HEALTHY, 본인 로그인·관리자 MFA와 실제 데이터 읽기 성공 | 없음 |
| Bing 수동·예약 수집 | 수동 11행 저장, 30일 10 clicks / 87 impressions. 예약 실행 `da0cd670-fe02-4ef0-b3b2-87113f450e03` success, 11행 저장(09:04 UTC) | 매일 04:20 UTC(13:20 KST) 활성 |
| Google GA4 | 승인된 읽기 권한 동의·세 인증 항목 보호 저장 완료. 수동 `ed9194f8-0ad5-4e2f-af0f-062fee7120a0`, 예약 `3335d7d0-33b7-4a33-a2ab-2e0a1ef17990` 모두 success·50행 저장. 10/16~10/22 일별 7행·104 sessions와 화면 반영 확인 | 매일 04:10 UTC(13:10 KST) 활성. OAuth 테스트 모드의 7일 토큰 만료는 장기 운영 과제 |
| GSC | 승인된 OAuth 계정의 Search Console은 속성 추가 안내 화면. Registry disabled, 속성 매핑 없음 | 확인된 소유 속성이 생긴 뒤 정확한 값으로 매핑 |
| AdSense | 본인 계정의 `iposcore.kr`는 준비 중, Ads.txt 찾을 수 없음(10/15 갱신). Registry disabled, ADSENSE_ACCOUNT 미설정 | 사이트 승인·ads.txt 원본 사이트 조치 후 기존 연결 복원. 새 계정·사이트 생성 안 함 |
| 자동화 인증 | 공식 CLI 로그인 완료. 기존 Edge에 AUTOMATION_SECRET을 보호 저장하고 System으로 빈 Vault 항목에 연결 | 값은 출력하지 않음. 기존 다른 인증 보존 |
| uptime | 실제 예약 실행 09:04 UTC, IPOScore HTTP 200·ok=true 저장 | 매시 45분 활성. 90일 보존 정책 대상이던 기존 행은 0건 |
| DB 운영 알림 | 예약 실행 2026-10-23 03:17 UTC succeeded, 매시 5분 정규 일정 복원 | DB 자체가 정지되면 함께 정지됨 |

사용자는 기존 값이 없음을 확인한 뒤 신규 인증 설정을 명시적으로 승인했다. 이 승인은 초기의 재발급 금지 조건을 대체한다. 기존 Google Cloud 프로젝트에 웹 OAuth 클라이언트를 만들고, 현재 Windows 계정용 DPAPI 암호화 보관과 보호된 메모리 전달을 검증했다. 미사용 최초 클라이언트 폐기와 대체 생성도 별도로 승인받았다. 자세한 보호 절차와 테스트 모드 토큰의 7일 제한은 [OAuth 인계](OAUTH_HELPER.md)를 따른다. Secret 값은 채팅이나 문서에 전달하지 않는다.

CLI 로그인은 기존 Supabase 브라우저 세션을 이용해 완료했다. 공식 페이지의 CLI 코드를 채팅·파일에 출력하지 않고 보호된 localhost receiver에 직접 전달했다. `AUTOMATION_SECRET`을 기존 Edge에 저장한 뒤 System의 보호된 동작으로 Vault에 연결했다. Bing·GA4·uptime의 기존 job을 각각 임시 매분 일정으로 검증하고 즉시 정규 일정으로 복원했다. 실제 cron 이력과 결과 저장을 모두 확인했으며 임시 일정은 남기지 않았다. 설정 화면 재시작 시 기존 CLI의 해당 프로젝트 접근을 먼저 검사해 불필요한 재로그인을 생략한다.

사용자는 Google의 계속·읽기 권한 동의 버튼 진행을 명시적으로 승인했고 agent가 세 읽기 권한을 확인해 완료했다. refresh token은 전용 pipe와 ACK, 기존 CLI named pipe로만 Edge Secrets에 저장했다. 초기 GA4 실수집은 HTTP 403이었으며, Analytics 원본에서 Registry의 `16042438780`이 Property ID가 아닌 웹 스트림 ID임을 확인했다. 실제 IPOSCORE Property는 `557310412`, 스트림의 측정 ID `G-SZCS9GN9SN`은 공개 운영 HTML의 태그와 일치한다. 기존 GA4 일별 행이 0건임을 확인한 뒤 제품 편집에서 Property ID만 정정했고 정상 수집을 검증했다. 기본 Google 계정과 collector 계정이 달라질 수 있으므로 항상 승인된 본인 계정으로 전환해 대조한다.

즉시 추가 로그인 입력은 없다. 남은 조건은 OAuth 앱 브랜딩·게시 준비와 테스트 모드 7일 제한 해소, 검증된 GSC 속성, AdSense 사이트 승인이다. GSC·AdSense job은 꺼 둔다. 미설정 공급자 job을 반복 실행하지 않는다. Supabase 재정지 방지나 유료 전환은 수행하지 않았다.

Supabase 보안 advisor의 기존 경고는 `pg_net`의 public 설치, 관리자/MFA를 본문에서 검사하는 기존 SECURITY DEFINER RPC, leaked-password protection 미설정이다. 새 운영 테이블은 RLS를 적용했다. RPC는 실제 본문 권한 검사를 확인했으며 기존 호출을 끊는 일괄 권한 변경이나 extension 이동은 수행하지 않았다. [extension 안내](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [RPC 안내](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [Auth 안내](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## 로컬 실행

기존 `.env.local`을 유지한다. 저장소에서 `npm ci` 후 `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`를 실행하고 `http://127.0.0.1:5173`으로 접속한다. 이번 실행에서 서버 기동과 HTTP 200을 확인했다. 운영 도메인과 localhost의 브라우저 로그인 세션은 별개다. 검증 명령은 `npm run typecheck`, `npm test`, `npm run test:db`, `npm run lint`, `npm run build`다. Windows CRLF 환경의 포맷 확인은 `npm run format:check -- --end-of-line auto`를 사용할 수 있다.
