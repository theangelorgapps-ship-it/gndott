# November 8 release 2 verification

## Scope and order
Finish and publish Locations, personality popup, shared subscription logins/devices, end screen, delayed muted hero playback, mobile typing, AVIF Watch icons and visual corrections. The queued admin/media expansion follows this release.

## Verified
- Website build and TypeScript pass. Player, preview, typing geometry, content, 57 entitlement assertions, subscription checkout, Better Auth, security, library, billing, readable routes, AVIF, account and live discussion regressions pass. All email transports in tests were mocked; no setup emails or charges were sent.
- Responsive browser geometry: document overflow 0 at 320, 430, 768, 1440 and 3840px. Mobile dock and shelf remain inside viewport. White Play, bookmark Library and compact shop heading inspected.
- Hero video observed playing muted with advancing time; mute/unmute and pause/resume work. Delay is 1.2 seconds before requesting playback; network first-frame timing is not guaranteed.
- Personality dialog uses actual portrait/biography, opens at 430px, traps modal interaction and restores focus on close.
- Notes browser at 430x430 with 30 lines: final caret top366.695/bottom385.695 remains above viewport bottom430. Native OS keyboard was not physically exercised; this is a device QA limitation, not a claimed device pass.
- Four Watch icons decode as 256x256 AV1 AVIF with alpha, totaling48,864bytes. Contact sheet inspected at128px and56px.
- Production additive migrations succeeded:6 Locations,204 content mappings,204 original associations retained. No memberships/devices created by migration. D1 recovery bookmark recorded locally before changes.

## Subscription semantics
Monthly includes the owner plus one separate email login and five pooled viewer authentication sessions. Annual includes owner plus three email logins and ten pooled sessions. Invitations are manually shared, expire in7days and require the invited authenticated email. Profiles and libraries remain private. Device means an active enrolled browser sign-in session, not hardware identification. Existing static Bunny URLs cannot be revoked at CDN after issuance; signing is needed for that capability.

## Deployment
Pending final admin merge/build and both repository pushes/deployments. No live sign-in, email, invitation, purchase or payment tests.
