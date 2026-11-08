# Gates: release 2 entitlement

- [x] E1: Monthly/annual owner plus separate email members enforce 2/4 users and 5/10 pooled devices server-side; expiry/removal/downgrade deny safely.
  EVIDENCE: `node scripts/gate-release2-entitlement.mjs` passes 57 assertions. Production core runs against isolated SQLite, including the real migration applied twice. Monthly owner + one reserved invitation; annual owner + three. Concurrent invitations cannot overbook; concurrent pooled device admission caps at 5/10. Downgrade stops higher seats/device ranks. Expired/malformed/future/inactive/replaced subscriptions, disabled owners, changed member email, revoked/expired sessions and forged session IDs deny. Profile changes reuse the same session. PPV remains separately purchased.

- [x] E2: Authenticated owner membership/device controls and member acceptance are functional; privacy/CSRF/concurrent admission tested; no emails sent.
  EVIDENCE: Real membership handlers and core execute offline. Cross-origin POST and signed-out requests fail. Invitations store only SHA-256 digests of 256-bit random secrets, expire after 7 days, reserve seats, and accept only the authenticated database email. URL fragment holds the secret and is cleared into session storage by the acceptance page. Removal atomically revokes enrolled viewer sessions. Owners manage members/devices; members can leave and remove their own devices. Members receive no other member emails, profiles, library, billing, session IDs or tokens. UI includes invite/copy, removal confirmations, leave and device controls. `/subscription-invite` supports login return and explicit acceptance. No invitation email transport exists.

- [ ] E3: Plan/account/admin descriptions match enforced policy, compatible migrated users and existing checkout; tests/typecheck pass.
  EVIDENCE: Plan/account/admin copy states separate email logins, owner included, pooled devices. Billing/admin status respects paid dates. Passing commands: `node scripts/gate-subscription-checkout.mjs`, `node scripts/gate-library.mjs`, `node scripts/gate-better-auth.mjs`, `node scripts/gate-nov08-security.mjs`, and `node scripts/gate-live-tv.mjs discussion`. Security gate executes actual detail handlers for missing plan, full pool, wrong plan, allowed subscription, separate PPV and inherited episode denial. Live gate uses real shared policy. Main tsc currently only reports parent-owned generated tree missing `/subscription-invite`. Admin tsc initially passed; final rerun reports the content leaf's new `/admin/locations` route missing from its generated tree and resulting loader types. Parent must regenerate both trees, rerun tsc/build and complete browser UI QA before checking E3.

## Four passes

1. Identity/capacity: separate accounts, reserved invitations, matched authenticated email, billing/profile isolation.
2. Concurrent devices: atomic conditional insertion with session ownership, shared pool, removal and expiry. Fixed text-stored numeric expiry compatibility found by tests.
3. Lifecycle: textual duration snapshots, legacy fallback, start/end validity, latest subscription authority, downgrade and eligibility.
4. Boundaries/regressions: subscription source policy, separate PPV, paid channels, real detail handlers, checkout/auth/library tests and typechecks.

## Migration/integration

Only migration: `migrations/20261108_release2_shared_entitlements.sql`. Additive tables/indexes/views, applied twice by the offline gate. No existing users, profiles, legacy devices, payments or subscriptions rewritten. Apply before corresponding app deployment. Policy uses subscription `month`/`year` duration snapshots and falls back to plan duration for legacy numeric records. A latest expired/inactive replacement never resurrects an older plan.

`api.ts` includes requested personality/location wiring. Subscription flags: `movie.hasSubscriptionAccess`, `video.hasSubscriptionAccess`, `show.hasSubscriptionAccess`, and `episode.hasSubscriptionAccess`. Parent/experience own player prop integration and generated route trees.

## Honest limits

- A device is an enrolled live **viewer authentication session**, pooled across the plan. Separate browser sign-ins count separately. Legacy device records do not grant access. Relogging while an old session remains active can occupy another slot; owner/member controls remove it. This is conservative session counting, not hardware identification.
- Expiry/removal/downgrade are enforced before restricted source issuance. Already-issued static Bunny media URLs cannot be revoked at the CDN by this implementation. Provider URL signing would be needed; no provider credentials/settings changed.
- Parent-supplied read-only audit shows current movies/videos/episodes are all free. Restricted cases use isolated fixtures. No production memberships/accounts, purchases, emails or data writes by this leaf.
- Browser invite/device UX remains parent integration work. No servers/watchers/background processes started by this leaf.
