# Bible reader migration

The original AWS Laravel frontend was inspected through an authenticated EC2 Instance Connect session. Its `Modules/Frontend/Resources/assets/js/interactive-panel.js` calls the Bible index and chapter endpoints under `https://backend.halobox.tv/api`. The endpoint configuration comes from `config/livestream.php`.

The same instance contains `/www/wwwroot/livestream-backend/src/services/youversionApi.js` and `prayerPulseApi.js`. The first uses YouVersion and explicitly falls back to Prayer Pulse for version IDs 1, 59, 8 and 111. The Prayer Pulse adapter calls:

- `/bible/get-books/{translation}/`
- `/bible/get-text/{translation}/{book}/{chapter}/?clean=true`

The legacy Halobox HTTP endpoint returned 503 during migration. The existing Prayer Pulse adapter has therefore been ported into `src/lib/bibleProvider.ts`, with the same version mapping and response normalization. The new app makes fixed-origin, bounded server requests directly to that existing provider. It needs no API credential and does not expose or copy the old YouVersion key. No source database, configuration, service or permission was changed. The source SSH session was logged out and its temporary browser tabs were closed.

The new reader offers book, chapter and translation selection, previous/next chapter, a bounded in-memory chapter cache, loading/error/retry states, and literal React text rendering. It appears both on the title page and inside the player's Bible tray. AMP is labelled AMP rather than repeating the old adapter's inaccurate AMPC label. Additional books returned by KJV appear under their own group.

Verification: `node scripts/gate-halo.mjs bible` exercises malformed input, upstream failures, invalid payloads, safe text normalization and live books/John 3 in all four translations. Browser checks cover navigation and translation changes against the local server. This migration covers Bible reading; it does not deploy or restart the old Node backend or migrate its unrelated chat service.
