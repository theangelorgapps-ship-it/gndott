# Store AVIF regression fixture

`store-grid.avif` is the public artwork for Woo product 33532, attachment 33885:
https://uebertangel.org/wp-content/uploads/2026/09/f16717c5-5128-4dde-b342-379a170634ca.avif

The 136,804-byte static AVIF has sixteen 512×512 AV1 tiles, a primary grid of 1600×1986 pixels, and an extended-size `mdat` box. Woo reports no alternative srcset and uses this same URL as its thumbnail. Cloudflare Images returns `IMAGES_INFO_ERROR 9516` for this valid grid. `scripts/gate-store-avif.mjs` independently fully decodes this portable fixture with Sharp, tests the scoped structural fallback and checks malformed container/extent/grid/OBU variants.

The fallback validates container structure and AV1 OBU framing; it is not a pixel decoder. It is restricted to allowlisted external store AVIF after this specific provider error. Upload and owned-image migration validation is unchanged.
