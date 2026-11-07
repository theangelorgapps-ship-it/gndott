# Restore Bible service before publishing

- [x] B1: Reproduce the deployed failure and verify a secure provider-preserving transport in an isolated preview.
  EVIDENCE: Existing Worker fetch returned upstream HTTP525; local Node/workerd succeeded. Native Cloudflare TLS with certificate validation enabled succeeds in version 6d9cfa0c-a1ed-4425-af3e-645518086a24. Same api.prayerpulse.io origin, paths and payloads. No plaintext, certificate bypass, proxy or replacement data provider.
- [x] B2: Implement the smallest reliable fix with existing Bible API shapes and translations preserved; failure, timeout and input-validation tests pass.
  CHECK: node scripts/gate-bible-transport.mjs
  EXPECT: exit 0
  EVIDENCE: Parent reran 12 focused test groups, including invalid origins/paths, malformed framing/JSON, TLS/read/write failures, cancellation, deadline and response-size bounds. No dependency added; the dedicated HTTP/1.0 identity-JSON transport is necessary because native fetch fails at the deployed edge. Ponytail review: no speculative retries, config layer or generic HTTP client.
- [x] B3: Build and typecheck pass; a preview deployment loads books and chapters for KJV, ESV, AMP and NIV and renders the reader successfully.
  EVIDENCE: Strict tsc with noUnused flags and npm run build pass. gate-bible-live.mjs against https://6d9cfa0c-gndott.theangelorgapps.workers.dev passed 9 real RPC reads: all four translations, full book lists, John 3 and KJV John 4. Browser rendered KJV John 3, switched to NIV, navigated John 4 (54 verses), switched to Psalms 1 then KJV. Two-column reader visible at1280px with no document overflow; screenshot verification/bible-fixed-preview.png. No client assets changed in upload.
- [x] B4: Only after preview verification, push and publish the fix; live books, chapters and reader navigation pass, and temporary processes stop.
  CHECK: node scripts/gate-bible-live.mjs
  EXPECT: exit 0
  EVIDENCE: Source892a18d pushed to origin/codex/apple-tv-experience. Exact verified version6d9cfa0c-a1ed-4425-af3e-645518086a24 deployed at100%. All9 live RPC reads passed. Fresh live browser rendered John3 (36 verses), Next chapter→John4 (54 verses), Book→Psalms1. Phone400×844 renders one column with document width400; desktop reader screenshot saved. Proof: verification/bible-fixed-live-desktop.png and bible-fixed-live-mobile.png. Temporary CLI/build/test processes complete; no new server/watch/tail remains. Browser viewport reset; existing user-requested localhost preview retained.
