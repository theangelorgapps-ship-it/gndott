# Gates: media

Scope: Verified static AVIF replacements, conversion-only uploads, compatible R2 serving, store artwork cache, and guarded operational migration package. Production deployment/execution belongs to integration root.

- [x] G1: Every public raster has a decoded, hash-verified AVIF replacement and a verified backup outside deployment; original references are updated before pruning.
  CHECK: node scripts/migrate-static-avif.mjs verify
  EXPECT: STATIC_AVIF_PASS 557 images; 20876068 original bytes; 13155182 AVIF bytes
  EVIDENCE: Conversion and prune commands passed; 557 replacements fully decoded, source/replacement SHA-256 and backup hashes verified, all manifest aliases resolved, source references audited before deletion. Backup path is recorded in static-avif-manifest.json.

- [x] G2: Uploads and old public R2 URLs produce verified AVIF, while private R2 paths remain inaccessible; external artwork fetches enforce host/path/type/size and redirect restrictions.
  CHECK: node scripts/gate-media-avif.mjs
  EXPECT: MEDIA_AVIF_PASS
  EVIDENCE: Behavioral tests passed using real PNG/AVIF fixtures and Sharp decoding: malformed/truncated types rejected; uploaded output readback/hash checked; cache deduplicates; corrupt output fails; private paths fail; store allowlist rejects host spoofing, ports, HTTP, redirects and oversize bodies; old URLs still return AVIF after pruning.

- [x] G3: Operational migration authenticates requests and refuses deletion without verified replacement, matching backup, unchanged original and zero D1 references.
  EVIDENCE: scripts/gate-media-avif.mjs passed forged-body/missing-auth checks, foreign-key rejection, missing-backup refusal, corrupted-replacement refusal, changed-original refusal and nonzero-reference refusal; successful prune preserves legacy URL serving. Root release order and exact resumable commands are documented in ops/MEDIA-AVIF.md.

- [x] G4: Migration coverage includes the complete owned legacy R2 inventory and all existing D1 media reference columns discovered by read-only scan.
  EVIDENCE: .unlazy/nov08-media/r2-inventory.json contains 831 originals (459 public, 372 private), 405358348 bytes. Read-only scan of every schema TEXT column found references in 20 columns; all are included among 32 columns in ops/media-fields.json, including custom_ads_setting.media. Worker pagination handles larger inventories; runner refuses to overwrite its receipt manifest.

- [x] G5: Static assets are pruned and no missing alias targets remain; all store image components use the AVIF resolver.
  EVIDENCE: node scripts/migrate-static-avif.mjs prune passed source-reference and backup guards; subsequent verify passed. public contains 557 .avif images and zero .png/.jpg/.jpeg/.webp. StoreCart and product-card-1 updated here; root updated all three shop routes. Existing avatar aliases map to real converted icons.

- [x] G6: Shared TypeScript compiles and the standalone worker bundles without a production mutation.
  CHECK: ./node_modules/.bin/tsc --noEmit --pretty false
  EXPECT: /^$/
  EVIDENCE: Full TypeScript check passed. node --check scripts/migrate-r2-avif.mjs passed. Wrangler --dry-run bundled ops/media-avif-worker.ts (12.44 KiB) with DB/MEDIA/IMAGES bindings; no worker deployed by this leaf.

- [x] G7: Expert review, defect hunt and final polish leave no unresolved implementation defects in the assigned scope.
  EVIDENCE: Review added AVIF compatible-brand validation, converted decode verification, R2 readback SHA-256, local backup acknowledgement, pre-delete source etag/hash check, private key isolation, explicit store allowlist, redirect refusal, bounded fetch body, deterministic legacy lookup, real avatar aliases and resumable phase state. Final behavior suite and full typecheck passed; no background task process remains. Live conversion and pruning are deliberately root-owned release operations, not claimed complete here.

Production follow-up: The initial provider format fallback was resolved with a 1200px conversion cap. Root completed all 831 conversions, reference rewrites, guarded original deletions and a final 831-object verification. R2 image bytes reduced from 405,358,348 to 24,451,261; recovery backups are outside the repository. Temporary worker cleanup is tracked in the root release gate.

Store compatibility: Cloudflare error 9516 rejects one valid 16-tile AVIF from the allowlisted WooCommerce source. The external-artwork-only fallback validates its bounded static container, item extents, dimensions, grid references and AV1 framing, then preserves AVIF bytes with SHA-256/R2 readback verification. This is structural validation, not pixel decoding. The portable regression fixture is independently fully decoded with Sharp at 1600×1986; 23 malformed/truncated variants are rejected. Uploads and owned migration never use this fallback. Final live browser proof remains part of the root release gate.
