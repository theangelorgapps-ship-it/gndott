# Gates: signed-in

Scope: profile-aware signed session and login/profile/account presentation. Parent owns the local browser journey and real profile-scoped history integration.

- [x] 1: Login and profile selection flow functional with server-validated active profile.
  EVIDENCE: login.tsx:86 redirects only after login success; manage-profile.tsx:78 awaits selectViewerProfile before full home navigation. viewer.server.ts:39 validates active account and owned non-deleted pid. Missing/foreign/deleted pid returns a null profile without fallback. gate-viewer.mjs executes real signed-cookie helper, D1 adapter and viewer server functions against isolated SQLite.

- [x] 2: Signed-in account/library destinations and profile switching understandable.
  EVIDENCE: Account.tsx:11 links Continue Watching alongside Watchlist, rentals, payments and personal details; active profile name and Switch profile link are shown. Account.tsx:39 awaits existing logout and reloads login. account-setting.tsx:27 exposes library shortcuts. Removed nonfunctional subscription Cancel, Remember Me, Apple placeholder and public demo credentials while retaining actual login/OTP/Google/account destinations.

- [x] 3: Accessible and responsive signed-in presentation, errors recover.
  EVIDENCE: Named email/password fields and visibility state; role=alert request errors; busy guards reset on rejection; explicit reload/retry paths; anonymous account and zero-profile states differ. Native showModal dialog at manage-profile.tsx:30 supplies focus containment/Escape support; child-profile label explicitly does not promise filtering. auth-flow.css provides 700px/1000px responsive layouts, focus indicators and reduced motion. Parent root imports auth-flow.css. Source inspection only; parent owns browser verification.

- [x] 4: Typecheck and active-profile ownership/isolation tests pass.
  CHECK: ./node_modules/.bin/tsc --noEmit && node scripts/gate-viewer.mjs
  EXPECT: VIEWER_OWNERSHIP_OK 13 cases
  EVIDENCE: PASS server boundary preserves GET reads and POST profile mutation | VIEWER_OWNERSHIP_OK 13 cases; real signed session and SQL; no remote writes

## Four passes

1. Implemented signed profile selection, real account destinations and the login/profile/account flow.
2. Expert reread separated account authentication from active profile choice, enforced no silent fallback, and removed controls without backing actions.
3. Adversarial SQLite tests exercised signed-cookie tampering, cross-account selection, profile/account deletion, banned/inactive accounts, invalid inputs, no-profile accounts, claim preservation and database failures. Fixed Google retry rendering after checking failure/unmount paths.
4. Polished focus/labels, responsive wrapping, loading copy and empty-state actions. Final owned-source reread and diff whitespace check found no additional issue. No browser, app process, install, Git mutation or remote data write was performed by this leaf.
