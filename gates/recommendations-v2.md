# Gates: recommendations-v2
- [x] 1: Meaningful weighted profile from progress and saved signals.
  CHECK: node scripts/gate-recommendation-v2.mjs
  EXPECT: RECOMMENDATION_V2_OK
  EVIDENCE: 2026-11-07 executable fixtures pass numeric/MM:SS/HH:MM:SS parsing, minimum30s/bounded2% thresholds, completion/duration weighting, real timestamp decay, confidence decay, saved-only preferences, duplicate-signal suppression and genre-budget normalization. Engine exposes parseWatchSeconds/isMeaningfulWatch for shared API semantics and uses typed profile keys.
- [x] 2: Typed identity exclusion, diversity, deterministic discovery and honest cold start.
  CHECK: node scripts/gate-recommendations.mjs --groups
  EXPECT: RECOMMENDATION_GROUPS_OK
  EVIDENCE: 2026-11-07 RECOMMENDATION_GROUPS_OK. New behavioral fixtures additionally confirm movie/video ID separation, current-type exclusion, preserved first relevance winner, diverse first row, unfamiliar discovery from unused candidates, stable profile/day seeds independent of catalogue ordering, truthful cold start and useful tiny/exhausted catalogue handling.
- [x] 3: Behavioral tests prove relevance/diversity/recency/cross-type edge cases.
  CHECK: node scripts/gate-recommendation-v2.mjs
  EXPECT: RECOMMENDATION_V2_OK (17 behavioral fixtures)
  EVIDENCE: 2026-11-07 RECOMMENDATION_V2_OK (17 behavioral fixtures), RECOMMENDATION_SCORING_OK and full tsc --noEmit exit0. Fixtures include malformed clocks/dates, NaN/Infinity/negative/fractional IDs, duplicate records, timestamp ordering and low-signal/cold-start boundaries. No network/server required by the pure tests.
- [x] 4: Algorithm and limitations documented; old relevant gates updated/passing.
  CHECK: node scripts/gate-recommendations.mjs --api
  EXPECT: RECOMMENDATION_API_OK
  EVIDENCE: 2026-11-07 RECOMMENDATION_API_OK verifies existing public APIs, validated viewer identity, profile predicates, typed joins, separate videos, actual saved/history inputs, stable profile seed, preserved player fields and read-only recommendation loading. docs/recommendations.md records exact formulas, payload/interface contract, novelty policy and content-based model limitations. Old scoring/groups tests retain relevance/routes/metadata/exclusion coverage while replacing obsolete random-first and empty-primary tiny-catalogue expectations.

## Four passes
1. Implemented the pure scoring/profile/grouping engine and coordinated exact saved/seed interfaces with parent.
2. Expert pass added absolute confidence decay: a lone ancient view must not normalize back into a full-strength preference. Canonicalized returned type/id values.
3. Defect pass tested typed collisions, invalid dates/clocks, completion and duplicate writes; fixed deterministic tied-signal metadata handling and prevented an untyped current ID from excluding unrelated content.
4. Documentation/source sweep found no further changes after all 17 behavioral fixtures, three legacy gate modes and TypeScript passed.

## Scope and limits
Changed only src/lib/recommendations.ts, scripts/gate-recommendations.mjs, scripts/gate-recommendation-v2.mjs, docs/recommendations.md and this gate file. No API/UI source edits, package installation, Git operations, browser, dev server or production writes. Parent owns active-profile queries, playback persistence, Continue Watching and end-to-end verification.
