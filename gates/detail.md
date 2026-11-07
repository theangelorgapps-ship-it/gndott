# Gates: title detail flow
Scope: Artwork-first Apple TV detail pages with real playback and existing supporting features preserved.
- [x] T1: Shared artwork-first title shell, white Play, watchlist, back/share and expandable synopsis on movie/video/show/teaching pages.
  EVIDENCE: src/components/TitleDetail.tsx uses portrait/landscape picture sources, a 48px Play/watchlist pair, 44px back/share utilities, native share -> clipboard -> selectable link fallback and collapsed synopsis. Both standalone routes and ShowDetail use it. Video watchlist is explicitly unavailable because existing watchlist endpoint accepts entertainment IDs only; no fake video save was added.
- [x] T2: Play enters existing WatchSection; no autoplaying player before intent; purchase/login semantics retained; playback can be dismissed.
  EVIDENCE: Compiled actual TSX and server-rendered it: initial TitleDetail contained no iframe/video; unpaid episode and parent-title gates independently withheld iframe; owned episode rendered its own URL with autoplay=false; valid direct media rendered video; absent/unsafe sources were handled. PlaybackDialog uses native showModal (focus trap/background inert), Escape cancel, explicit close, body scroll lock and focus restoration. #watch is supported for explicit homepage Play intent. Watchlist and rental requests use catch/finally. No API or schema edited by this leaf.
- [x] T3: Shows display usable season/episode controls; Bible/Notes/About/clips/recommendations retained.
  EVIDENCE: ShowDetail defaults to episodes, native select filters by season_id, and enabled cards select that episode's own Bunny/trailer/direct media source. Unavailable cards say Playback unavailable and are disabled. Parent API read-only episode fields and myPurchase are consumed; episode purchase never inherits parent purchase. Bible, local notes (with storage failure feedback), About, clips, and recommendations remain reachable.
- [x] T4: Responsive, keyboard and reduced-motion presentation; final code reread and meaningful checks pass.
  CHECK: ./node_modules/.bin/tsc --noEmit
  EVIDENCE: (no output)

- [x] T5: Actual API regression coverage validates genre joins, hero genres and episode entitlements without a remote database.
  CHECK: node scripts/gate-tv-data.mjs
  EXPECT: TV_DATA_API_OK
  EVIDENCE: TV_DATA_API_OK: actual genre join, seven hero projections, episode sources/access, and user/type/expiry isolation

## Pass log
1. Complete implementation: shared title shell, intent-driven modal, route integration, seasons and episode cards, neutral responsive leaf stylesheet.
2. Expert reread: preserved true paid/auth semantics; separate parent and episode purchase gates; video watchlist made honestly unavailable; metadata only from loader fields.
3. Defect hunt: actual server-render checks passed for initial no-player state, independent purchase gates, owned source, direct media, unsafe/missing sources, synopsis collapse. Added request failure recovery and private-browser notes handling. Typecheck passed.
4. Polish: tuned phone hero to 720–820px, 320px spacing, 48/44px controls, neutral clip controls, episode descriptions, focus-visible, reduced-motion and native-scroll exclusions. Final reread found no further blocking issue. No server or browser process started by this leaf.

Integration boundary: Parent performs browser screenshots, actual modal keyboard/focus tests and responsive overflow checks. This ledger records implementation and component-render evidence, not an unperformed browser test. Live third-party player delivery and financial transactions were not exercised.

## API verification follow-up
Added scripts/gate-tv-data.mjs with real transpiled API/DB/recommendation handlers over an isolated in-memory SQLite fixture. Queries are taken from the application, not copied into the test; all SQL errors are tracked even when handlers catch them. Tests exercise genre matching and id ambiguity, seven hero-query projections with active mapped genres, numeric seasons, episode source/access/price fields, unpublished/deleted/other-show exclusion and viewer/type/expiry purchase isolation. No remote data or writes are used. Existing recommendation scoring, groups and API gates passed after narrowly documenting getGenreContent in the intentional-change whitelist. Metadata absence gate and tsc passed after retaining the original exclusion of classification labels from detail UI.
