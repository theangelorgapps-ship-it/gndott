# Backend and assets audit
- [x] B1: Scan server/library/data code and asset references for complexity; preserve database-driven assets and API contracts.
  CHECK: node scripts/gate-library.mjs && node scripts/gate-viewer.mjs && node scripts/gate-playback-data.mjs && node scripts/gate-recommendation-v2.mjs
  EXPECT: RECOMMENDATION_V2_OK
  EVIDENCE: audit-backend.md records all 18 src/lib files (17 TS/2160 lines plus manifest), 562 public files, 70 server functions, local DB path/CMS checks and 5388 actual image-resolver equivalence cases. Library/viewer/playback/recommendation checks exited 0; 536 manifest targets preserved.
- [x] B2: Document release prerequisites (migration/configuration/secret names only), ranked safe cuts and measured savings; no application files changed.
  EVIDENCE: audit-backend.md documents 2 proven cuts totaling 48236 source bytes; migration/DB/IMAGES/MEDIA prerequisites, required setting names, existing auth concerns, asset uncertainty and all four passes. This leaf wrote only audit-backend.md and backend-GATES.md; no application or production changes, installs, Git mutations or background services.
