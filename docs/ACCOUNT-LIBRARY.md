# GoodNews Halobox reader and account library

Local preview: http://127.0.0.1:5190/account-setting

## Experience

- The supplied logo is paired with a stacked GoodNews / Halobox wordmark. The footer uses Hello@halobox.tv and the four requested country phone numbers.
- Discovery now fills a horizontal row with up to eight distinct unwatched titles, excluding the personalized row. Smaller catalogues remain useful without duplicating titles to fill space. Continue Watching uses landscape artwork; Recently Updated keeps its blue Recently Uploaded badges.
- Notes, Bible, Info and Continue Watching use a borderless glass pill inside the immersive player. Editor keyboard input does not trigger media shortcuts. Link popovers stay inside the active dialog/full-screen surface.
- Bible reading uses a serif face, adjustable text size and two columns when the reader container is at least 850px wide. Narrow readers use one column. Selecting a verse exposes bookmark and four highlight colours. Saved chapters reopen at the selected verse.
- My Notes, Highlights and Watch Later folders show the active profile's real data. The lists below each open folder expose every item, including items beyond the four visible folder sheets. Library in the mobile dock opens the dashboard.
- Notes support headings, inline formatting, links, lists, quotes and alignment. Saves are explicit; an unsaved draft is recovered on the same device. Older plain-text notes offer an import action. PDFs preserve selectable text, inline formatting and links, and paginate without screenshot rendering.
- Content links use readable slugs with a stable numeric suffix, for example `/movie/a-sound-from-heaven-prophet-uebert-angel-229`. Numeric links remain valid. Existing slugs that already contain the ID do not get a second suffix. Episode rental links use the readable parent-show URL and episode query parameter.

## Storage and server boundaries

`migrations/20261107_library.sql` adds profile-scoped notes and verses plus a subscription cancellation audit table. It was applied to the local D1 database only. Every library read/write resolves the authenticated viewer and owned active profile. Writes from a stale tab are rejected if the active profile has changed. HTML is sanitized on the server before storage; PDF links accept only HTTP(S) and mailto URLs.

Profile photos use `uploadProfilePhoto`; catalogue artwork has the authenticated, administrator-only `uploadCatalogueImage` function. Both call `storeAvif` before writing any image to R2. They accept JPEG, PNG, WebP and AVIF, validate the actual input, cap uploads at 8MB and 25 megapixels, resize photos to 512px and artwork to a maximum 1920px box, and store only AVIF. A content hash deduplicates retries and immutable caching avoids repeated conversion at read time. The browser performs no encoding.

The Images binding is configured as `IMAGES`; the existing R2 binding remains `MEDIA`. Cloudflare Images must be enabled for the deployed account. This is a convert-on-upload pipeline, not a bulk conversion of existing artwork. The separate legacy Laravel admin is outside this repository; it must call this upload pipeline if it continues to manage artwork instead of uploading directly to its old storage.

Subscription controls derive the provider reference from the authenticated account's own database record. Recurring Stripe subscriptions offer Cancel subscription → Confirm cancellation, disable renewal at Stripe, verify its response, then record the result. Paid access remains active through the period end. A provider failure is shown as a failure, never as a successful cancellation. Existing Stripe checkout uses one-time payments, so those purchases accurately say they will not renew. Apple and Google subscriptions link to their official management screens. No real customer subscription was cancelled during verification.

## Components and dependencies

The project already supports React, TypeScript, Tailwind 4 and the `@/` alias. `components.json` maps the shadcn UI directory to `src/components/ui`, the correct equivalent of `/components/ui` for this source-root project. Global Tailwind utilities are in `src/styles.css`; the new experience styling is in `src/library.css`. No separate scaffold or CLI initialization is needed.

The rich-text editor is adapted from Hirael's MIT component and uses Tiptap 3 and Radix primitives. Glass Folder Cards are adapted from the supplied component, with controlled real data, responsive sizing and reduced motion. PDF export is lazy-loaded with jsPDF and embedded Noto Sans fonts; the font license is in `public/fonts/OFL.txt`. The editor and PDF code are loaded when used, rather than as part of initial home-page rendering.

## Verification and release

`node scripts/gate-account-library.mjs` runs TypeScript, library and billing isolation/failure cases, image validation/deduplication, readable routes, recommendations, playback/viewer regressions and the production build. The ledger is `gates/account-library/GATES.md`.

Browser verification covered a real server AVIF upload (512×512, 25,573 bytes), saving and reopening a formatted note, downloading and extracting its PDF text, saving and highlighting John 3:1, desktop two-column and narrow one-column reading, eight horizontal discovery cards, the mobile menu, and actual progressing HLS playback. Screenshots are in `verification/`. The QA notes are explicitly labelled preview notes in the local profiles.

Changes are local on `codex/apple-tv-experience`; no commit, push or production deployment was performed. Before deploying, apply `migrations/20261107_library.sql` to the intended production D1 database and enable the configured Images binding. The database migration is additive and idempotent. The local preview remains running at the user's request.
