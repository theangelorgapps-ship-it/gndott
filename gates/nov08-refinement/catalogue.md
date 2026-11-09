# Gates: catalogue and store

- [x] G1: Sermons, Teachings, Shows, Videos and Store share a round filter toggle with horizontal category chips and expandable selectors; category/year/query combine and chronological ordering is deterministic, missing dates last.
  CHECK: node scripts/gate-catalogue-refinement.mjs
  EXPECT: CATALOGUE_REFINEMENT_PASS
  EVIDENCE: 2026-11-08: CATALOGUE_REFINEMENT_PASS; production query gate also passes. Shared controls are wired in Catalogue and ShopIndex; final responsive visual check belongs to integration root.
- [x] G2: /sermons and /shows are canonical; /movies and /tv-shows preserve query/hash in permanent redirects; internal links outside root use canonical listings.
  CHECK: node scripts/gate-catalogue-refinement.mjs
  EXPECT: CATALOGUE_REFINEMENT_PASS
  EVIDENCE: 2026-11-08: Redirect handlers executed with empty and encoded search strings plus bare/prefixed hashes; all return 301 to the canonical listing with original filter state. Internal listing refs outside root contain no legacy destinations.
- [x] G3: Store category artwork fills tiles, scrolling retains gutters, Order history is a button, and existing purchase/bridge contracts are unchanged.
  EVIDENCE: 2026-11-08 expert reread: store-category-tile removes inset padding, artwork uses width:100%/aspect-ratio:1/object-fit:cover, rail margin stays inside layout, and order-history anchor receives a 44px pill button treatment. ShopIndex keeps existing productPath/StoreCartProvider/products and bridge API unchanged. Visual acceptance deferred to integration root.
- [x] G4: Catalogue production query tests pass with real video category mapping, restricted/unpublished exclusions and no fabricated upload metadata.
  CHECK: node scripts/gate-experience-catalogue.mjs
  EXPECT: EXPERIENCE_CATALOGUE_PASS
  EVIDENCE: 2026-11-08: EXPERIENCE_CATALOGUE_PASS. Production SQL executed against SQLite fixtures for entertainment and genuine video_gener_mappings, duplicate/deleted/hidden mappings, child profiles, and publish/deletion restrictions. No created_at or category-label year fallback.

## Passes completed
- Implementation: shared expanding filter bar, search/ranking/date sorting, canonical routes, video facets, store treatment.
- Expert reread: real video schema confirmed from local production schema snapshot; preserved original catalogue date semantics and separate video IDs.
- Defect hunt: encoded redirect/hash preservation, bad dates, missing dates, sort ties, immutable source data, combined category/year/query, child visibility.
- Polish: inline filter panel avoids nested popup geometry; 44px chip targets, mobile and 4K sizing, reduced-motion/transparency support, local store gutters.

Checks: `node scripts/gate-experience-catalogue.mjs` => EXPERIENCE_CATALOGUE_PASS; `node scripts/gate-catalogue-refinement.mjs` => CATALOGUE_REFINEMENT_PASS. Root confirmed build/route generation passed. Initial typecheck had auth work-in-progress and stale-route errors only; root owns final full typecheck.
