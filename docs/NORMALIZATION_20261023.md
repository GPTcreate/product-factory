# Product Factory 정상화와 운영 기능

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

타입 검사, 223개 단위 테스트, 15개 migration의 embedded PostgreSQL 검증, 브라우저 fixture와 기존 진단·metadata·운영 문제·OAuth transport 회귀 검증을 수행했다. DB 검증에는 관리자+MFA 읽기, 직접 쓰기 거부, 저장 제약, 자동화 Secret 보존, 알림 중복 통합·해소를 포함한다.

브라우저 fixture는 실제 운영 API를 차단하고 체크리스트·작업·목표·평가의 저장과 재조회, 주간 보고서 다운로드, 모바일 가로 넘침을 검증한다. 실제 공급자·Auth·cron의 성공 증거와 합성 검증을 구분한다.

기존 privacy Fast Refresh와 큰 bundle 경고는 유지된다. Windows의 일부 기존 파일 포맷을 정리했고 전역 Git 설정이나 dependency 버전을 바꾸지 않았다. 별도 Deno 바이너리의 다운로드는 TLS 오류로 완료하지 못했다. Edge 배포와 실제 인증 요청의 실행 검증을 별도로 기록한다.

## 적용과 복구

DB migration을 먼저 적용하고 기존 `manage-factory`만 새 버전으로 배포한 뒤 프런트엔드를 기존 Pages Git 연동으로 배포한다. 기존 다른 Edge 함수나 사이트를 일괄 재배포하지 않는다.

문제 발생 시 이전 Pages deployment로 프런트엔드를 복구할 수 있다. 새 테이블의 사용자 기록을 삭제하는 migration rollback은 자동 수행하지 않는다. 관리 함수도 기존 Ideas/Week 동작을 보존한다. 자동화·알림 기능의 영향은 해당 job만 중지해 격리한다.

원래 미추적 문서는 `.agent/checkpoints/normalization-20261023-114448`에 백업하고 보존했다. 최신 GitHub 문서 commit `b94abd4`를 fast-forward로 가져온 뒤 `codex/normalize-20261023`에서 작업했다. 공용 core와 다른 프로젝트·프로세스는 변경하지 않았다.
