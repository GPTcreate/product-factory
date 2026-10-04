# Product Factory 설치 및 운영 연결

## 1. GitHub

이번 작업에서 연결 계정은 `GPTcreate`, 이메일은 `hanmanju88@gmail.com`으로 확인했습니다. 계정이 바뀌면 원격 쓰기 전에 다시 확인합니다. 원본은 `jafforgehq/site-analytics-tool`, 기준 commit은 README에 기록했습니다.

먼저 해당 계정에 원본을 fork하고, 구현 브랜치를 push합니다. 원본 저장소에는 push하지 않습니다. 현재 도구가 fork 생성을 지원하지 않으면 승인받은 브라우저 작업으로 생성하거나 사용자 제공 저장소를 사용합니다. 원본 MIT LICENSE를 유지합니다.

## 2. Supabase

프로젝트 생성·연결은 계정 승인 후 수행합니다. 운영 데이터가 있는 프로젝트는 먼저 migration plan과 백업을 확인하며 reset하지 않습니다.

- 새 프로젝트: `supabase/migrations/0001`부터 `0013`까지 순서대로 적용.
- 원본 v0.6.0 설치: 적용 이력 확인 후 신규 `0011`, `0012`, `0013`만 적용.
- `0011_product_factory.sql`: products 필드, ideas, factory_weeks, adsense_daily_metrics, RLS, 4개 integration 자동 생성/정합성 트리거.
- `0012_adsense_schedule.sql`: 기존 Vault helper에 AdSense 허용, 매일 04:30 UTC(13:30 KST) 일정.
- `0013_analytics_detail.sql`: GA4 확장·이벤트·GSC 국가/기기, 동일 RLS, 광고 귀속 변경 보호.

단일 관리자 allowlist·aal2 정책은 원본과 같습니다. public signup을 비활성화하고 Auth에서 사용자를 생성한 뒤 `private.admin_users(user_id)`에 해당 UUID를 등록합니다. 앱에서 TOTP를 등록합니다. Auth Site URL/redirect와 `ALLOWED_APP_ORIGIN`은 실제 배포 URL로 맞춥니다.

`supabase/.env.example`의 서버 전용 항목을 Edge Function Secrets에 입력합니다. 서버의 service-role은 Supabase가 주입하며 프런트엔드에 복사하지 않습니다. `AUTOMATION_SECRET`은 충분히 긴 난수로 생성해 서버 secret과 Vault `automation_secret`에 동일하게 저장하고, Vault `project_url`에는 Supabase project URL을 저장합니다. 토큰을 채팅·소스·issue에 붙여 넣지 마세요.

배포할 함수:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy manage-sites
supabase functions deploy manage-factory
supabase functions deploy manage-portfolio
supabase functions deploy manual-sync
supabase functions deploy scheduled-sync-gsc
supabase functions deploy scheduled-sync-ga4
supabase functions deploy scheduled-sync-bing
supabase functions deploy scheduled-sync-adsense
supabase functions deploy scheduled-uptime
```

원본 `ai-briefing`은 보존하지만 v0.1에는 연결/과금 설정하지 않습니다.

## 3. Google / Bing / AdSense

Google Cloud에서 Analytics Data API, Search Console API, AdSense Management API를 활성화하고 OAuth 동의를 승인합니다. 사용하는 Google 계정에 해당 GA4/GSC/AdSense 권한이 있어야 합니다. 기존 OAuth 도구나 공식 OAuth Playground로 아래 scope를 함께 승인한 refresh token을 생성합니다.

- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/webmasters.readonly`
- `https://www.googleapis.com/auth/adsense.readonly`

Client ID / client secret / refresh token은 Supabase 서버 secret으로 저장합니다. Testing 모드 OAuth 토큰의 수명·재인증 여부는 Google 콘솔에서 확인합니다. Bing Webmaster API key도 서버에만 저장합니다.

추가 환경변수:

| 변수 | 위치 | 의미 |
| --- | --- | --- |
| ADSENSE_ACCOUNT | Edge Function secret | `accounts/pub-...` 계정 resource name |
| ADSENSE_CURRENCY_CODE | Edge Function 환경변수 | 고정 보고 통화, 생략 시 USD |

보고 통화는 초기 설정 후 고정하는 것을 권장합니다. 바꾸면 최근 재수집된 날짜와 과거 날짜의 통화가 다를 수 있어 합계가 숨겨집니다. 전체 기간을 같은 통화로 다시 수집한 뒤 확인합니다.

## 4. Cloudflare Pages

계정 연결 승인 후 GitHub fork를 연결합니다. 명시적 비용 승인 없이 유료 플랜을 선택하지 않습니다.

- Framework: Vite; Node 20 이상.
- Build: `npm ci && npm run build`; output: `dist`.
- `.env.example`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_URL`를 build 환경변수로 설정.
- 기존 `public/_redirects` SPA fallback을 유지.
- 서버 secret에는 절대 `VITE_` 접두어를 붙이지 않음.
- 배포 URL에 맞춰 Supabase Auth redirects / CORS를 확인.
- `/login` → TOTP → 대시보드 접근, 새로고침·직접 URL 접근을 확인.

현재 저장소의 Cloudflare 배포 설정은 준비 상태이며 배포 성공을 의미하지 않습니다.

## 5. P001 연결

Products의 **Register P001 · IPOScore** 버튼을 누르면 `P001 / IPOScore / iposcore.kr / Korea / ko / Level 1 / LIVE`가 채워집니다. 저장 전 확인하세요. 출시일은 알려진 실제 날짜를 입력합니다. 모르는 날짜를 임의로 입력하지 않습니다.

추가할 값: GA4 숫자 property ID, GSC 실제 property(`sc-domain:iposcore.kr` 등), Bing의 verified URL, AdSense에 실제 등록된 verified site domain. 연결 전에는 각각 Not Connected이며 매출 0으로 표시하지 않습니다. 식별자 입력은 자격증명 연결 완료를 뜻하지 않으므로 첫 수동 sync 결과로 확인합니다.

설정 이후 순서:

1. P001 제품 저장 → GA4/GSC/Bing/AdSense 개별 Run.
2. Sync history에서 success/partial/failed와 오류 코드 확인.
3. 제품 Revenue의 날짜·통화·수익을 AdSense 원본 보고서와 비교.
4. 같은 기간 다시 실행해 행 중복이 없는지 확인.
5. 당일 cron 수행 후 각 integration의 last_success_at 갱신 확인.
6. 익명 접근과 MFA 미완료 사용자의 데이터 차단 확인.

## 운영 참고

HOLD/KILL은 제품 생애주기 상태이며 데이터 수집 on/off와 구분합니다. 비용·유지보수를 줄이려면 해당 제품의 Active를 꺼 scheduled sync/uptime 대상에서 제외합니다. 실제 제품 자체를 종료하거나 외부 배포를 삭제하지 않습니다.

신규 AdSense/Ideas/Factory 테이블은 자동 삭제 대상에 포함하지 않았습니다. 크기는 System에서 관찰하고 보존 정책은 데이터 삭제 승인 후 변경합니다. GA4 확장·이벤트·국가/기기 데이터도 현재 자동 정리 대상이 아니므로 많은 제품을 연결하기 전에 사용량을 관찰합니다.
