# Recommendation engine

`src/lib/recommendations.ts` is a pure, deterministic ranking module. It reads the candidate and preference records passed by the server and returns the existing `forYou`, `discovery`, `recent`, `hasHistory`, and `topGenres` payload. It never queries or writes a database, infers playback from a page visit, or sends internal scores/profile identity to the client.

## Server contract

```ts
buildRecommendationPayload({
  candidates, // active movie, tvshow, teaching and video records
  history,    // actual playback rows for the validated active profile
  saved,      // optional explicit watchlist rows for that same profile
  currentId,
  currentType,
  currentGenres,
  now,        // optional epoch milliseconds, useful in tests
  seed,       // optional opaque profile identity; server uses userId:profileId
})
```

`history` and `saved` share `entertainment_id`, `entertainment_type`, optional `genres`/`genre_names`, and `updated_at`/`created_at`. History adds `watched_time` (position) and `total_watched_time` (media duration). Both accept numeric seconds, numeric strings, `MM:SS`, or `HH:MM:SS`. Invalid clocks, negative values and nonfinite numbers contribute zero. An episode is supplied under the actual parent title identity by the server. Unsupported or missing content types do not become preference/exclusion signals; the server resolves trustworthy legacy types before calling the engine.

IDs are always typed: `video:1` and `movie:1` are unrelated. The current title is excluded only when both its ID and supported type are available. The API validates the active viewer and scopes history and saved queries to its user/profile. Independent video candidates have unknown genres when no genuine mapping exists; the engine does not borrow genres from an entertainment record sharing that ID.

## Preference signals

A watch becomes meaningful at `min(120, max(30, duration × 0.02))` seconds. This ignores accidental starts, requires at least 30 seconds, and asks for slightly more evidence on long media. Progress is clamped to known duration. At 90% or more a title is complete; meaningful unfinished titles are classified separately as in progress. Both groups are excluded from recommendation rows. The server renders incomplete actual progress in its separate Continue Watching row.

A known-duration watch receives an engagement weight of `0.2 + 0.5 × sqrt(completion) + 0.3 × boundedLog(watchedSeconds)`. The logarithmic duration term saturates at 30 minutes. Unknown duration receives a weaker duration-only weight; it cannot establish completion. Watch preference weight has a 60-day half-life. Missing timestamps receive 35% weight, rather than fabricated recency. Saved titles start with weight 0.45 and a 180-day half-life; missing saved timestamps receive 50% weight. A saved title already completed does not add another saved vote.

Each typed title contributes at most its strongest decayed watch signal and strongest saved signal, preventing repeated progress writes or duplicate saves from multiplying votes. Each signal divides its genre weight across unique case-insensitive tags. A six-tag title therefore has the same total voting budget as a one-tag title. Type preferences receive the complete signal weight.

Absolute confidence is `min(1, totalSignalWeight / 0.65)`. Personalization blends back into the popular/fresh fallback as confidence declines. Below total weight 0.05, the result is a cold start even if ancient history remains stored. Completed/in-progress exclusions survive that loss of preference confidence. `hasHistory` means sufficient meaningful preference evidence, including explicit saves; it does not claim a watch occurred when only saves exist.

## Ranking and exploration

For a confident profile, the score combines 62% genre affinity, 18% content-type affinity, 10% logarithmic popularity, and 10% freshness. Genre affinity is normalized by preference weight and discounted by the square root of candidate tag count. The cold-start score is 55% popularity plus 45% freshness. On a detail page without a usable profile, actual current-title genres contribute 70%, with popularity/freshness at 15% each. That context remains explicitly nonpersonalized (`hasHistory: false`).

Freshness has a 90-day half-life and uses the first valid timestamp in updated, created, release-date order. SQLite timestamps without zones are interpreted as UTC. Malformed calendar dates are skipped, missing dates get no freshness bonus, and future dates cannot receive more freshness than today. This describes catalogue metadata freshness; it does not assert that an administrative update is a new release.

The first row takes up to eight candidates. Its first item is the relevance winner. Subsequent greedy choices apply a bounded penalty for genre/type overlap and repeated similar titles. The penalty encourages variety among plausible recommendations without forcing unrelated titles over much stronger matches.

Only after that row is chosen does discovery inspect the remaining candidates. Its score balances relevance (50%), novelty (35%), and freshness (15%). Selection is limited to up to five candidates within 0.08 of the best exploration score. A hash of profile seed plus UTC day chooses within this shortlist. Reloading the same profile/day is stable; profile/day changes can rotate the choice. This hash is for reproducibility, not security. The legacy optional `random` callback affects only this shortlist and never the main recommendation row.

Recent contains up to eight remaining titles sorted by valid metadata recency. All three groups are disjoint. A tiny catalogue retains its useful recommendations in the first row; discovery is `null` when there is no unused candidate. No filler titles, duplicate recommendations or fabricated personalization are inserted.

## Validation and limits

Run:

```sh
node scripts/gate-recommendation-v2.mjs
node scripts/gate-recommendations.mjs --scoring
node scripts/gate-recommendations.mjs --groups
node scripts/gate-recommendations.mjs --api
./node_modules/.bin/tsc --noEmit
```

Behavioral fixtures cover duration parsing, meaningful-progress boundaries, completion weighting, timestamp decay and absolute confidence, saved-only preferences, deduplication, genre budgets, typed ID overlap, diversity, exploration, stable seeds, cold starts, tiny/exhausted catalogues, malformed values/dates, and private metadata exclusion. The API gate checks profile scoping, typed joins, real video candidates, existing public API names, playback field preservation and read-only recommendation loading; it does not substitute for integration/database tests.

This is transparent content-based ranking, not collaborative filtering or a trained taste model. It has no dislike/skip labels, cannot learn unknown video genres, and treats supplied playback positions as evidence rather than proof of attentive viewing. Server history windows limit what it can know. Live playback write/read behavior, account isolation and UI presentation are separate integration responsibilities.
