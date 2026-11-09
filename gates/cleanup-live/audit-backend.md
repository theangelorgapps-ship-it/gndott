# Backend, data and asset cleanup audit

Audit-only leaf, 2026-11-07. Working directory and Git top-level both resolve to `/Users/charlesfinney/Documents/Codex/Projects/New project/gndott`; branch `codex/apple-tv-experience`; origin `https://github.com/theangelorgapps-ship-it/gndott.git`. No application files, assets, databases, dependencies, remotes or production resources were changed by this leaf.

## Ranked cuts

1. `shrink:` Remove 540 redundant extension aliases from the image manifest, retaining the equivalent stem keys and every asset. Replace each duplicate lookup entry with the fallback already implemented by `img()`. **48,119 source bytes** with compact JSON, from 91,523 to 43,404; 0 logical lines and 0 dependencies removed. [`src/lib/img-manifest.json:1`, `src/components/Poster.tsx:19`]
2. `delete:` Remove the unused internal `couponCode` property from `createSubscriptionRecord`'s option type, destructuring and two caller object literals. Replacement: nothing; retain both public validators, coupon calculation and Stripe checkout metadata. **117 source bytes**, 0 logical lines and 0 dependencies removed. [`src/lib/api.ts:968`, `src/lib/api.ts:1026`, `src/lib/api.ts:1085`]

net: -0 lines, -0 deps possible; **48,236 source bytes** across the two proven cuts. These are measured source savings, not a claim about gzip or runtime memory.

The manifest reduction comprises 47,048 bytes from dropping aliases with the original JSON spacing and another 1,071 bytes from compact serialization. Exact deletion rule: drop key `k` only when stripping `/\.(png|jpe?g|webp)$/i` changes it and `manifest[stem(k)] === manifest[k]`. Do not remove any distinct stem or asset target.

## Proof and boundaries

- The sole application manifest importer is `Poster.tsx`. `img()` tries `MANIFEST[base] ?? MANIFEST[stem]`; only the first lookup's already-equivalent aliases are removed. The `img()` function was extracted from the actual TypeScript AST and evaluated unchanged against both maps. **5,388 input cases passed**, covering all 1,076 original keys as bare names, nested paths, localhost URLs, loopback URLs and HTTPS localhost URLs, plus empty, direct-media, direct-image, remote and missing-image cases. The set of **536 target paths** remained identical, and all 536 targets exist.
- The internal `couponCode` property is only destructured and never read by `createSubscriptionRecord`. The two callers already calculate `discount`. Proposed removal leaves the public `subscribePlan` input and `metadata[coupon_code]` unchanged. No API/server-function declaration is removed.
- The duplicate `MAX_IMAGE_BYTES` declaration in `imageUpload.ts:6` has no internal consumers and occupies 41 bytes. **Deferred:** it is exported; preserving exports is more valuable than this tiny cut. The actual upload limits in `imageProcessing.server.ts` remain required.
- Repeated detail/review queries and the thin DB/viewer adapters support existing API boundaries. Extracting more wrappers or deleting exposed functions is not justified by the size reduction. Preserve all **70 `createServerFn` declarations**, their signatures and response fields.
- `sanitize-html`, image validation, viewer ownership checks, typed playback identities, failure propagation, payment confirmation and migration safeguards are functional boundaries, not bloat.

## Complete scope inventory

Read all **17 TypeScript files / 2,160 logical lines** in `src/lib`, plus the full manifest. The 18 files total **212,211 bytes** before cleanup. Inventory:

| File | Bytes | Logical lines |
|---|---:|---:|
| api.ts | 62,684 | 1,234 |
| bible.ts | 937 | 16 |
| bibleProvider.ts | 4,261 | 59 |
| billing.ts | 5,905 | 34 |
| catalogueFilters.ts | 1,019 | 17 |
| contentRoutes.ts | 829 | 9 |
| db.ts | 610 | 21 |
| imageProcessing.server.ts | 2,375 | 24 |
| imageUpload.ts | 2,068 | 24 |
| img-manifest.json | 91,523 | 1 |
| library.ts | 5,534 | 36 |
| notePdf.ts | 6,306 | 115 |
| playback.ts | 4,026 | 64 |
| recommendations.ts | 19,417 | 378 |
| session.server.ts | 1,357 | 50 |
| utils.ts | 166 | 6 |
| viewer.server.ts | 2,648 | 65 |
| viewer.ts | 546 | 8 |

Also inspected the `/media/$` R2 route; relevant image/CMS callers; `wrangler.jsonc`, `vite.config.ts`, package scripts, `.gitignore`, generated environment binding declarations; the complete additive migration; all **5 docs files / 21,955 bytes**; and related library/viewer/playback/recommendation regression gates. Generated Worker runtime declarations belong to the dependency/tooling audit, not a proposed runtime cut here.

Baseline SHA-256 of sorted `src/lib` file bytes concatenated: `e4322dcdf3fe6291db2114a75ef11c6d130694610144a52820f13025ea347e62`.

## Assets and database-driven uncertainty

All **562 public files / 23,133,461 bytes** were inventoried and content-hashed. There are **22 byte-identical groups containing 48 files**; deleting all redundant copies would save at most **690,044 bytes**, but is **not approved**: each path is a public URL and some are separate manifest targets. Replacing URLs or adding redirects would be a behavioral change, not a proven deletion.

The manifest has 1,076 keys and 536 distinct targets. Its 26 unmapped public files comprise 6 root images, 4 fonts plus their license, and 15 additional images totaling 278,840 bytes. Unmapped does not mean unused:

- Root images are referenced by the logo, footer store badges, fallback image or CSS. `texture.jpg` and `login_banner.jpg` depend on the frontend stylesheet audit; do not delete independently.
- All four Noto Sans styles are fetched dynamically by `notePdf.ts`; retain the fonts and OFL license (**2,257,393 bytes** together) to preserve searchable, styled PDFs.
- The 15 additional image paths can be used directly by DB values because `/images/` URLs bypass the manifest.

Read-only local SQLite inspection used `mode=ro`, selecting only image-path and CMS HTML columns. It scanned **23 columns / 616 non-null cells / 430 distinct values**; resolution yielded 429 remote values, 1 `/media/` value, and no local manifest targets. This local snapshot is not evidence that production or external callers never use public assets. No private row contents or setting values are included here.

CMS pages and FAQ answers are inserted as HTML by `page.$slug.tsx:15` and `faq.tsx:26`. Arbitrary class attributes are therefore possible. The local snapshot contains 0 pages and 2 FAQ rows, with no class attributes; production CMS class reachability remains a driver/frontend verification matter. Library note sanitization strips class attributes. Do not use static source absence alone to purge generic/CMS-reachable CSS.

## Release prerequisites

1. **Migration:** apply `migrations/20261107_library.sql` to binding `DB`, database `halobox-migrated-20261105`, ID `3bc8aa15-6d59-42be-93df-23397c737c56`, before serving the new library/cancellation code. It creates `library_notes`, `library_verses`, and `subscription_cancellations` with `CREATE TABLE IF NOT EXISTS`; it does not replace existing data. Local tables exist. The driver separately confirmed `20261107_library.sql` was pending remotely with Wrangler's migration list. Applicable driver command from this child repository: `./node_modules/.bin/wrangler d1 migrations apply DB --remote`. Verify the resulting migration status and three tables afterward.
2. **Bindings:** retain `DB` and R2 binding `MEDIA` targeting `halobox-migrated-media-20261105`; deploy configured Images binding `IMAGES` and confirm Cloudflare Images is enabled for the account. Both avatar and catalogue upload handlers need Images plus R2. Preserve `/media/$` routing and existing migrated objects. The generated `worker-configuration.d.ts` binding header currently lacks `IMAGES`; regenerate types during release preparation if maintaining generated binding accuracy.
3. **Secret/config names only:** Stripe reads D1 setting `stripe_secretkey`; checkout visibility also uses `str_payment_method` and `cash_payment_method`. Google login reads `google_client_id`; Bunny playback reads `bunny_library_id`. Preserve these existing settings and verify presence/configuration without printing values. The Bible adapter needs no API secret and calls the fixed Prayer Pulse origin. No new secret name is introduced by the cleanup or library features.
4. **Existing session/OTP concerns, outside this cleanup:** the driver confirmed a production Worker secret named `SESSION_SECRET` exists, but current `session.server.ts` uses a source-coded signing constant rather than that binding. The existing OTP endpoint returns `devCode` to its caller. These are pre-existing auth concerns for a separate review; no auth behavior or secret value was changed or reproduced in this report.
5. **Preservation checks:** run library/billing isolation, viewer ownership, playback and recommendation gates, TypeScript and production build after implementing cuts. Verify deployed images/fonts, public catalogue and actual profile library writes on an authorized test profile. Mocked billing tests must not cancel a customer's real subscription. Live production Images availability and post-migration persistence were not certified by this audit leaf.

## Four passes and evidence

1. Inventory and complete reading: traced all library modules, 70 server boundaries, manifest resolver, public files, migration/config and docs.
2. Domain review: retained API/auth/persistence boundaries and database-addressable assets; identified redundant manifest aliases and internal coupon plumbing.
3. Defect hunt: proved actual resolver equivalence on 5,388 cases; checked local DB asset/CMS reachability, complete public hashes, duplicate targets and all required local migration tables. Rejected deletion based solely on absent imports or identical bytes.
4. Polish and adversarial reread: separated source-byte reductions from logical-line/runtime claims; kept exported constants and required fonts; reconfirmed that the two approved cuts preserve every manifest target and public coupon input. No additional safe backend cut found.

Executed successfully, without production calls or background services:

```text
node scripts/gate-library.mjs
  LIBRARY_PROFILE_PERSISTENCE_OK; BILLING_OWNERSHIP_AND_FAILURE_OK
  READABLE_ROUTES_OK; AVIF_VALIDATION_AND_DEDUP_OK; ACCOUNT_LIBRARY_OK
node scripts/gate-viewer.mjs
  VIEWER_OWNERSHIP_OK — 13 cases
node scripts/gate-playback-data.mjs
  PLAYBACK_DATA_OK — real in-memory SQLite reads/writes and isolation
node scripts/gate-recommendation-v2.mjs
  RECOMMENDATION_V2_OK — 18 behavioral fixtures
actual Poster.img equivalence proof
  MANIFEST_EQUIVALENCE_OK — 5,388 cases; 540 aliases; 536 targets retained
```

These checks establish an audit baseline; the implementation/release driver must rerun the relevant checks on the combined final tree. No new process was left running.
