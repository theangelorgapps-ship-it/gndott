# Gates: secure authentication

- [x] G1: Existing Laravel bcrypt passwords authenticate without changing user IDs, subscriptions or profiles; disabled/deleted/banned users remain blocked; inputs, origin checks and rate limits enforced.
  CHECK: `node scripts/gate-auth.mjs`
  EXPECT: `AUTH PASS`
  EVIDENCE: Passed November 8. Production helpers execute against disposable SQLite and real bcrypt; imported `$2y$` stays unchanged, IDs 42/73 and active subscription retained, incorrect/inactive accounts rejected, email/IP limits enforced.
- [x] G2: Google and Apple authorization-code routes verify signature, issuer, audience, expiry, nonce, one-use state and browser binding; existing accounts require authenticated identity linking.
  CHECK: `node scripts/gate-auth.mjs`
  EXPECT: `AUTH PASS`
  EVIDENCE: Passed November 8. Generated RSA/JWKS fixtures exercise both providers, PKCE, Apple form POST, malformed/forged claims, replay, expired/wrong-browser state, safe password-once linking, old immutable subjects, transactional rollback and Apple P8-generated ES256 client-secret verification. No real provider calls.
- [x] G3: Halobox branded supplied sign-in design uses real login/provider flows and no fake OTP/reset success; responsive UI verified.
  EVIDENCE: Component and real form/provider wiring implemented; `npx tsc --noEmit --pretty false` passes. UI assertions in auth gate confirm no exposed OTP or tokeninfo shortcut and truthful reset-unavailable copy. Root verified the branded login at 320px and live at 391px; fields fit and both unavailable providers are clearly disabled.
- [x] G4: Provider deployment configuration and required migration documented; external activation truthfully recorded.
  EVIDENCE: `docs/authentication.md` includes exact callbacks, secret names, migration order, legacy linking and provider setup checklist. `migrations/20261108_auth_identity.sql` creates isolated auth tables and does not mutate imported credentials or access. Source schema confirms case-insensitive unique email index. Actual Google/Apple consent remains blocked on provider setup; not claimed complete.

## External evidence / handoff

- Root deployed the isolated auth migration and stored the recovered Google client ID/secret as Cloudflare secrets with GOOGLE_AUTH_ENABLED=0. The existing session secret is preserved; Apple credentials are still missing.
- Prior private migration snapshot contains Google client ID + secret with old callback on halobox.tv; recovery availability reported to root without disclosing values. Provider callback must be registered for the current live build before activation.
- Original `user_providers` is empty, and source users have no immutable provider subject column. `login_type` alone is insufficient to link an identity safely.
- Apple source `apple_api_key` is not a private key or client-secret JWT. Services ID/team/key/P8 configuration remains required.
- The prior OTP endpoint exposed its actual login code; disabled fail-closed. Forgotten-password previously simulated email delivery; honest support recovery now shown until a verified delivery service exists.
- No package installation, commit, deployment, browser automation or persistent process started by this leaf.

- Private Google extraction is staged under ignored `.unlazy/nov08-auth` with a mode-0600 JSON and `GOOGLE_AUTH_ENABLED=0`; no values logged; root stored the Google secrets without enabling the provider. Both providers require an explicit enabled flag after callback registration. Auth gate now verifies credentials without flags remain unavailable.
