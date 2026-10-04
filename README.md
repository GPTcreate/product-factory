# Product Factory v0.1

개인 운영자가 제품 포트폴리오, 트래픽·검색·광고수익, 아이디어 평가와 주간 출시 파이프라인을 관리하는 단일 관리자 대시보드입니다.

Based on [jafforgehq/site-analytics-tool](https://github.com/jafforgehq/site-analytics-tool), upstream commit `27b1c087d84fb86762cdc4eac31d7ec06cc9dea9`. Original MIT license and attribution are preserved in [LICENSE](LICENSE). Original operator documentation is retained in [docs/UPSTREAM_README.md](docs/UPSTREAM_README.md).

## 구현 범위

- Overview: 제품 상태, 연간 출시 / 72, 주차, 트래픽·검색·성장 분석, 제품별 AdSense 수익.
- Products: Product Code / Market / Language / Level / Version / Status, CRUD, P001 IPOScore 등록 프리셋.
- Product Detail: Overview / Traffic / Search / Revenue / Events / Health.
- Ideas: 시장별 아이디어 CRUD, 근거·경쟁·운영위험, 8개 항목 가중 Opportunity Score.
- Factory: 주간 담당 제품·가설·목표·결과·판단, 7개 상태 파이프라인. 52주 cadence와 최대 72개 실험을 별도로 표시.
- 기존 GA4/GSC/Bing, sync history, stale detection, uptime, ranking, anomaly/forecast, CSV/ZIP/JSON/PDF export 유지.
- AdSense: 읽기 전용 OAuth, 제품별 검증된 사이트 도메인 귀속, 일별 멱등 upsert, 수동/일정 동기화, 오류 기록.
- 관리자 allowlist + 필수 TOTP MFA + 읽기 전용 RLS 유지. 브라우저에는 서버 자격증명을 넣지 않습니다.

Stripe, 팀 기능, AI 아이디어/PRD 생성, Starter 자동생성은 포함하지 않습니다.

## 실행

Node 20 이상과 npm을 사용합니다.

```bash
npm ci
cp .env.example .env.local
# .env.local에 Supabase URL, publishable key, 앱 URL 입력
npm run dev -- --host 127.0.0.1
```

인증된 서비스 실행에는 Supabase 프로젝트가 필요합니다. 로컬 Supabase는 Docker + Supabase CLI의 `supabase start` / `supabase db reset`으로 준비합니다. 호스팅된 운영 DB에서는 reset을 실행하지 마세요. 신규 프로젝트 생성과 외부 OAuth·배포는 계정 승인 후 진행합니다.

## 검증

```bash
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npm run format:check
npx deno check supabase/functions/manage-sites/index.ts supabase/functions/manage-factory/index.ts supabase/functions/manual-sync/index.ts supabase/functions/scheduled-sync-adsense/index.ts
```

`test:db`는 임베디드 PostgreSQL에서 실제 migration/RLS/CRUD를 실행합니다. Supabase Auth/Vault/cron/net은 테스트 대역이므로 **호스팅된 Supabase 검증을 대체하지 않습니다**. `npm test`에는 OAuth→AdSense fixture→upsert 경로가 포함됩니다. 실제 광고 계정에 연결하지 않습니다.

브라우저 fixture 테스트는 [docs/TESTING.md](docs/TESTING.md)를 참고하세요.

## 설치·배포

[docs/SETUP.md](docs/SETUP.md): Supabase migration, Google/Bing/OAuth, Cloudflare Pages, P001 연결.

[docs/ADSENSE.md](docs/ADSENSE.md): 공식 API 정의, 귀속 방식과 수익 계산.

[docs/STATUS.md](docs/STATUS.md): 검증 결과, 운영 연결 전 남은 작업과 제한사항.

기술 스택은 원본 React/Vite/Tailwind/React Query + Supabase를 유지합니다. DB 내부의 `sites` / `site_id`를 유지해 기존 기록을 보존하며 화면에서 Product로 확장합니다. 개별 제품 기술 스택은 Factory와 독립적입니다.
