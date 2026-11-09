# Public website branding and first visit

Scope: halobox.tv only. Baseline: 94d4155b847100114eb350da4b3198f80ee173f3. Keep fort.halobox.tv and authentication unchanged. Do not send setup emails.

## Requested behaviour

- Link to sermons at `/sermon/:slug`, teachings at `/teachings/:slug`, shows at `/shows/:slug`, videos at `/videos/:slug`. Keep listing routes unchanged. Redirect old detail paths permanently and preserve query strings and playback anchors. Preserve migrated database content types.
- Show “Sermon” instead of “Movie” on sermon details.
- Use the exact site title “HaloBox - With Prophet Uebert Angel”, a new description, branded favicon and generated Twitter/Open Graph artwork.
- First-time visitors receive a dismissible introduction with working destinations. Remember dismissal per browser, respect existing accounts, and keep deep links uninterrupted.
- Blend the store purchase controls into a borderless dark glass shelf continuing behind the mobile dock. Keep Cart, Checkout, quantity and Add to cart usable. Centre the chat send icon.
- Check the resulting routes, metadata and responsive interactions, then push the website branch and deploy only its Worker.

## Generated social artwork

Generated using the built-in imagegen tool; the existing gold crest was supplied as a reference. Final assets: `public/images/halobox-social-20261109.avif` (compressed master) and `public/images/halobox-social-20261109.jpg` (1200×630 sharing compatibility rendition). Browser and Apple favicon renditions use PNG for platform compatibility and derive directly from the existing crest.

Final prompt:

Use case: ads-marketing. Create a polished social sharing banner for HaloBox, a Christian sermons and teachings streaming website. Input image is the existing gold GoodNews World circular tree crest, a brand reference to preserve faithfully. Wide 1.91:1 landscape composition with generous safe margins suitable for a 1200x630 Twitter large image/Open Graph card. Premium understated editorial design, near-black and midnight royal blue background, subtle pastel blue light and soft glass-like gradient, restrained gold accents. Place the existing gold crest tastefully near the large crisp white brand typography. Exact text: 'HaloBox' prominently, 'With Prophet Uebert Angel' below it, and smaller 'Sermons · Teachings · Shows · Live TV' plus 'halobox.tv'. No other text. Clean readable hierarchy, sophisticated streaming platform identity. No fake people, no busy collage, no cartoon elements, no device frames, no extra logos. Background may have subtle cinematic depth and a soft halo of light. This is final artwork, not a webpage screenshot.

## Design and routing notes

Detail routes with a trailing underscore in their filename are intentionally independent of the listing layout, as documented in [TanStack routing concepts](https://tanstack.com/router/latest/docs/framework/react/routing/routing-concepts). The central URL builder translates legacy type/base names so existing callers, recommendations, history and saved items share the same public vocabulary.

## Verification

- Production build and TypeScript check passed.
- Canonical route regression was run red before implementation, then green. All four old detail paths permanently redirect while retaining query/playback state.
- Catalogue refinement, recommendation (18 fixtures), store bridge and player interaction gates passed. Player tests cover desktop, portrait phone and landscape phone; chat send icon is centred within one pixel.
- Browser checks confirmed the welcome fits 320px, dismisses and stays dismissed after reload. Direct detail links remain uninterrupted.
- Local HTTP checks returned successful pages and canonical/OG metadata for all four new detail route families. SPA navigation updates canonical metadata.
- Store controls meet the mobile dock with a measured 0px gap at 320px and 412px widths. Desktop shelf spans the viewport at its bottom with no horizontal overflow. The dock's duplicate blur veil is disabled while the store shelf supplies the background.
- No real emails, chat messages or purchases were sent. Existing local schema was brought up to date solely to run the preview; this release requires no production database changes.
