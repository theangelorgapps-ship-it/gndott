# Reference analysis

The user supplied Apple Store screens and a blue glass library dock. This is a control extraction, with Halobox branding retained in the implementation.

## Control regions
- Apple Store product tiles: rounded image containers, dark title text below, two-column mobile grid. Geometry retained; surfaces adapted to charcoal.
- Category chips: capsule edges and centered single-line labels. Horizontal overflow retained.
- Product variant cards: blue selected outline with generous target and supporting label.
- Checkout cards and sheet: grouped rows, rounded corners, blue primary action. Halobox continues the existing WooCommerce signed handoff; it does not invent shipping totals or card data.
- Reference dock at bottom of reference.png: clear rounded capsule, pale rim, blue selected label. Watch submenu uses four real destinations; no new routes invented.
- Player scrubber: white track/blue accent, dark preview panel. Bunny-generated image sheets provide video imagery.

## Palette and typography
System font, 12/14/16/21/28px controls; touch targets at least44px. Pale text, charcoal surfaces, blue interactions, restrained gold brand mark. Original white Store surfaces are intentionally adapted to Halobox dark. Color tokens come from control surfaces and current brand; scenery is excluded. Optical rims are a browser approximation rather than an exact measurement from a static image.

## Component completion
Observed families: buttons, cards, list rows, tabs, navbar, tabbar, chips, radio, avatars, dividers, sheet, slider. Remaining families inferred from those forms; see components-list.md. Dynamic optical behavior is verified in app screenshots, not reproduced by the static control board. Safari and Firefox use the supplied component's blur fallback because SVG backdrop refraction is Chromium-specific.

## Implementation
Shared ChoicePicker provides top-layer dialog selection, searchable options, keyboard escape and focus restoration. Phone layout is a bottom sheet; desktop is centered. Mobile Bible uses these same controls inside the playback dialog. Store products, prices, categories, stock and checkout all use the existing backend.

## Individual control samples

Measured in the 2303 × 599 dock reference, inside control pixels only: dock fill (1100,570) #101929; selected capsule (810,492) #656b76; rim (1000,456) #aaadb3; separate round control (1610,560) #0f1727. These are composited glass pixels, not opaque fill specifications. They inform dark translucent layers and pale rims; Halobox's blue/gold brand and readable action contrast remain deliberate adaptations. Product cards, option outlines and checkout rows are separately identified in the control-region inventory above; scenery and status bars are excluded.

## Accepted approximations

The one-pass review accepts dark adaptation of the light Store reference, system-font/placeholder-symbol approximation, and a static material board alongside the actual browser-dependent optical implementation. See ui-review-report.md for all six fixes and verification limits.
