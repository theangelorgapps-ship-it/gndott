# Experience and store release — 8 November 2026

Published Worker version: `6bba0304-9c9a-4a13-9962-24d8114fe1cf`.

## Original Laravel catalogue

Read the original migration backup from the “Update OTT admin panel and front” chat, database `sql_trial_halobox_tv`, captured 5 November 2026. All 191 entertainment release dates and 19 category names match the destination exactly. The historical catalogue years are stored in `release_date` (2016–2026); `created_at` is 2026 for every original record. Filters therefore use the editorial catalogue date. No customer data was reimported and no old frontend source was reused.

## Verification

- Build, TypeScript, diff whitespace check, existing player gate, and all five new experience/commerce gates pass.
- Chrome playback: volume changes persist, controls hide when idle, picture-in-picture enters and exits.
- Phone 391×844: Bible and notes remain below the video; filters fit without horizontal overflow.
- Tablet 1024×768 and 4K 3840×2160: live hero, header and catalogue geometry checked.
- Store bridge installed and enabled with approval. Isolated native WooCommerce checkout verified with a physical product variation and authoritative stock/price. No order placed.
- Stripe restricted key and webhook secret stored only in Cloudflare secrets. Checkout migration applied and gateway enabled. Invalid webhook requests rejected. Local payment lifecycle tests cover ownership, signatures, quoted prices and idempotent activation.
- Live historical filters, series, shop, subscription plans and live channel returned HTTP 200.

## Remaining production check

The live checkout review renders correctly. Opening the final hosted Stripe page requires an active viewer login; the browser's saved account reports disabled. User sign-in requested. No payment made and no entitlement changed. Existing plans remain fixed-term, with no automatic renewal.
