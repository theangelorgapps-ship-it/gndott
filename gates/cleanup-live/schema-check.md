# Production-schema public-read validation

2026-11-07, read-only release check. Result: **PASS for the current public read SQL**, with the pending library migration still required before deployment.

Input: `.unlazy/cleanup-baseline/production-schema.json`, containing the actual production CREATE TABLE definitions for 95 tables and no row values. The test executes those definitions into Node SQLite `:memory:`. Production was never connected to or modified by this validation. No application files were edited, no server/browser was started, no packages were installed, and no network calls were made.

Validated SHA-256: API `eefc454dbe08322ff7d83b0c48b478c8caa13972562adc048a475feb8596ed11`; production-schema snapshot `27fdb1672bcd196f0bb37d989559eec2e23c27dd65cd74ae02b746c810aca399`.

## Results

| Coverage | Result |
| --- | --- |
| 31 anonymous handler cases | Passed, including two search queries and all requested catalogue/detail/recommendation/watchlist paths. |
| Five expanded detail cases | Passed movie, show, video, channel and cast detail SQL beyond the initial missing-row return. |
| Two profile-branch schema probes | Watchlist and Continue Watching SELECTs compile against the real existing profile/type/episode columns. |
| Two profile recommendation SQL probes | History and saved-signal SQL compile against the real schema. |
| Library read after pending migration | Both notes and verses SELECTs compile and execute against the added empty tables. |
| Total SQL | 104 executions, 71 distinct normalized SELECT statements, zero recorded SQL errors and zero handler failures. |
| Data isolation | Zero rows in every production-schema table after execution; no live reads or writes and no application write queries. |

The 31 anonymous cases are: getDashboard, getMovies, getTvShows, getTeachings, getVideos, getLiveChannels, getComingSoon, searchContent(`faith`), searchContent(`teachings`), getMovie, getTvShow, getVideo, getChannel, getGenres, getGenreContent, getRecommendations, getWatchlist, getContinueWatching, getFooterData, getGenresPage, getCastCrewList, getCastDetail, getFaqs, getPage, getTrending, getTopChannels, getLiveTvHome, getPayPerView, getHomeAds, getPlansPage and getReviews. Anonymous watchlist and Continue Watching returned needsAuth with no SQL query.

## Method and limits

The harness transpiles the actual `src/lib/api.ts`, `db.ts`, recommendations/contentRoutes modules and library module, using the same VM/D1-adapter approach as the existing data gates. Every prepare/execute failure is recorded before being rethrown, so `.catch(() => [])` and similar application fallbacks cannot hide a missing column or table from the test. All database operations issued by the application adapter must start with SELECT; the write method throws.

The database remains empty. For the five expanded detail cases only, after the initial SELECT has successfully executed and returned no row, the adapter supplies a minimal synthetic object so downstream detail SQL executes. These objects contain no production data and are never inserted. Two profile-only branches use a synthetic viewer solely to reach their SELECTs; that is schema validation, not an authentication test. The history/saved recommendation queries are extracted verbatim from the API source and executed with synthetic bound IDs. Empty-table execution validates names, joins, SQL syntax and bindings, not real row values, rendered output, payment behavior or authorization correctness.

## Required columns and the videos fix

- `videos` contains trailer_url, video_url_input, poster_url, thumbnail_url, access, created_at and updated_at. It **does not contain bunny_trailer_url**. A positive-control `SELECT bunny_trailer_url FROM videos` throws `no such column: bunny_trailer_url` against this exact schema.
- Current `src/lib/api.ts:138–141` and `:198–200` correctly select `NULL AS bunny_trailer_url` while retaining video_url_input. Both recommendation and dashboard video projections executed successfully.
- `entertainments` does contain bunny_trailer_url, bunny_video_url, video_url_input, video_upload_type, enable_quality, enable_subtitle, subtitle_file and subtitle_language. The entertainment projections should retain their existing real columns.
- `episodes` contains bunny_video_url, video_url_input, thumbnail_url, access, price and episode_number.
- `continue_watch` already contains profile_id, entertainment_type, episode_id, watched_time and total_watched_time; `watchlists` already contains profile_id, type, created_at and updated_at. The current profile SQL does not need an extra column migration.

## Release prerequisite

The production snapshot has none of `library_notes`, `library_verses` or `subscription_cancellations`. `migrations/20261107_library.sql` successfully creates these tables in memory, and the library reads pass after it is applied. Apply the pending migration to the intended production D1 database before releasing the library functionality, then verify the real schema. This test does not apply the migration remotely or claim that billing writes have been exercised.

Reproduce from the child repository:

```sh
node .unlazy/cleanup-baseline/schema-check.mjs
```

The temporary script is under the ignored `.unlazy` directory. It exits nonzero on any recorded SQL error or handler failure. Parent-owned build, behavior and live verification remain separate release gates.
