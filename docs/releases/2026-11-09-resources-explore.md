# Public Resources and Explore release

Scope: the public `gndott` worker serving halobox.tv. No admin deployment or database migration.

## Changes

- Remove the first-visit welcome component and its styles entirely, following the latest request.
- Replace Explore artwork with four AVIF portraits based on the user-supplied photos. Use a compact four-card desktop row and a two-by-two phone grid; remove the media icons and use “The Ra'ah - Prophet Uebert Angel”. Allow portraits above the artwork and preserve the tan portrait's lowered hand.
- Swap Explore and Discover Something Different on the homepage: Explore now precedes Recently Updated, and Discover follows it. Keep discovery ordering unchanged on other pages.
- Use the latest supplied navy-blazer photograph for Videos. Add brief hover, focus and press feedback to Explore, plus cart drawer and confirmation transitions; respect reduced-motion preferences.
- Update Open Graph and Twitter artwork to the white-shirt portrait used by Shows. Publish a 1200 × 630 JPEG for social compatibility and an AVIF companion.
- Remove duplicate Series and Shop navigation. Keep Store available to guests and signed-in visitors.
- Reduce the shop landing page to Resources, category filters, search and the real product catalogue.
- Raise black glass cart controls without moving their background. Replace the cart preview with an accessible modal drawer, real item images, quantity controls, removal, totals, retry state, order history and checkout navigation.
- Announce cart changes only after the server confirms them. Preserve the immediate mutation lock, focus restoration and stale-response protection.

## Validation

- `npm run build` — passed.
- `npx tsc --noEmit` — passed.
- `node scripts/gate-store-bridge.mjs` — passed.
- `node scripts/gate-public-branding.mjs` — passed, including canonical paths, legacy redirects and preserved playback/query state.
- `git diff --check` — passed.
- Desktop 1266 × 666: four Explore cards in one row; all images loaded.
- Phone 412 × 915: all four cards in two rows, no horizontal overflow, no welcome dialog, complete tan portrait hand.
- Verify the homepage section order and the navy-blazer Videos portrait at both sizes.
- Resources catalogue, search/filter, cart images, quantity update/readback, totals, close/Escape and focus restoration checked in Chrome. The test quantity was restored afterward. No order, payment or email was submitted.
- Focused independent code reviews found no release blockers.

Local screenshots are in `verification/resources-release/`; they are not deployment assets. The public image assets are in `public/images/`.

## Artwork provenance

The user supplied the gold academic robe, tan suit, white shirt and navy-blazer photographs. The Videos source is `uebertangel_1786228813_3959495786419854238_1387055707.jpg`. Image generation produced isolated portraits and the social composition. The tan portrait was extended to preserve the lowered hand. Existing Sharp tooling encoded the website portraits as AVIF. The latest white-shirt social composition replaces the earlier blue-shirt composition.
