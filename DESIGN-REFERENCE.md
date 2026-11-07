# Implementation contract — GNDOTT

## Confirmed source
- Live site: https://gndott.theangelorgapps.workers.dev/
- Repository: https://github.com/theangelorgapps-ship-it/gndott
- Default branch: main
- Cloudflare Worker name: gndott (wrangler.jsonc)
- Stack: React 19, TanStack Start and Router, Vite, Cloudflare D1/R2. Existing Motion/Lenis libraries.
- User approved cloning into /Users/charlesfinney/Documents/New project/gndott. Resolved root: /Users/charlesfinney/Documents/Codex/Projects/New project/gndott; branch codex/apple-tv-experience. Changes are local and uncommitted; no deployment performed.

## Header reference
https://hi2026-e9p.pages.dev/ is also present locally at /Users/charlesfinney/Documents/Codex/Projects/New project/HI2026. Read-only inspection of src/components/SiteHeader.tsx and src/site-header.css.
Actual reference header is fixed across the viewport, 76px tall, transparent, zero outer border, zero outer corner radius. Navigation sits on the page rather than inside a rounded rectangle. Progressive blur is concentrated in the top 58% of header height using six layers (32, 16, 8, 4, 2, 1px). Content has adaptive gutters (20px to 52px). At compact widths the emblem stays left, quiet text action and metallic-rim dark pill stay right, followed by a 44px round menu control. Wide navigation uses 14–15px medium-weight links; menus animate with cubic-bezier(.22,1,.36,1). Retain GNDOTT route labels; do not copy Healing Institute content or links.

## Apple TV references
All eight user screenshots are control inputs. Home: white pill primary action, separate charcoal circular add action; understated badge and compact metadata; large portrait art on phones, lower gradient, centered title/actions/dots. Content rails use 2:3 poster cards with restrained 14px corners at logical 390px width. Search is a category-card grid with floating dark capsule field. The dock is a dark translucent rounded capsule containing four tabs plus a separate search circle, blue selected icon and label. Detail: immersive artwork first; back/share utilities above; title, metadata, Play and watchlist below; short expandable synopsis; episode/trailer sections follow.

Mobbin flows were opened and visually inspected:
- ac7b0bb4-e207-4ca7-a204-2294cc508e16: Store, five screens; charts, horizontal categories and curated rows.
- 7d7bac55-81a1-4ea4-ad25-d5546446f9fb: Searching Apple TV, five screens; category grid, floating search entry, results and type filters.
- 38ba6659-ea64-4ce1-8bdd-852062f5e9d8: Subscribing, three screens; one primary trial/play action. GNDOTT must retain real plans/prices/checkout behavior and not promise an Apple trial.
Animation curves/durations are engineering approximations; static screenshots do not specify them. Use compositor-friendly opacity/transform transitions, native touch scrolling and scroll snapping, reduced-motion support, focus-visible rings and >=44px action targets.

## File ownership for implementation
- Navigation leaf: src/routes/__root.tsx, new src/components/SiteHeader.tsx if extracted, src/header.css. Remove the framed header styling rather than stack another contradictory override. Preserve existing menu focus trap, Escape/outside dismissal, login/account/subscription destinations. Four mobile destinations plus separate search; remaining categories accessible in menu.
- Browse leaf: src/components/Poster.tsx, src/routes/index.tsx, src/routes/search.tsx, new src/catalogue.css. Add portrait responsive hero art, white Play and functional add/watchlist action, pause control and swipe handling; retain real titles and genuine genre metadata. Put Top 10 early. Implement genre/category image tiles using actual catalogue artwork. Search state must sync to URL/back-forward; exact category selection should use actual routes or typed filter semantics, not arbitrary keyword substitutions.
- Detail leaf: src/components/Detail.tsx, src/components/ShowDetail.tsx, src/routes/movie.$id.tsx, src/routes/video.$id.tsx, new src/detail.css. Shared detail artwork shell, Play reveals existing WatchSection, true watchlist state, expandable description and share feedback. Existing Bible/Notes/About/recommendations retained. Season/episode controls must have meaningful actions, with any missing backend endpoint surfaced instead of fake buttons.
- Integration: src/styles.css cleanup/token imports, src/components/Motion.tsx, subscription control styling, demo/apple-tv/, gates and verification records. No database schema/content mutation for this UI work.

## Verification
Build and typecheck against repository lockfile. Run relevant existing static/content checks but update obsolete visual expectations when intentional design changes contradict old frames. Local D1 is not populated in a fresh checkout; inspect available project fixtures or use isolated read-only catalogue capture/fixture without modifying production. Record precisely whether checks run against real data or fixtures. Test Home -> detail -> play; menu and keyboard/focus; search -> results -> detail; watchlist auth redirect; subscription route; handset widths 390 and 320; wide viewport >=1280; reduced motion; no overflow. Capture home, menu, search and detail. Perform exactly one read-only control design review under screenshot skill and fix all blocking/important findings. Stop all task dev servers when verification finishes.
