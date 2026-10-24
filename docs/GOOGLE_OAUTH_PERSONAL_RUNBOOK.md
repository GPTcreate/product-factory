# Product Factory 개인용 Google OAuth 설정 절차

2026-10-24 기준. 본인 Google 계정으로 본인 제품의 보고서만 읽는 개인용 운영 절차다. 목표는 기존 OAuth 앱을 `외부 / 운영 중`으로 전환하고, 운영 상태에서 다시 인증해 테스트 모드의 7일 만료 조건을 해소하는 것이다. 이 문서 작성으로 Google 설정이나 인증값을 변경하지는 않는다.

**현재 완료 상태:** 사용자 승인 후 2026-10-24 실제 운영 전환과 동일 클라이언트 재동의를 완료했다. 갱신 토큰만 23:29 KST에 보호 교체했고, 세 제품의 수동 수집 9건·기존 예약 endpoint 호출 9건이 모두 성공했다. 기존 관리자·MFA·클라이언트·다른 인증·일정은 유지했다. 아래는 재연결이 필요할 때의 절차이며 지금 다시 실행할 필요는 없다. 상세 증거와 추가 관측 조건은 [정상화 기록](NORMALIZATION_20261023.md)을 따른다.

## 사용할 설정

| 항목 | 선택할 값 |
| --- | --- |
| 기존 프로젝트 | `product-factory-510706` · 표시 이름 `product factory` |
| 관리·동의 계정 | `hanmanju88@gmail.com` |
| 앱 이름 | `Product Factory` |
| 사용자 유형 | **외부 / External** 유지 |
| 최종 게시 상태 | **운영 중 / In production** |
| OAuth 클라이언트 | 기존 `Product Factory Analytics Collector` 유지 |
| 승인된 리디렉션 URI | `http://127.0.0.1:5179/oauth2callback` |
| 읽기 권한 | `analytics.readonly`, `webmasters.readonly`, `adsense.readonly` |

개인용 앱과 `내부 / Internal`은 다르다. Internal은 Google Workspace·Cloud Identity 조직의 구성원용이다. 개인용으로 쓰는 현재 앱은 External을 유지한다. Google은 100명 미만의 개인용 앱에 OAuth 검증 심사 예외를 두고 있으므로, 개인용 운영을 위해 대외 서비스용 검증 심사부터 신청할 필요는 없다. 미검증 앱 경고와 사용자 한도는 남을 수 있다. [개인용 예외](https://support.google.com/cloud/answer/13464323), [사용자 유형과 게시 상태](https://support.google.com/cloud/answer/15549945).

## 1 게시 상태 변경

1. [기존 프로젝트의 대상 화면 열기](https://console.cloud.google.com/auth/audience?project=product-factory-510706).
2. 오른쪽 위 Google 계정이 `hanmanju88@gmail.com`, 위쪽 프로젝트가 `product factory`인지 확인한다. 다른 기본 계정으로 열렸으면 계정만 전환한다.
3. 사용자 유형이 **외부**인지 확인한다.
4. 게시 상태를 확인한다. 이미 **운영 중**이면 변경하지 않고 3절로 이동한다.
5. **앱 게시 / Publish app**가 활성화돼 있으면 누르고 표시된 운영 전환 안내를 확인한다. 개인용 범위와 안내를 확인한 뒤 최종 확인을 진행한다.
6. 화면의 게시 상태가 **운영 중 / In production**인지 확인한다.

앱 게시가 비활성이거나 브랜딩 구성 완료를 요구하면 아래 2절을 먼저 처리한다. Google의 테스트 사용자 목록은 운영 전환 후의 접근 제한 장치가 아니다. Factory는 기존 관리자 allowlist와 MFA로 접근을 제한하고, 새로운 운영 사용자는 추가하지 않는다.

완료 표시: `게시 상태: 운영 중`.

## 2 게시 버튼이 비활성일 때

[기존 프로젝트의 브랜딩 화면](https://console.cloud.google.com/auth/branding?project=product-factory-510706)에서 콘솔이 요구하는 미완료 항목을 채우고 저장한다.

| 항목 | 입력 방법 |
| --- | --- |
| 앱 이름 | `Product Factory` |
| 사용자 지원 이메일 | 드롭다운에서 기존 본인 이메일 선택 |
| 개발자 연락처 | 실제 확인하는 기존 본인 이메일 |
| 홈페이지 | 로그인 없이 Factory의 용도와 Google 보고서 이용 방식을 설명하는 실제 공개 주소 |
| 개인정보처리방침 | Factory의 Google 데이터 이용·저장·공유·삭제·문의 방법을 설명하는 실제 공개 주소 |
| 서비스 약관 | 실제 공개된 Factory 이용 조건 주소 |
| 승인된 도메인 | 위 주소들이 속한, 소유권을 확인한 도메인. 기존 `iposcore.kr`을 사용하면 `iposcore.kr` 입력 |

새 도메인 구매 없이 기존 소유 도메인을 사용할 수 있다. 홈페이지와 정책 주소는 실제로 배포되어 열리는 주소를 입력한다. 기존 Factory 로그인 화면만을 소개 홈페이지로 입력하거나, 아직 만들지 않은 예시 URL을 넣지 않는다. Google은 외부 운영 앱의 관련 링크와 도메인 요건을 안내하며, 검증용 홈페이지는 로그인 페이지만으로 구성할 수 없다. [브랜딩 요구사항](https://support.google.com/cloud/answer/15549049).

공개 안내·정책 페이지가 아직 없으면 이 단계의 선행 작업은 해당 페이지 준비다. agent에게 실제 페이지와 도메인 연결을 준비하도록 요청하고, 운영자가 내용과 공개 주소를 확인한 뒤 이 표에 입력한다. 개인용 심사 예외가 콘솔의 필수 설정이나 데이터 이용 정책을 면제하는 것은 아니다.

저장 후 대상 화면으로 돌아가 1절의 앱 게시를 다시 진행한다. `브랜딩 게시 / Publish branding`과 대상 화면의 `앱 게시 / Publish app`는 서로 다른 상태를 바꾸므로, 최종적으로는 **대상 화면의 운영 중 표시**를 확인한다.

## 3 기존 클라이언트와 권한 확인

1. [클라이언트 화면](https://console.cloud.google.com/auth/clients?project=product-factory-510706)에서 기존 `Product Factory Analytics Collector`를 연다.
2. 승인된 리디렉션 URI가 `http://127.0.0.1:5179/oauth2callback`인지 확인한다. Client ID·Client Secret의 복사나 새 클라이언트 생성은 필요 없다.
3. [데이터 액세스 화면](https://console.cloud.google.com/auth/scopes?project=product-factory-510706)에서 기존 세 읽기 권한을 확인한다. 추가 쓰기 권한은 요청하지 않는다.

운영 전환은 OAuth의 동의·토큰 정책에 관한 변경이다. 기존 Factory의 배포 주소와 관리자 MFA는 유지한다.

## 4 운영 상태에서 인증을 다시 받고 보호 교체

이 단계는 agent가 로컬 보호 receiver와 기존 Supabase CLI를 준비한 뒤 진행한다. 본인이 콘솔에서 토큰을 복사해 전달하는 단계가 아니다.

1. agent가 기존 클라이언트의 암호화 보관본과 CLI 인증을 확인한다.
2. agent가 운영 상태의 동일 클라이언트로 새 OAuth 동의 요청을 연다.
3. 본인 계정을 선택하고 GA4·Search Console·AdSense 세 읽기 권한을 확인해 동의한다. 로그인·MFA 입력이 필요하면 본인이 공식 Google 화면에서 입력한다.
4. agent가 새 refresh token을 메모리와 보호 전달 경로에서 확인하고 기존 Supabase의 `GOOGLE_REFRESH_TOKEN`만 통제된 절차로 교체한다. Client ID·Client Secret과 다른 공급자의 인증은 유지한다.
5. 세 제품의 GA4·GSC·Bing 수동 수집과 다음 정규 예약 실행을 확인한다. API 성공과 저장된 보고서 행, 미수집 상태를 구분한다.

기본 `npm run setup:auth`는 Google 설정이 이미 있으면 자동 덮어쓰기를 중단한다. **설정을 삭제해 이를 우회하지 않는다.** 운영 전환 후에는 검증 대상을 환경변수로 준비하고 `--rotate-google-after-production`을 명시한 보호 교체 경로를 사용한다. 이 경로는 기존 클라이언트 digest·새 토큰의 scope·실제 접근을 검증한 뒤 refresh token 하나만 교체한다. [보호 전달 규약](OAUTH_HELPER.md).

운영 모드에서 새로 받은 인증으로 갱신하는 절차이며, 기존 테스트 토큰의 만료 조건이 게시 버튼만으로 바뀌었다고 가정하지 않는다. 운영 토큰도 권한 철회 등으로 무효화될 수 있다. [토큰 만료 정책](https://developers.google.com/identity/protocols/oauth2/#expiration).

## 5 완료 확인

- [x] 기존 Google 프로젝트의 대상 화면이 **외부 / 운영 중**이다.
- [x] 기존 OAuth 클라이언트와 세 읽기 권한을 유지했다.
- [x] 운영 모드에서 다시 동의하고 refresh token을 보호 교체했다.
- [x] IPOScore·Holdwise·오늘슬로프의 GA4·GSC·Bing 수동 요청이 정상이다.
- [x] 기존 예약 endpoint 호출도 세 제품·세 공급자 모두 성공했다. 원래 cron 일정을 유지한다.
- [ ] 교체 후 첫 정규 예약 실행을 추가 확인한다. 다음 실행은 10/25 GSC 13:00, GA4 13:10, Bing 13:20 KST다.
- [x] Google 동의와 운영 전환 후 인증 교체 일시를 값 없이 기록했다.

신규 제품의 성공 응답이 0행이면 보고서가 쌓이는지 관측한다. 7일 제한 해소의 근거는 운영 상태에서 발급된 인증과 정상 갱신이며, 7일 이상 경과 후 정상 예약 실행을 추가 확인하면 지속 운영의 근거가 된다.

## 다음 실행 요청에 복사할 문구

아래 문구는 사용자가 실행을 요청할 때 복사하는 작업 범위다. 문서 작성 자체가 클라우드 변경이나 토큰 교체를 실행하지는 않는다.

```text
Product Factory Google OAuth를 본인 계정만 사용하는 개인용 운영으로 설정하라.
docs/GOOGLE_OAUTH_PERSONAL_RUNBOOK.md의 절차를 따르라.
기존 product-factory-510706 프로젝트와 Product Factory Analytics Collector를 유지하라.
사용자 유형은 External을 유지하고 게시 상태는 In production으로 전환하라.
게시가 막히면 실제 필수 설정을 확인하고 필요한 공개 안내·정책 페이지를 먼저 준비하라.
개인용 심사 예외와 콘솔의 필수 설정을 구분하라.
운영 모드에서 동일한 세 읽기 권한으로 다시 동의하고, 검토된 보호 교체 경로로 refresh token만 교체하라.
기존 자동 덮어쓰기 방지 장치를 삭제하거나 인증값을 먼저 지우지 마라.
비밀번호·MFA·token·Secret 값을 채팅·로그·파일에 출력하지 마라.
세 제품의 수동 수집과 정규 예약 실행까지 검증하라.
기존 관리자 MFA와 다른 인증·운영 데이터·정규 일정을 보존하라.
본인 인증이나 작업 시점의 필수 승인이 필요한 단계만 요청하라.
```
