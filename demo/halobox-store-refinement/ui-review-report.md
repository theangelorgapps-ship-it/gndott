# Halobox Store and Watch UI review

Date: 2026-11-08. One independent, read-only review by `refinement_ui_review`; no second reviewer pass.

## Findings and fixes

| Severity | Finding | Resolution |
| --- | --- | --- |
| Blocking B1 | Circular border token made component boundaries invalid. | Replaced with concrete #4c515c; refreshed browser screenshots show borders. |
| Important I1 | Tooltip/toast and primary button contrast was insufficient. | Dark elevated surfaces with pale text; action blue #006edb and hover #005bb8. Store primary action also uses the darker blue. |
| Important I2 | Empty spacing/radius/shadow sections and placeholder typography. | Added seven spacing samples, four radius samples, three shadow samples and English display/body/control typography. |
| Important I3 | Reference/inferred labels disagreed with the inventory. | Reconciled source labels; distinguishes reference geometry from inferred interaction states. |
| Important I4 | Tabs used a rectangular underline instead of capsule geometry. | Rounded group and selected capsule state. |
| Important I5 | Missing product option selection example. | Added default and blue-outline selected edition cards. |

All 1 blocking and 5 important findings addressed. Screenshots refreshed after the fixes.

## Acceptable differences

1. White Apple Store surfaces are intentionally adapted to Halobox charcoal, pale text and blue actions.
2. System typography and gray placeholder symbols approximate the source; no commercial font or Apple artwork is bundled into the app.
3. The static component board documents material appearance; the real app supplies optical refraction on Chromium and the provided blur fallback on Safari/Firefox.

## Verification

- 24 control families plus a product-variant card demonstration.
- Browser checks at 320px and 391px phone, 1024px tablet and 3840px desktop widths. No horizontal page overflow in checked views.
- Country picker defaults to US +1 and changes to UK +44; no registration submitted.
- Watch submenu exposes Sermons, Teachings, Shows and Videos; search remains separate.
- Bible book/chapter picker works inside playback; mobile video, tabs and panel do not overlap. Native iPhone fullscreen path is covered by the behavior test; physical iPhone Safari was not available.
- Live Bunny seek image loaded at 1800 × 1008; boundary calculations and signed-query retention tested.
- Store exposes 91 physical products. Category filtering, product variant selection, existing cart and checkout summary exercised. No payment or order submitted.
- Build/typecheck and catalogue/player/live discussion/store bridge/subscription regression gates pass (see final verification record).

Some in-app browser screenshots include compositor padding outside the tested CSS viewport. Viewport geometry was checked independently through the rendered DOM.
