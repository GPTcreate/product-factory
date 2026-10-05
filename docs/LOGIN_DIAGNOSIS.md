# Production login diagnosis

Production: https://product-factory-1ov.pages.dev/

## Findings

| Check | Evidence / limitation |
| --- | --- |
| Exact URL | Earlier live browser observations showed the Production origin and `/login`, not a Preview URL. The current navigation attempt was blocked by native credential protection. |
| Hard reload / fresh session | Earlier ordinary reload reached the login form. No completed hard reload or isolated-session authentication comparison; current credential protection prevents it. |
| Deployed Supabase project | Expected project is `nemkjxdxswwtrlufcykp`. Current public bundle could not be downloaded: terminal GET received HTTP 403, body `error code: 1010`. Therefore current deployed bundle/project equality has not been independently verified. |
| Production / Preview variables | Dashboard comparison unavailable because the Cloudflare dashboard previously rejected the cloud browser. Do not assume equality or change Preview settings without evidence. |
| Actual Auth response | The real failed password-login HTTP response/code/message was not captured. Passwords, tokens and MFA secrets were neither requested nor inspected during this diagnosis. |
| Browser console/network | Current observation blocked by native credential protection. The earlier UI message alone cannot identify the actual Auth failure. |
| Error conversion | Confirmed: `LoginPage` mapped every returned Supabase error to `Invalid email or password.` and did not handle thrown errors. |
| CORS / storage / network | A non-browser request to Auth `/settings` using the public publishable key returned 200 and the Production origin in ACAO. OPTIONS on Auth `/token?grant_type=password` returned 200, ACAO `*`, requested headers allowed. This does not validate Cloud Browser networking or storage. The app uses Supabase JS session persistence; no direct custom cookie adapter. No storage values were inspected or cleared. |

## Local correction

- Only `invalid_credentials` is labelled as an email/password failure.
- Rate limits, server failures, network failures, browser storage exceptions and API-key configuration errors get distinct safe messages.
- Both returned and thrown errors are handled.
- Diagnostics log only the category, numeric status and allowlisted error codes. They never log raw errors, email, password, tokens, request bodies or response bodies.
- No account setting, password or MFA change.

## Validation and deployment

- 17 targeted tests passed, including returned and thrown network failures and checks against exposing raw error content.
- TypeScript/Vite build and targeted ESLint passed.
- Changed code passed a targeted secret-pattern scan and `git diff --check`.
- Deployment pending: Git push dry-run failed because no GitHub credential was available. Browser upload is currently blocked by native credential protection. No correction has been deployed.
- Mobile login/MFA success is user-confirmed. Cloud Browser login failure was previously observed; the underlying cause is still undetermined. The terminal's Cloudflare 1010 response must not be presented as proof of the Cloud Browser Auth failure cause.
