# Discovery UI — 9 November 2026

The shipping root, home, search and catalogue React routes are exercised in Chromium with the real TanStack router. Only server function boundaries return local fixtures. All off-origin browser requests are blocked; no live account or data writes occur. The gate closes its browser and ephemeral HTTP server in `finally`.

## Behavior verified

- Header, mobile dock, mobile menu and Control+K open the same native search dialog without replacing the current page. Escape closes it and restores focus, including to the surviving menu trigger.
- Initial focus and Tab/Shift+Tab stay inside the modal. Arrow keys, Home, End and Enter select real catalogue result routes, retaining `#watch` playback behavior.
- Loading, service error/retry, empty results and delayed stale responses are observable through the rendered interface. A later empty query cannot be overwritten by an earlier slow response.
- Browse catalogue/View all results reaches the real search route. The mobile field appears below Search and before categories. Category IDs persist while typing, and browser back/forward restores the query and category.
- Category rail buttons retain native pressed state and route filtering. Explore shows four 16:9 collection cards. Search and Explore fit 1440×900, 768×1024, 390×844, 320×740 and 844×390; regular and reduced motion are exercised.

## Checks

```sh
PLAYWRIGHT_MODULE=/Users/charlesfinney/.npm/_npx/31e32ef8478fbf80/node_modules/playwright node scripts/gate-discovery-browser.mjs
node scripts/gate-nov09-discovery.mjs
node_modules/.bin/tsc --noEmit
npm run build
git diff --check
```

All pass. Production build retains existing bundle-size warnings. Screenshots are under `/tmp/halobox-nov09-library/discovery-evidence`. Existing discovery integration coverage contains eight server/catalogue groups.

The browser fixtures verify UI behavior, not production catalogue contents or database authorization. The API owner separately handles collection thumbnail preference and category endpoint validation/profile filtering. No API changes are included in this UI ticket.
