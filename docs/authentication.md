# Halobox authentication

The supplied `modern-stunning-sign-in` visual shell is adapted in `src/components/ui/modern-stunning-sign-in.tsx`, with Halobox branding, the local AVIF logo and real form handlers. Styling is in `src/sign-in.css`. This project already uses TypeScript, Tailwind and `src/components/ui`; no new dependency or scaffolding is needed.

## Deployment order and configuration

1. Apply `migrations/20261108_auth_identity.sql` to the **existing migrated Halobox D1 database** before deploying the new server functions. The migration only adds auth tables/indexes. It does not rewrite imported users, hashes, subscriptions or profiles.
2. Keep the existing `SESSION_SECRET` Cloudflare secret (at least 32 characters). Rotating it signs out existing sessions.
3. Set the following Cloudflare bindings/secrets through the authenticated provider dashboards. Never commit their values, put them in `VITE_*`, return them to the browser, or copy them into logs.

| Provider | Server configuration | Registered callback |
| --- | --- | --- |
| Google Web OAuth client | `GOOGLE_CLIENT_ID`, secret `GOOGLE_CLIENT_SECRET`, `GOOGLE_AUTH_ENABLED=1` after callback registration | `https://gndott.theangelorgapps.workers.dev/auth/google/callback` |
| Sign in with Apple Services ID | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, secret `APPLE_PRIVATE_KEY` (PKCS#8 .p8 signing key), `APPLE_AUTH_ENABLED=1` after callback registration | `https://gndott.theangelorgapps.workers.dev/auth/apple/callback` |

For Apple, an existing unexpired `APPLE_CLIENT_SECRET` may replace team/key/private-key configuration. The preferred private-key configuration signs a five-minute ES256 client secret on the server for each exchange. Register the website domain `gndott.theangelorgapps.workers.dev` and Services ID in the Apple Developer account. Google requires the Web OAuth client type, correct consent-screen audience, and exact callback URI. If the app is in testing mode, explicitly authorized testers must be able to access it.

`AUTH_ORIGIN` defaults to `https://gndott.theangelorgapps.workers.dev`. It can be set to the canonical HTTPS domain when that domain changes. It is never inferred from client-submitted redirect data; provider callbacks need to be registered again for a changed domain. Do not configure the superseded preview deployment as the callback. Local password sign-in works on its same origin; OAuth uses the configured HTTPS origin.

Provider buttons are enabled only when their required server configuration is present **and** the provider's explicit `GOOGLE_AUTH_ENABLED` or `APPLE_AUTH_ENABLED` binding equals `1`. The default is off. Recovered Google credentials are staged with `GOOGLE_AUTH_ENABLED=0`; set it to `1` only after registering and validating the exact current callback in Google Cloud, then complete a real consent check. Keep Apple off until the equivalent Apple setup is ready. The public configuration response contains **only two booleans**, not keys. A configured button still requires a successful provider consent test; presence of a secret is not proof of a working provider registration.

### Current external state (November 8, 2026)

The isolated auth migration is deployed to the existing D1 database. Google Web client credentials recovered from the private Laravel snapshot are stored as Cloudflare secrets with `GOOGLE_AUTH_ENABLED=0`. The source used the old callback `https://halobox.tv/auth/google/callback`; validity and registration of the current callback still require provider-console verification. Apple credentials are not configured. Its `apple_api_key` setting is an opaque value, not a Services ID, private key or client-secret JWT, so it is insufficient for Sign in with Apple. The user has been asked to open the provider dashboards. Actual provider activation and consent callbacks remain unverified until setup is completed. These are not marked complete by the offline tests.

The existing database contains 478 Laravel bcrypt hashes and one bcrypt hash; the legacy `user_providers` table is empty. `login_type=google/apple` is not an immutable provider subject and must not be treated as proof of identity. No accounts are re-enabled by this change.

## Returning migrated users

Email/password sign-in normalizes the lookup email and verifies the existing bcrypt hash. `$2y$` is interpreted as compatible `$2b$` for comparison only. The stored hash, user ID, profile IDs, subscriptions and viewing data remain intact. An account must be active, not banned and not deleted. Ambiguous email matches fail closed.

Existing immutable provider IDs in `user_providers` are honored if later recovered from the legacy source. Otherwise, a verified Google or Apple response with a matching existing email opens a ten-minute, browser-bound pending link. The viewer enters that account's existing password once; successful authentication attaches the provider subject to that same user ID. Future provider sign-ins go directly to the account. A matching email alone never overwrites credentials or attaches a provider to a migrated account.

For returning social-only users who do not know a password, recovery needs a verified email-delivery service or recovered legacy provider IDs. Do not invent a password, enable a disabled account, or create a second user to bypass this requirement. This can be completed once that external evidence/service is available.

## Endpoint contracts

Existing TanStack server-function names remain stable for current clients.

| Handler/route | Request | Response / effect |
| --- | --- | --- |
| `login` POST server function | `{ email, password }` | `{ ok, user?, profiles?, error? }`; creates signed HttpOnly session on success |
| `register` POST server function | `{ firstName, lastName, email, mobile, password }` | `{ ok, error? }`; creates account and first profile on success |
| `changePassword` POST server function | `{ current, next }` | `{ ok, error? }`; active authenticated user plus correct existing password required |
| `getSocialConfig` GET server function | none | `{ googleEnabled, appleEnabled }` |
| `GET /auth/google` or `/auth/apple` | no client redirect or client credentials | 302 to fixed provider, ten-minute browser-bound challenge |
| `GET /auth/google/callback` | `state`, authorization `code` | 303 to profile picker, password-link step, or safe sign-in error |
| `POST /auth/apple/callback` | form-encoded `state`, authorization `code` | Same redirect outcomes; body bounded to 20 KB |
| `GET /auth/apple/callback` | cancellation/error or compatible redirect response | Same one-use state validation |
| legacy `googleSignIn` POST | old GIS credential shape | Safe instruction to restart the bound flow; never trusts an unbound token |
| legacy `requestOtp` / `verifyOtp` POST | existing request shapes | `{ ok: false, error }`; no code or account access is returned |

Authentication failures use generic messages and fixed redirect destinations. Rate limiting uses salted hashes of account/IP buckets, with a ten-minute window (12 account attempts, 60 IP attempts per action). No passwords, authorization codes, access/refresh tokens, provider keys or raw IPs are stored in audit events. Pending challenges/link tickets are consumed once and expire after ten minutes. Provider responses are fetched only from fixed HTTPS endpoints, with a timeout and redirect rejection.

Google's authorization code is exchanged server-side with PKCE. Both Google and Apple ID tokens require an RSA signature from their fixed JWKS endpoint, allowed issuer, configured audience, valid issue/expiry times and the server nonce. Unsupported signing algorithms and header-supplied key URLs are rejected. Provider key rotation refreshes the cached JWKS once. The Apple callback cookie uses `Secure; HttpOnly; SameSite=None` because Apple posts cross-site; the state, browser secret, nonce and one-use database challenge protect that callback. The resulting session uses `Secure; HttpOnly; SameSite=Lax` on HTTPS.

## Removed unsafe placeholders

The previous OTP handler returned its actual login code to the caller. That was an account-takeover path, not a delivery integration. Both OTP endpoints now fail closed. The previous forgotten-password form reported email delivery without sending anything; it now honestly shows support recovery until a delivery service exists. No email is claimed sent.

## Verification

Run `node scripts/gate-auth.mjs` and `npx tsc --noEmit`. The auth gate executes the production helpers with disposable SQLite, real generated RSA signatures, real bcrypt and a mocked provider transport. It covers correct and tampered JWTs, audience/issuer/nonce/expiry, Google PKCE, Apple form POST, state replay/wrong-browser/expired challenge, migrated hashes and IDs, disabled/banned/deleted accounts, safe one-time linking, legacy immutable subjects, new verified accounts, secure session cookies, input constraints, account/IP rate limiting and configuration absence. It makes no production calls and charges nothing.

Manual deployment checks still required after provider configuration:

- On phone and desktop, sign in using a migrated viewer's existing password and confirm the same profile/library/subscription.
- Complete actual Google and Apple consent/callback flows. For a migrated account lacking an imported subject, verify the password-once link and subsequent direct provider login.
- Confirm cancellation and unavailable credentials show clear errors. Verify account linking never enables disabled users or duplicates an existing account.
- Confirm keyboard navigation, accessible field labels, show/hide password, calling-code picker and the sign-in layout at 320 px, tablet and desktop widths.

Official references: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Google claims reference](https://developers.google.com/identity/openid-connect/reference), [Google account email authority](https://developers.google.com/identity/sign-in/ios/backend-auth), [Apple verifying a user](https://developer.apple.com/documentation/signinwithapple/verifying-a-user), [Apple authentication flow](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple), [Sign in with Apple REST API](https://developer.apple.com/documentation/signinwithapplerestapi).
