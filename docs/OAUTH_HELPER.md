# OAuth helper private delivery (T01)

## 동일 클라이언트 토큰 갱신 (2026-10-24)

Google 앱을 운영 상태로 전환한 뒤에만 `npm run setup:auth -- --rotate-google-after-production`으로 명시적인 갱신 모드를 실행한다. 운영자가 확인한 기존 GA4 Property ID와 Search Console 사이트 식별자를 각각 `FACTORY_VERIFY_GA4_PROPERTY`, `FACTORY_VERIFY_GSC_SITE` 환경변수에 지정한다. 실제 사이트 식별자나 인증값을 소스에 추가하지 않는다.

보호된 기존 클라이언트를 `/client`로 메모리에 가져온 뒤, 동일 origin·CSRF가 있는 `/google-rotate` 요청에 `confirmProduction: true`를 전달한다. 이 endpoint는 명시적 실행 옵션이 없으면 거부된다. CLI Secret digest와 가져온 Client ID·Secret의 SHA-256이 모두 일치하고 기존 세 설정이 모두 있어야 시작한다. 기존 항목을 삭제해 초기 설정 보호를 우회하지 않는다.

새 토큰으로 Google access token을 받아 승인한 세 readonly scope만 있는지, 지정한 기존 GA4와 Search Console 사이트에 실제 접근 가능한지 먼저 확인한다. 성공한 경우에만 `GOOGLE_REFRESH_TOKEN` 하나를 보호 pipe로 교체하고 저장 digest를 확인한다. Client ID·Secret·예약 인증은 쓰지 않는다. 검증 실패 전에는 기존 설정을 변경하지 않는다. provider 응답·인증값은 로그에 남기지 않는다. 실제 검증과 CLI 저장 확인을 위해 현재 Google helper의 ACK 제한은 120초이며 전체 OAuth 세션은 5분이다. 아래 이전 구현 설명의 10초 제한은 초기 transport 기본값에 해당한다.

`/about`, `/privacy`, `/terms`는 로그인 없는 정적 안내 페이지다. 공개 페이지에는 SDK·통계 조회·계정 입력이 없으며 관리자·MFA·RLS 규칙은 유지한다. 운영 게시 완료 여부는 Google 콘솔과 최신 검증 기록으로 확인하며 이 구현 설명만으로 완료로 간주하지 않는다.

개인용 Google 설정과 운영 전환은 [개인용 OAuth 실행 절차](GOOGLE_OAUTH_PERSONAL_RUNBOOK.md)를 따른다. 이 문서는 구현자용 보호 전달 규약을 다룬다.

실행은 운영자가 승인한 인증 작업에서 수행한다. T01 개발 검증에서는 실제 OAuth를 실행하지 않았다. 2026-10-23 운영자는 기존 인증값이 없음을 확인하고 신규 인증 설정을 승인했다. 아래의 보호 전달 계약은 유지하며, 신규 운영자 receiver는 마지막 절을 따른다.

helper는 token을 stdout/stderr, 브라우저, 파일에 출력하지 않는다. provider 오류와 예외는 고정 메시지로만 기록한다. 성공 token은 부모 프로세스가 상속한 전용 fd 3 pipe로만 전달한다. pipe가 없으면 서버나 OAuth 요청을 시작하기 전에 실패한다. 파일과 터미널 fd는 거부한다.

운영자 전용 receiver는 Node `spawn(process.execPath, ['--import', 'tsx', 'scripts/google-oauth.ts'], { stdio: ['pipe', 'inherit', 'inherit', 'pipe'], env: operatorEnvironment })`로 실행한다. CLI wrapper 없이 helper 프로세스에 fd 3을 직접 상속한다. `child.stdio[3]`의 UTF-8 데이터는 검토된 private secret-store API로 직접 전달하고 종료 시 메모리를 해제한다. receiver에서 console, shell 인수, 임시파일로 token을 전달하면 안 된다. receiver와 secret store는 이 저장소에서 자동 실행하거나 설정하지 않는다. sink가 끊기면 helper는 전달 실패를 반환한다.

Windows 상속 pipe는 `fstat().isFIFO()`/`isSocket()`이 모두 false일 수 있다. [Node Socket API](https://nodejs.org/docs/latest-v22.x/api/net.html#new-netsocketoptions)로 native fd를 열어 pipe 호환성을 검사하며 파일·터미널은 거부한다. 전송 형식은 UTF-8 JSON 한 줄(`{"refresh_token":"…"}\n`)이다. receiver는 줄바꿈까지 모아 JSON을 파싱하고 private store의 수락을 확인한 뒤, `child.stdin`에 `OAUTH_RECEIVED\n`을 쓴다. Windows fd 3은 token 전송 전용이며 ACK는 별도 stdin pipe를 사용한다. 프레임 크기는 제한하고 JSON·store 오류의 원문을 출력하지 않는다. helper는 비동기 전송 완료와 이 확인 응답을 모두 받아야 성공한다. 잘못된 응답·연결 종료·10초 내 확인 부재는 전달 실패다. 이미 수락된 저장을 되돌리는 기능은 없으므로 실패 시 운영자는 store를 확인한다. 예외는 고정 메시지만 남긴다. 개발 검증은 synthetic 응답과 로컬 callback만 사용한다.

운영자가 기존 보안 환경에서 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET을 준비하고 receiver를 실행한다. Google에 `http://127.0.0.1:5179/oauth2callback`을 허용한 뒤 helper가 출력하는 로컬 `/authorize` 주소를 본인 브라우저에서 연다. 포트 변경 시 GOOGLE_OAUTH_PORT와 허용 redirect를 일치시킨다. URL에 담긴 state/code를 공유하지 않는다. 세션은 5분 뒤 종료한다. 새 receiver 구현은 운영자가 검토해야 하며 테스트 성공을 운영 인증 완료로 간주하지 않는다.

스키마와 Edge 배포 변경은 없다. helper 호출 규약만 변경된다. 복구가 필요하면 이전 출력 방식으로 되돌리지 말고 helper 실행을 중단한 채 pipe receiver를 수정한다.

## 2026-10-23 운영자 보안 연결 화면

`npm run setup:auth`는 Windows 전용 임시 로컬 설정 화면을 `http://127.0.0.1:5180`에 연다. `FACTORY_SUPABASE_CLI`에는 공식 Supabase CLI 실행 파일의 절대 경로를 지정한다. 이번 확인 버전은 2.121.0이다. PTY 런타임은 별도 `.agent/tools/auth-runtime-small`에 `@lydell/node-pty@1.1.0`을 설치해 사용하며 제품 dependency나 공용 core는 바꾸지 않는다. 공식 CLI 로그인은 interactive terminal이 필요하므로 private PTY를 사용하고 그 출력은 사용자 채팅이나 파일로 내보내지 않는다.

다른 Windows PC에서 이 운영자 도구를 준비할 때만 저장소 루트에서 `npm install --prefix .agent/tools/auth-runtime-small --no-save --package-lock=false @lydell/node-pty@1.1.0`로 격리된 PTY를 설치한다. 공식 Supabase CLI의 위치를 PowerShell의 `$env:FACTORY_SUPABASE_CLI`에 지정하고 `npm run setup:auth`를 실행한다. 이 PC에서는 이미 설치·실행을 검증했으므로 재설치가 필요 없다. DPAPI 보관본은 현재 Windows 사용자에 묶여 있어 다른 계정·PC에서 그대로 복호화할 수 없다. 비밀값의 이동은 별도 보호 절차로 처리하며 암호화 파일을 저장소에 commit하지 않는다.

이 receiver는 기존 Supabase `nemkjxdxswwtrlufcykp`와 Google Cloud `product-factory-510706`만 다룬다. 새 프로젝트·요금제·DB 초기화·일괄 배포는 수행하지 않는다. UI에는 이름별 완료 여부와 고정 안내만 표시한다. 모든 쓰기 요청에 정확한 Host·Origin과 무작위 CSRF 값을 요구하고 외부 origin을 거부한다. 서버는 loopback에만 바인딩하고 30분 후 종료한다.

CLI 링크는 PTY 출력의 완전한 한 줄을 받은 뒤 `session_id`, `token_name`, `public_key`가 모두 있는 공식 URL만 사용한다. 이름의 공백에서 링크를 자르던 오류를 수정하고 회귀 검사를 추가했다. 만료된 요청은 로컬 화면에서 로그인 재시작 후 새 공식 링크로 열며, 이전 링크를 재사용하지 않는다. 이미 로그인한 공식 브라우저의 CLI 코드는 승인된 로컬 receiver로 메모리에서 직접 전달할 수 있고 채팅·스크린샷·파일에 기록하지 않는다. 이 전달은 계정 비밀번호·MFA의 대리 입력을 포함하지 않는다.

1. 로컬 화면의 `Supabase 공식 CLI 로그인 열기`로 공식 Supabase 페이지를 연다. 본인이 계정 로그인과 CLI 확인을 완료하고, 표시된 CLI 확인 코드를 로컬 password 입력란에만 전달한다. 계정 비밀번호·MFA 코드·PAT를 이 입력란이나 채팅에 넣지 않는다. 공식 CLI의 인증 저장은 CLI 자체 정책을 따른다.
2. 로그인 성공 후 기존 Secret 이름 목록을 확인한다. `AUTOMATION_SECRET`이 있으면 보존하고, 없을 때만 CSPRNG 32바이트 값을 만들어 기존 Edge Secrets에 저장한다. Secret은 무작위 Windows named pipe의 env 데이터로 CLI에 전달하며 명령행 인수·일반 파일·터미널 출력에 넣지 않는다.
3. 기존 Google 프로젝트의 웹 OAuth 클라이언트를 준비한다. 콜백은 `http://127.0.0.1:5179/oauth2callback`이다. 클라이언트 JSON의 프로젝트·형식·콜백을 검증하고 메모리로 가져온다. 보호된 operator pipe로 전달해도 같은 검증을 거친다. 새 값의 로컬 보관본은 현재 Windows 계정의 DPAPI 암호화와 사용자/SYSTEM만 허용한 ACL을 사용한다.
4. `Google 인증 준비` 후 본인이 Google 로그인·읽기 권한 동의를 완료한다. 기존 helper는 `analytics.readonly`, `webmasters.readonly`, `adsense.readonly`를 요청한다. 받은 refresh token은 fd 3과 ACK 계약을 유지하며 같은 CLI named pipe로 기존 Edge Secrets에 저장한다. 기존 Google 설정이 있으면 자동 덮어쓰기를 중단한다.
5. agent는 System의 설정 존재 여부, 기존 자동화 인증의 Vault 연결, Bing 예약 실행, GA4 실제 수집·저장·화면 반영을 차례로 검증한다. 이 단계 전에는 인증·예약 수집 성공으로 기록하지 않는다.

2026-10-23 사용자가 세 읽기 권한의 동의 진행을 명시적으로 승인했고 agent가 완료했다. Google 세 인증 항목의 실제 Edge 저장과 GA4 수동·예약 success를 확인했다. 설정 화면의 수명이 끝나도 CLI 로그인은 남을 수 있으므로, 재시작 때 기존 프로젝트 Secret 이름 접근부터 검사하고 유효하면 재로그인을 생략한다. 인증값을 다시 발급하거나 다른 프로젝트를 조회하지 않는다. 실제 수집 근거와 수정한 Property ID는 [정상화 기록](NORMALIZATION_20261023.md)을 따른다.

`npm run test:auth-setup`은 접근성 버튼 이름에 Secret이 포함된 화면의 안전 요약, 프로젝트·콜백 검증, Host/Origin/CSRF 거부, dotenv 주입 방지, 실제 Windows named pipe 전달과 미수락 실패를 synthetic 값으로 검사한다. 실제 로컬 서버의 외부 origin POST HTTP 403도 확인했다. Supabase 실제 Secret 저장과 Google 실제 동의는 본인 인증 후 별도로 확인한다.

Google 생성 모달의 **복사 버튼 접근성 이름에 비밀값 전체가 포함될 수 있다**. 전체 AX tree나 필터링한 버튼 문자열을 출력하지 않는다. `safeAuthPageState`처럼 고정 boolean만 반환하고, Secret 화면의 스크린샷도 기록하지 않는다. 이번 최초 생성값 한 건은 도구 응답에 포함돼 운영에 사용하지 않고 해당 미사용 클라이언트를 삭제해 무효화했다. 사용자 승인 후 새 클라이언트를 생성하고 출력 없이 보호 전달했다. 폐기본은 복원하지 않는다.

2026-10-23 확인 당시 Google 앱은 외부/테스트 상태였고 본인 한 명만 테스트 사용자로 등록했다. 이후 2026-10-24 사용자 실행 승인으로 기존 앱을 프로덕션 단계로 전환하고, 같은 클라이언트·계정·세 읽기 권한으로 재동의해 갱신 토큰만 보호 교체했다. 새 토큰의 scope·실제 접근과 저장 digest, 교체 후 세 제품 수동 9건·예약 endpoint 호출 9건의 success를 확인했다. Client ID·Secret·AUTOMATION_SECRET 변경은 없다. 기존 토큰을 지워 우회하지 않았다. [정상화 기록](NORMALIZATION_20261023.md)의 시각과 증거를 따른다. 개인용 미검증 경고와 사용자 한도는 남으며 공식 심사 완료로 간주하지 않는다. 운영 토큰도 권한 철회 등으로 무효화될 수 있다. [Google OAuth 토큰 정책](https://developers.google.com/identity/protocols/oauth2/)을 따른다.
