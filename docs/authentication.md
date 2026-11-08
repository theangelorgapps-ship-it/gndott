# Halobox authentication

Viewer and admin authentication use Better Auth 1.7.18 on the existing Cloudflare D1 database. The viewer and admin applications keep their existing interfaces and data ownership.

## Current status — November 8, 2026

Better Auth is deployed to both applications. The shared D1 migration was applied once, with 479 user IDs, 478 profiles and 20 subscriptions retained. Before/after ownership aggregates match, all 479 credential copies match their legacy users, and there were zero duplicate normalized email addresses. Aggregate evidence is in `gates/better-auth/cutover-preflight.json` and `cutover-postflight.json`.

Google and Apple credentials are installed as server-only Cloudflare secrets and both providers are enabled. Live authorization initialization returns the correct provider hosts, application-specific callbacks, state and Secure cookies. The user completed Google consent but hit `account_not_linked` on a migrated viewer account. The website now permits tightly checked Google linking, with full offline callback regression coverage in `gates/google-linking/`. A user-completed sign-in after the fix and Apple consent remain unconfirmed; authorization initialization is not an end-to-end login test.

The canonical domains are **halobox.tv** for viewers and **fort.halobox.tv** for administrators. Cloud discovery confirmed halobox.tv is active in the Workers’ Cloudflare account. The application now supports user-requested sign-in codes and password-reset codes through Cloudflare Email Service. Production sender onboarding, bindings and provider callback registration are tracked by the deployment/integration gate; offline checks do not prove live delivery.

Previous authentication cutover website Worker version: `8c57fecb-75b9-4176-93c4-c04eb7e3bb7c`. Previous authentication cutover admin Worker version: `e21c2766-51fc-4cf5-a6fb-9bd4a5202005`. Before/after deployment snapshots are retained under `gates/better-auth/`.

## No-email restriction

The user explicitly prohibited emails **during setup and testing**, not normal user-requested sign-ins after setup. No real app email was sent. Delivery is fail-closed unless the production Worker has `AUTH_EMAIL_ENABLED=1`, an `EMAIL` Email Service binding, and a valid plain mailbox in `AUTH_EMAIL_FROM` (for example `auth@halobox.tv`). With any of these absent, direct OTP-send/reset requests return 503 before issuing a code. The integration owner controls these production settings. Link-based recovery is deliberately unavailable; the supported recovery method uses a six-digit email code. Tests use disposable `example.test` identities and an in-memory mailbox only. Local development cannot enable delivery even if its environment flag is set.

The Cloudflare Email Service adapter uses the structured `EMAIL.send({ from, to, subject, text })` Workers API. After halobox.tv is verified and its authorized sender/transport is configured, production delivery can be activated for user-requested sign-ins. The requested setup already authorizes this; no additional approval is needed merely because setup prohibited test emails. Do not send a test message, initiate a real OTP/reset flow, or email migrated users in bulk. Until activation, migrated users can use their existing password, and the OTP UI honestly reports that email sign-in is unavailable.

## Migrated users and ownership

Better Auth maps its user model to the existing `users` table. IDs stay numeric and unchanged; profile, subscription, watch history, notes and library references remain attached to the original user IDs. Imported Laravel `$2y$` bcrypt hashes are verified as compatible `$2b$` hashes without rewriting the existing password on login. New password hashes use bcrypt cost 12 with a 72-byte limit.

`migrations/20261108_better_auth.sql` normalizes email addresses, adds a unique normalized-email index, two auth user columns, Better Auth account/session/verification/rate-limit tables, and compatibility triggers. A duplicate email aborts the migration instead of merging accounts. Credential rows copy existing hashes under the same user IDs. Triggers keep legacy admin password writes and Better Auth credentials synchronized and revoke sessions in both realms on a password change. New users receive their first profile; existing profiles are retained.

Every authenticated operation checks current account eligibility: enabled, not banned, not deleted, and an unambiguous normalized email. No disabled account is re-enabled. Public signup always creates a regular viewer, with no subscription or administrative privileges.

## Admin isolation

Both apps share `ba_account` and the existing users, while sessions, verification challenges and rate limits use separate `ba_viewer_*` and `ba_admin_*` tables. Cookies use separate `halobox-viewer` and `halobox-admin` prefixes. A viewer cookie cannot authenticate the admin application. Admin access requires the current database role to be `admin` or `demo_admin`; admin self-registration is disabled. Current-role checks apply on every admin session. The centralized administration guard now treats `demo_admin` as read-only for mutations; normal `admin` accounts retain administrative access. Existing upload guards also require the full admin role. The application does not currently enforce a complete per-permission role matrix; see the security audit residuals.

Viewer sessions expire after 30 days; admin sessions after 12 hours. Sessions are database-backed, cookie caching is disabled, and logout revokes the active session. Password changes revoke sessions in both applications and issue a replacement for the session performing the change. Profile selection updates only an authenticated viewer session after confirming profile ownership. Old `streamit_session` cookies no longer authenticate after the cutover.

## Social sign-in and linking

Provider credentials remain server-only Cloudflare secrets. Never put them in `VITE_*`, client responses, repository files or logs. Buttons are enabled only when the provider is explicitly enabled and its necessary configuration is present.

| Provider | Server configuration | Callback URLs |
| --- | --- | --- |
| Google Web OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_AUTH_ENABLED=1` | `https://gndott.theangelorgapps.workers.dev/api/auth/callback/google` and `https://gndottadmin.theangelorgapps.workers.dev/api/auth/callback/google` |
| Apple Services ID | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_AUTH_ENABLED=1`; optional `APPLE_BUNDLE_ID` | `https://gndott.theangelorgapps.workers.dev/api/auth/callback/apple` and `https://gndottadmin.theangelorgapps.workers.dev/api/auth/callback/apple` |

Apple's `.p8` key signs a five-minute ES256 client-secret JWT on the server for each auth configuration. An existing `APPLE_CLIENT_SECRET` JWT is also supported, but it expires and requires rotation; the signing-key configuration is preferred. Apple's trusted callback origin is explicitly allowed. Better Auth owns state, PKCE, provider token verification and callback handling.

The website automatically links an enabled, unbanned ordinary viewer to an existing unique email only after Google supplies a validated, verified Gmail or Workspace identity for that exact address. Google's ID token is checked using Better Auth's verifier (signature, issuer, audience, expiry and maximum age); OAuth state/PKCE remain enforced by Better Auth. The `validateUserInfo` hook checks the raw verified claims before any account link is written. This handles migrated rows without the new local email-verification flag while preserving their user IDs, password credentials, profiles and subscriptions. Third-party email addresses used with Google, Apple identities and administrative accounts still require an existing authenticated session for first-time linking. Sign in by password (or OTP once delivery is enabled), then choose **Connect Google/Apple** in viewer Account settings or admin Settings → My Sign-in. Different-email linking remains disabled. Apple's private relay address may differ from the account email; use the same account email or continue using email authentication. See [Google's authoritative-email rules](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) and [Better Auth account linking](https://www.better-auth.com/docs/concepts/users-accounts#account-linking).

Production auth origins are pinned by `BETTER_AUTH_URL`, validated against the application’s own two origins: viewer `https://halobox.tv` or its legacy Worker origin, admin `https://fort.halobox.tv` or its legacy Worker origin. An admin origin cannot configure a viewer realm, or vice versa. Unconfigured production retains the old Worker callback until cutover. Only localhost development derives an origin from the request. Canonical OAuth callbacks must be registered as `https://halobox.tv/api/auth/callback/{google|apple}` and `https://fort.halobox.tv/api/auth/callback/{google|apple}` before switching `BETTER_AUTH_URL`; keep the corresponding provider disabled until its canonical callback is registered. Cookies remain host-only with distinct realm prefixes; do not set a shared `.halobox.tv` cookie domain. Existing legacy `/auth/$provider` callbacks redirect to the current sign-in page.

## Email OTP and recovery safeguards

Email OTP signs in existing eligible users only. It does not create a replacement account or change roles. Codes expire after five minutes, permit three wrong attempts and are hashed in the verification table. Single-use consumption, replay, expiry and concurrent redemption are covered by the isolated gate. Codes never appear in API responses or application logs.

Better Auth applies database-backed IP rate limits; additional salted email/action/realm buckets limit repeated attempts to 12 per ten minutes. All code-delivery endpoints share the recipient bucket, including the deprecated recovery alias, so changing endpoint or IP cannot bypass that limit. Password-reset redemption rechecks eligibility, uses its own purpose and realm, and revokes sessions in both applications. Unknown recipients get a generic success response without delivery or signup. Production uses Cloudflare's connecting-IP header. Authenticated server functions reject missing or foreign Origin headers on writes. Public Better Auth POST endpoints also require the exact configured origin even when no cookie is present. OAuth callback endpoints retain provider state/PKCE checks, including Apple’s POST callback. Reset and verification delivery stay unavailable while the delivery switch is off or sender configuration is absent.

## Completed cutover and recovery

1. Reconfirm the website repo/branch/remote and admin repo/branch/remote. Preserve unrelated edits.
2. Google/Apple registration and secret installation are completed under the user's provider-configuration approval. Provider flags are on; mail delivery is off.
3. Export a private backup of `halobox-migrated-20261105` and record its D1 recovery bookmark and both existing Worker version IDs. Keep backups outside Git with restricted permissions.
4. `migrations/20261108_better_auth.sql` has already been applied **once** to the shared database. Do not rerun it or apply it separately from the admin repository. Account counts, credential mappings and ownership aggregates were checked without logging personal data.
5. Build and deploy the website and admin changes as a coordinated cutover. Preserve existing secrets and bindings. The existing `SESSION_SECRET` is supported; a configured `BETTER_AUTH_SECRET` takes precedence. Do not rotate a secret as part of this work.
6. Anonymous login/session pages, the admin authentication redirect and blocked mail endpoints were verified live. Synthetic local Workers additionally verified password login, role isolation, profile ownership and logout. Real account/provider consent verification remains pending and must not be confused with those checks.
7. If rollout fails, roll back both Worker versions. The migration is additive and keeps legacy password fields synchronized. Use the database backup/bookmark only if data restoration is needed; a database restore could discard newer writes and requires separate review. Do not delete the new tables or originals during a routine application rollback.

## Verification

`node scripts/gate-better-auth.mjs` passed using real Better Auth handlers against a disposable SQLite database through the D1 dialect with the production table schema and synthetic users. It verifies migrated password and OTP login, original IDs and ownership, disabled/banned users, admin isolation, role injection, CSRF, hashed/expired/replayed/rate-limited OTPs, concurrent code consumption, signup profiles, logout, cross-realm password revocation, duplicate rejection and disabled email delivery. Explicitly enabled adapter behavior is exercised only against an in-memory fake transport. A disposable P-256 key independently verifies Apple client-secret signatures and claims. The gate performs no live provider calls or email delivery.

Type checks and production builds passed in both repositories. Live initialization and UI evidence is separate from the isolated tests; see `gates/better-auth/GATES.md`. The production integration gate records canonical domains, sender configuration/activation and provider callback registration. A user-completed provider consent check and actual email delivery remain separate from offline verification. Offline tests are not evidence of successful Google/Apple consent or actual email deliverability.

References: [Better Auth SQLite](https://www.better-auth.com/docs/adapters/sqlite), [TanStack Start integration](https://www.better-auth.com/docs/integrations/tanstack), [Email OTP](https://www.better-auth.com/docs/plugins/email-otp), [Apple provider](https://better-auth.com/docs/authentication/apple), [Cloudflare Email Sending Workers API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/).

## November 8 security and recovery verification

`node scripts/gate-better-auth.mjs` now additionally covers purpose/realm-bound reset codes, replay, banned-account redemption, both-realm session revocation, recovery recipient limits across changing IPs/endpoints, generic unknown-recipient responses, no challenge creation while delivery is disabled, and cookie-less recovery CSRF. All mail transports are in-memory.

`HALOBOX_ADMIN_ROOT=/absolute/path/to/gndottadmin node scripts/gate-nov08-security.mjs` exercises canonical-origin validation, server-side paid playback filtering, blocked unverified cash rentals, configured-only bounded VAST fetches, authenticated write CSRF, profile ownership and demo-admin mutation denial. It rejects all network access. See [the practical audit](security-audit-2026-11-08.md) for evidence, scope and residual risks.

Email API contract: `POST /api/auth/email-otp/request-password-reset` accepts `{email}` and returns generic success; `POST /api/auth/email-otp/reset-password` accepts `{email,otp,password}` and updates an eligible account without creating a session or changing its role. Success requires signing in again. Malformed/expired codes return 4xx, wrong origins 403, recipient/IP abuse 429, and unavailable delivery 503. The viewer form is `/forgot-password`; the admin form is “Forgot password?” on `/login`.

Official transport references: [Cloudflare Email Service sending](https://developers.cloudflare.com/email-service/get-started/send-emails/), [send binding restrictions](https://developers.cloudflare.com/email-service/configuration/send-bindings/), and [Better Auth email OTP recovery](https://better-auth.com/docs/plugins/email-otp).
