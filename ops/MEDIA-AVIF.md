# Owned media AVIF migration

Run from `/Users/charlesfinney/Documents/Codex/Projects/New project/gndott` only. Repository root is the same directory, branch `codex/apple-tv-experience`, remote `https://github.com/theangelorgapps-ship-it/gndott.git`.

The temporary worker only accepts HMAC-signed POSTs to `/operate`. It accepts original keys matching `(private/)?legacy-20261105/<64-hex>.(png|jpg|jpeg|webp)` and cannot delete WooCommerce or Bunny originals. Private R2 objects retain the `private/` prefix and are rejected by the application's public media route. There is no public migration route in the application.

Read-only inventory on November 8 found 831 originals (459 public and 372 private), 405,358,348 bytes. `ops/media-fields.json` includes all image fields from the production schema plus `custom_ads_setting.media`, discovered by scanning every TEXT column for `/media/` references. The initial inventory and field counts are in `.unlazy/nov08-media/`.

## Release order

1. Deploy the application with AVIF static assets, image resolver, and compatibility `/media/` route. Old R2 image URLs now return real AVIF bytes; new `/media/avif/v1/*.avif` URLs also work. Deploy this before rewriting D1 references.
2. Export D1 to the private backup directory before the rewrite phase. `wrangler d1 export halobox-migrated-20261105 --remote --output <private-backup-directory>/pre-avif.sql`.
3. Create a random secret file with mode 0600 outside the repository. Do not print it or put it in shell history. Example (run once):

```sh
node --input-type=module - <<'JS'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {randomBytes} from 'node:crypto';
const dir=path.join(os.homedir(),'Documents/Codex/media-backups/gndott-nov08-r2');
fs.mkdirSync(dir,{recursive:true,mode:0o700});
fs.writeFileSync(path.join(dir,'migration-secret'),randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});
JS
```

4. Deploy the temporary worker, then set its secret through stdin:

```sh
./node_modules/.bin/wrangler deploy --config ops/wrangler.media-avif.jsonc
./node_modules/.bin/wrangler secret put MIGRATION_SECRET --config ops/wrangler.media-avif.jsonc < "$HOME/Documents/Codex/media-backups/gndott-nov08-r2/migration-secret"
```

5. Set `MEDIA_MIGRATION_URL` to the worker URL printed by Wrangler and `MEDIA_MIGRATION_SECRET_FILE` to the secret file path. The runner reads credentials from that file and never prints them. Defaults place original backups and the resumable manifest outside the deployment directory at `~/Documents/Codex/media-backups/gndott-nov08-r2/`.
6. Execute each phase in order, checking that it completes without errors:

```sh
node scripts/migrate-r2-avif.mjs inventory
node scripts/migrate-r2-avif.mjs convert
node scripts/migrate-r2-avif.mjs verify
node scripts/migrate-r2-avif.mjs rewrite
node scripts/migrate-r2-avif.mjs verify
node scripts/migrate-r2-avif.mjs prune
node scripts/migrate-r2-avif.mjs verify
```

`MEDIA_MIGRATION_LIMIT=1` gives a bounded initial probe. Conversion, rewrite and prune skip completed entries when resumed. Verification visits every manifest entry. Never run two runners against the same manifest simultaneously.

Each conversion downloads a local original backup, computes SHA-256, and requires the server source hash to match it. The server converts through IMAGES, verifies content type and AVIF magic, decodes dimensions, writes R2, reads the replacement back, verifies SHA-256, and persists a private conversion receipt. The rewrite uses only this receipt's verified target URL. Pruning refuses missing or corrupted replacements, changed originals, missing backup hash acknowledgement, and any old D1 reference. It verifies deletion. Old public URLs remain functional through their deterministic replacement lookup after pruning.

The runner treats failed conversions as failures and does not proceed to later phases. Keep original backups and the manifest outside the deployed project for recovery. This migration does not alter profile IDs, passwords, subscription rows, or upstream store artwork.

7. Check live public AVIF and old compatibility URLs, private-path 404, and the store proxy. Then remove the temporary worker:

```sh
./node_modules/.bin/wrangler delete --config ops/wrangler.media-avif.jsonc
```

The private R2 receipts can remain as the conversion audit trail; they are not publicly served. The temporary secret file can be removed after the worker is deleted.

## Static assets

`scripts/migrate-static-avif.mjs` created and fully decoded 557 AVIF replacements. `gates/nov08-refinement/static-avif-manifest.json` records original/replacement hashes, bytes and dimensions, plus the outside-deployment backup location. AVIF bytes total 13,155,182 versus 20,876,068 source bytes. The `prune` phase checks all replacements, backups, aliases and application source references before removing any public original. `verify` is safe to repeat after pruning.

```sh
node scripts/migrate-static-avif.mjs verify
node scripts/gate-media-avif.mjs
```

## Provider format limit verified in production

The first limited probe at 1920px returned HTTP 200 with `image/webp`, despite an explicit AVIF request. The strict validator refused the output and left the original intact. Cloudflare documents a 1200px AVIF dimension limit and automatic fallback for larger output: https://developers.cloudflare.com/images/get-started/limits/ and https://developers.cloudflare.com/images/optimization/features/#format--f. Runtime artwork output is now capped at 1200×1200 with scale-down (avatars retain 512×512). Static assets retain their locally encoded dimensions. The binding input limit is 20 MB. All output is still checked for actual AVIF content, decoded dimensions and hashes; fallback is never relabeled.
