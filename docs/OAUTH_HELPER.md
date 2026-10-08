# OAuth helper private delivery (T01)

실행은 운영자가 별도 승인된 인증 작업에서 직접 수행한다. 이번 개발에서는 실제 OAuth를 실행하지 않는다. 기존 인증을 재발급할 필요가 있는지 먼저 운영자가 확인한다.

helper는 token을 stdout/stderr, 브라우저, 파일에 출력하지 않는다. provider 오류와 예외는 고정 메시지로만 기록한다. 성공 token은 부모 프로세스가 상속한 전용 fd 3 pipe로만 전달한다. pipe가 없으면 서버나 OAuth 요청을 시작하기 전에 실패한다. 파일과 터미널 fd는 거부한다.

운영자 전용 receiver는 Node `spawn(process.execPath, ['--import', 'tsx', 'scripts/google-oauth.ts'], { stdio: ['pipe', 'inherit', 'inherit', 'pipe'], env: operatorEnvironment })`로 실행한다. CLI wrapper 없이 helper 프로세스에 fd 3을 직접 상속한다. `child.stdio[3]`의 UTF-8 데이터는 검토된 private secret-store API로 직접 전달하고 종료 시 메모리를 해제한다. receiver에서 console, shell 인수, 임시파일로 token을 전달하면 안 된다. receiver와 secret store는 이 저장소에서 자동 실행하거나 설정하지 않는다. sink가 끊기면 helper는 전달 실패를 반환한다.

Windows 상속 pipe는 `fstat().isFIFO()`/`isSocket()`이 모두 false일 수 있다. [Node Socket API](https://nodejs.org/docs/latest-v22.x/api/net.html#new-netsocketoptions)로 native fd를 열어 pipe 호환성을 검사하며 파일·터미널은 거부한다. 전송 형식은 UTF-8 JSON 한 줄(`{"refresh_token":"…"}\n`)이다. receiver는 줄바꿈까지 모아 JSON을 파싱하고 private store의 수락을 확인한 뒤, `child.stdin`에 `OAUTH_RECEIVED\n`을 쓴다. Windows fd 3은 token 전송 전용이며 ACK는 별도 stdin pipe를 사용한다. 프레임 크기는 제한하고 JSON·store 오류의 원문을 출력하지 않는다. helper는 비동기 전송 완료와 이 확인 응답을 모두 받아야 성공한다. 잘못된 응답·연결 종료·10초 내 확인 부재는 전달 실패다. 이미 수락된 저장을 되돌리는 기능은 없으므로 실패 시 운영자는 store를 확인한다. 예외는 고정 메시지만 남긴다. 개발 검증은 synthetic 응답과 로컬 callback만 사용한다.

운영자가 기존 보안 환경에서 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET을 준비하고 receiver를 실행한다. Google에 `http://127.0.0.1:5179/oauth2callback`을 허용한 뒤 helper가 출력하는 로컬 `/authorize` 주소를 본인 브라우저에서 연다. 포트 변경 시 GOOGLE_OAUTH_PORT와 허용 redirect를 일치시킨다. URL에 담긴 state/code를 공유하지 않는다. 세션은 5분 뒤 종료한다. 새 receiver 구현은 운영자가 검토해야 하며 테스트 성공을 운영 인증 완료로 간주하지 않는다.

스키마와 Edge 배포 변경은 없다. helper 호출 규약만 변경된다. 복구가 필요하면 이전 출력 방식으로 되돌리지 말고 helper 실행을 중단한 채 pipe receiver를 수정한다.
