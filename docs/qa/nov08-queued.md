# November 8 queued admin, media and player release

The pre-queue release was published first (see nov08-release2.md). This release handles the subsequent annotated admin/media/player request.

## Implemented
- Immediate muted hover previews; first touch starts inline thumbnail playback with explicit unmute, Watch and Details actions. Preview begins at 30 seconds when duration permits. Hero retains its 1.2-second delayed muted start and a single playback-control cluster; slideshow rotation is separately named.
- Grey, consistently sized Bible selectors with concise accessible names.
- Halobox-branded dark admin login and sidebar, account popover, visible Edit actions, loading feedback, correct image URLs and previews. Better Auth and admin role checks remain in place.
- Popup uploads across content, episodes, categories, locations, settings, banners and media library. Categories support images; personality order puts the Ra’ah then Neviah first; Locations remain separate. Episode parent/group/access values are validated.
- Real-image folder gallery, storage-upload-date filters, separate filename and pixel-text search, progress/error/retry states. English OCR is self-hosted. All 667 current public images have ready OCR rows; private account media is excluded.
- Per-device hero editor for phone, tablet, website and app artwork, framing and copy positioning. Saved configurations feed public rendering and the versioned /api/heroes endpoint, with inactive/deleted/paid-child filtering.

## Verification
Both repositories pass TypeScript and production builds. Functional gates pass for admin polish, actual SQLite banner transactions, real AVIF encoding and pixel OCR, hero SSR, player interactions, content associations, Better Auth, entitlement limits and security boundaries.

Actual browser checks confirm desktop hover playback and mobile inline playback/unmute. At 320px and 393px, the Bible changes to Exodus 2 and renders 25 verses, with 48px selectors, no horizontal overflow and no page errors. Admin components were exercised at desktop and phone sizes with controlled RPC/upload responses, including four-device hero saves, nested dialogs, upload success/error/cancel, media filter payloads, OCR progress/pause/retry and recovery. These fixtures verify UI behavior; they do not claim live provider uploads or authenticated production mutations.

The production OCR backfill recognized existing public image pixels locally, checking R2 ETags before writing only index rows. It did not replace images or alter users/content. Read-only inventory reports 667 ready, zero errors and zero eligible images remaining. A separate D1 text query verifies recognizable poster text.

No setup emails, live sign-ins, invitations, purchases or charges were sent. Native physical-device keyboard testing remains a limitation from release 2. Network speed determines when the first video frame appears; autoplay respects reduced-motion and browser restrictions. OCR is English and decorative typography can reduce recognition accuracy.

## Deployment
Pending final push and live verification.
