# Gates: integrated November 8 refinement

- [x] G1: Catalogue, store controls and legacy route redirects work with category chips, round filter and sorting.
  EVIDENCE: Catalogue/refinement and store bridge behavioral checks pass; live phone catalogue verifies round toggle, chips, category/upload year and newest ordering. Canonical /sermons and /shows preserve old link query/hash through redirects.
- [x] G2: Nimbus player tabs, rounded glass settings and compact live chat preserve playback and moderation.
  EVIDENCE: Player, Nimbus lifecycle, live playback/discussion, library and glass-live checks pass. Live Catch The Fire opens and starts from one Play click; readyState 4, time advances, duration 1744.04. Mobile Bible sits below video; chat collapses/reopens. Production block migration applied.
- [x] G3: Header does not darken on scroll; embossed dock, glass submenu/pickers, grey selection and royal pastel blue match request.
  EVIDENCE: Responsive browser checks at 320/391px and 3840x2160; header background transparent and darkening layer hidden, no horizontal page overflow. Live screenshots saved under verification/nov08-refinement.
- [x] G4: Migrated password sign-in and verified Google/Apple account flow implementation preserve existing database ownership.
  EVIDENCE: Auth behavioral checks cover actual Laravel bcrypt and unchanged fixture IDs, profiles/subscriptions, disabled/banned/deleted protection, signatures/claims, state/nonce/PKCE/replay and safe linking. Isolated auth migration applied to production; no imported user rows rewritten. Live branded login is responsive and unavailable providers are disabled. Real provider activation is separately tracked in G8.
- [x] G5: Owned images convert and serve AVIF; originals pruned only after replacement verification, with manifest.
  EVIDENCE: 557 bundled images complete. All 831 R2 conversions, reference rewrites, guarded original deletions and final full verification pass. Original recovery backups and the signed-operation receipt manifest remain outside the repository. Public legacy URLs serve their AVIF replacements; private paths remain inaccessible.
- [x] G6: Typecheck, production build and relevant regression/security checks pass.
  EVIDENCE: tsc/build plus auth, catalogue, glass/live, Nimbus, player, live playback/discussion, store bridge, subscription checkout, refinements, library, media and static image checks pass. Store compatibility regression passes the real 16-tile fixture and 23 malformed variants; final production build passes.
- [x] G7: Authorized release deployed and live critical paths verified; no task processes left running.
  EVIDENCE: Release e3688696-01dc-4940-a776-2126d44cb42b deployed. Store image returns 200 image/avif and fully decodes at 1600×1986; all visible phone store images load without horizontal overflow. Final proof saved. All task processes stopped and viewport reset. Temporary gndott-media-avif-migration Worker deleted after final 831-object verification.
- [ ] G8: Google and Apple are enabled after real provider registration and consent callbacks are verified.
  EVIDENCE: Google client credentials recovered privately and stored as Cloudflare secrets with GOOGLE_AUTH_ENABLED=0. Current callback registration needs provider-console access; Apple Services ID/team/key/P8 is missing. A request for the signed-in provider consoles is pending. No provider activation or end-to-end migrated viewer sign-in is claimed.
