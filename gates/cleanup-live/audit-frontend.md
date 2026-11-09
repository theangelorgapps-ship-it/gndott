# Frontend cleanup audit

Contract: preserve the current working tree's visual design, public routes, APIs, auth, playback, and persistence. This leaf changes only this report and frontend-GATES.md. Application edits, package operations, browsers, servers, and deployment were not performed.

Repository: /Users/charlesfinney/Documents/Codex/Projects/New project/gndott; branch codex/apple-tv-experience; origin https://github.com/theangelorgapps-ship-it/gndott.git (identity supplied and verified by driver).

## Scope and four passes

1. Inventory: 37 route modules (2,094 lines), 36 component/support modules (5,300 lines), one playback hook (68 lines), and all 11 stylesheets (2,886 lines). CSS parser walked all 2,003 rules. Root CSS import order and generated route reachability were reviewed. The pending frontend diff spans 28 tracked route/component files; new working-tree components and styles were included.
2. Pending diff and symbol audit: inspected changed UI architecture, all frontend exports/imports, dynamic className expressions, DOM class mutations, runtime style injection, and editor/player controls. TypeScript --noEmit --noUnusedLocals --noUnusedParameters completed with only two frontend unused import diagnostics; third diagnostic is backend couponCode (not this leaf's scope).
3. Reachability and reductions: dependency leaf owns three entirely unreachable UI files/dependencies. This leaf examined orphaned exports in reachable modules and exact CSS selector reachability. App source symbol counts were cross-checked with scripts and demo sources; dead export groups below have no runtime consumer.
4. Falsification: retained dynamic Lucide classes, shared selector groups, :not() rules, Tailwind utilities, tokens, rich-editor styles, the active shader, responsive cascade, and safeguards. Detected raw CMS HTML in pages/FAQ, preventing unconditional CSS pruning based only on source absence. No runtime processes remain; tsc process ended with exit 2 due solely to the three unused-symbol diagnostics.

## Ranked proven cuts (independent of CMS)

- delete: unused TrailerPlayer and BunnyPlayer components; no replacement because active playback is WatchSection -> ImmersivePlayer. src/components/Detail.tsx:35-53 and 183-203. 40 lines. Both symbols occur once in app source (their declarations); all other hits are stale literal expectations in scripts/leaf-metadata.mjs. Keep youtubeId (TitlePreview uses it), safeVideoUrl (hasPlaybackSource uses it), img, IconPlay, and all shared playback styles. Retain/modernize the gate's behavioral assertions instead of deleting tests.
- delete: unreachable 21st.dev branded demo preset, its embedded MARK_21ST SVG, associated prop type and default export. src/components/ui/liquid-glass-logo-reveal.tsx:1108-1135. 28 lines including the isolated section comment/trailing blank. BrandOpener.tsx:2,40 dynamically selects the named GlassIconReveal export; no default import or GlassReveal21st consumer exists in src, scripts or demo. Keep lines 1-1107 and the full active shader/engine.
- delete: unused IconShare, IconCalendar, IconClock and one-line ContentCard forwarding component. src/components/Poster.tsx:49-51,55-60,502-504. 12 lines. Each occurs only at its declaration in src; ContentCard also has a stale metadata gate string, and Calendar/Clock appear in legacy leaf-labels assertions against the current video route (which already no longer uses them). The current TitleDetail metadata and active share control remain unchanged.
- delete: unused LiquidGlass wrapper and its sole ReactNode type import. src/components/ui/liquid-glass.tsx:1,8-10. 4 lines. The app imports only LiquidGlassLayers and LiquidGlassFilter (root, movies, home). Keep both active exports and liquid-glass.css.
- delete: four exactly redundant CSS rules (identical later declarations in the same cascade/media context). src/styles.css:57 (opacity retained at 1474),345 (align-items retained at 1468),462 (color retained at 793),988 (identical coarse-pointer media rule retained at 1653-1655). 4 lines; remove the whole now-redundant one-line media block at 988. This is safe even for arbitrary CMS classes.
- delete: unused NeedsAuth import specifier in src/routes/change-password.tsx:4 and Link import specifier in src/routes/subscription-plan.tsx:1. No replacement. Two named specifiers, zero whole lines; compiler TS6133 confirms both. Keep other imported names and all route implementations.

net: -88 lines, -0 deps possible in this leaf's proven findings. Dependency leaf separately owns 686 lines in three dead UI files and package removals; do not double-count them.

## Gate and API safeguards

scripts/leaf-metadata.mjs:176-247 and scripts/leaf-labels.mjs:119-120 contain stale implementation-string assertions for superseded UI (for example DiscreteTabs and BIBLE_READINGS are already absent). They are evidence of test drift, not proof that a dead export is used. Implementation must retain safety coverage and update any affected checks toward the current rendered components rather than delete scripts or weaken auth/playback assertions. This leaf does not authorize dropping exported props from active components, route loaders, public server functions or error handling.

No route is recommended for deletion. The 1,107-line live logo implementation and the 997-line rich-text editor are active features, not dead weight. Rich-text editor controls, fullscreen-aware Radix portals, Bible reader marks, note migration, resume logic, and direct/native HLS branches stay intact.

## Approved CSS cuts after production CMS proof

The following 266 rules cover 358 original physical lines. They all require a class token absent from the reachable source (after excluding the three whole-module cuts). This is a conservative list: a shared rule remains if any selector could match active UI, :not() rules are excluded, and runtime lucide-* classes are exempted. No declarations are reordered or merged. Mixed active/dead selector lists and apparently overridden styles are deliberately preserved.

The initial CMS blocker is resolved. The driver supplied `.unlazy/cleanup-baseline/cms-class-scan.json`: Python HTMLParser inspected all 31 production CMS rows (6 pages, 25 FAQs), including unquoted attributes, and found no class tokens or style/script elements. A selector AST pass then validated all 266 listed rules: every comma-separated selector has at least one absent, positive, top-level class node. The absence witness is outside every functional pseudo-selector, so no :is/:not/:has parsing assumption is involved. All 266 cuts are now recommended. Remove only these rule nodes; preserve all remaining selectors, declaration order, imports, keyframes, and media conditions. Empty media wrappers can be removed after their last rule is removed. The 358 original rule lines are additional to the earlier 88; actual serialized line savings are printed by the executable specification below.

The Lenis selectors at styles.css:686-689 also have dependency-leaf confirmation that no Lenis code is imported; data-lenis-prevent attributes remain harmless and should be preserved because they are active markup conventions. There is no reason to touch the live header generated Lucide selectors.

| File | Original lines | Selector |
| --- | --- | --- |
| src/catalogue.css | 61 | .pv-card .pv-play |
| src/catalogue.css | 62 | .pv-card .pv-icon |
| src/detail.css | 46 | .tv-title-page .supplement-kicker, .tv-title-page .bible-verse cite |
| src/player.css | 52 | .tv-player-panel .supplement-kicker |
| src/player.css | 59 | .tv-player-panel .bible-grid |
| src/player.css | 60 | .tv-player-panel .bible-verse |
| src/player.css | 61 | .tv-player-panel .bible-verse p |
| src/player.css | 62 | .tv-player-panel .bible-verse cite |
| src/player.css | 63 | .tv-player-panel .bible-link |
| src/player.css | 100 | .tv-player-panel .bible-grid |
| src/player.css | 101 | .tv-player-panel .bible-verse + .bible-verse |
| src/styles.css | 60-64 | .subscribe-btn |
| src/styles.css | 70 | .btn-circle |
| src/styles.css | 84 | .hero-genres |
| src/styles.css | 85 | .hero-genres span + span::before |
| src/styles.css | 142-147 | .lang-card |
| src/styles.css | 148 | .lang-card .lang-name |
| src/styles.css | 149 | .lang-card .lang-count |
| src/styles.css | 157 | .detail-inner .crating |
| src/styles.css | 162 | .episode-row |
| src/styles.css | 163 | .episode-row .thumb |
| src/styles.css | 164 | .episode-row .ep-name |
| src/styles.css | 165 | .episode-row .ep-meta |
| src/styles.css | 181 | .auth-card .auth-logo |
| src/styles.css | 196 | .auth-2col |
| src/styles.css | 197 | .demo-box |
| src/styles.css | 198 | .demo-box h3 |
| src/styles.css | 199 | .demo-box .demo-cred |
| src/styles.css | 212-213 | .footer-bottom |
| src/styles.css | 214 | .footer-bottom .links |
| src/styles.css | 217 | .admin-shell |
| src/styles.css | 218 | .admin-side |
| src/styles.css | 219 | .admin-side .brand-row |
| src/styles.css | 220 | .admin-side .brand-row img |
| src/styles.css | 221 | .back-pill |
| src/styles.css | 222 | .side-group |
| src/styles.css | 223 | .side-group .side-title |
| src/styles.css | 224 | .side-group a |
| src/styles.css | 225 | .side-group a svg |
| src/styles.css | 226 | .side-group a:hover |
| src/styles.css | 227 | .side-group a.active |
| src/styles.css | 228 | .side-group a.side-sub |
| src/styles.css | 229 | .side-group a.side-sub::before |
| src/styles.css | 230 | .admin-body |
| src/styles.css | 231 | .admin-topbar |
| src/styles.css | 232 | .admin-topbar .avatar |
| src/styles.css | 233 | .admin-main |
| src/styles.css | 234 | .breadcrumb |
| src/styles.css | 235 | .breadcrumb .sep |
| src/styles.css | 236 | .breadcrumb .here |
| src/styles.css | 238 | .dash-grid |
| src/styles.css | 239 | .stat-grid |
| src/styles.css | 240 | .stat-card |
| src/styles.css | 241 | .stat-card .stat-ico |
| src/styles.css | 242 | .stat-card .spark |
| src/styles.css | 243 | .stat-card .lbl |
| src/styles.css | 244 | .stat-card .num |
| src/styles.css | 245 | .stat-card .delta |
| src/styles.css | 246 | .stat-card .delta.neg |
| src/styles.css | 247 | .genre-panel |
| src/styles.css | 248 | .genre-panel .donut |
| src/styles.css | 249 | .donut-legend |
| src/styles.css | 250 | .donut-legend li |
| src/styles.css | 251 | .donut-legend .dot |
| src/styles.css | 254 | .admin-2col |
| src/styles.css | 257 | .toolbar .spacer |
| src/styles.css | 270 | .admin-table .cell-sub |
| src/styles.css | 280 | .row-actions |
| src/styles.css | 282 | .btn-danger |
| src/styles.css | 283 | .btn-danger:hover |
| src/styles.css | 285 | .modal-back |
| src/styles.css | 291 | .modal .field-row |
| src/styles.css | 292 | .modal .modal-actions |
| src/styles.css | 294 | .settings-group |
| src/styles.css | 295 | .settings-group h3 |
| src/styles.css | 296 | .setting-row |
| src/styles.css | 297 | .setting-row .s-name |
| src/styles.css | 298 | .setting-row input |
| src/styles.css | 305 | .admin-shell |
| src/styles.css | 306 | .admin-side |
| src/styles.css | 307 | .stat-grid |
| src/styles.css | 308 | .dash-grid |
| src/styles.css | 309 | .admin-2col |
| src/styles.css | 339 | .auth-socials |
| src/styles.css | 340 | .auth-socials .btn |
| src/styles.css | 341 | .admin-link |
| src/styles.css | 342 | .auth-socials |
| src/styles.css | 346 | .nav-drop |
| src/styles.css | 347-350 | .nav-drop-label |
| src/styles.css | 351 | .nav-drop:hover .nav-drop-label |
| src/styles.css | 352 | .nav-drop.active .nav-drop-label |
| src/styles.css | 353-358 | .nav-drop-menu |
| src/styles.css | 359 | .nav-drop:hover .nav-drop-menu |
| src/styles.css | 360 | .nav-drop-menu a |
| src/styles.css | 361 | .nav-drop-menu a:hover |
| src/styles.css | 368 | .avatar-link |
| src/styles.css | 369 | .avatar-link .avatar |
| src/styles.css | 370 | .avatar-link:hover .avatar |
| src/styles.css | 413-416 | .hero-live .hero-live-content |
| src/styles.css | 417 | .hero-live-badge |
| src/styles.css | 418 | .hero-live-cat |
| src/styles.css | 419 | .hero-live-title |
| src/styles.css | 420 | .hero-live-content .btn |
| src/styles.css | 421 | .hero-dots-center |
| src/styles.css | 494 | .search-hero |
| src/styles.css | 496 | .search-bar |
| src/styles.css | 497 | .search-bar input |
| src/styles.css | 498 | .search-bar input:focus |
| src/styles.css | 499 | .search-bar button |
| src/styles.css | 500 | .search-active |
| src/styles.css | 501 | .search-cols |
| src/styles.css | 502 | .search-cols h3 |
| src/styles.css | 503 | .spills |
| src/styles.css | 504 | .spill |
| src/styles.css | 505 | .spill:hover |
| src/styles.css | 506 | .pop-item |
| src/styles.css | 507 | .pop-item:hover |
| src/styles.css | 519 | .cs-lang |
| src/styles.css | 529 | .search-cols |
| src/styles.css | 537 | .detail-player |
| src/styles.css | 549 | .detail-info |
| src/styles.css | 550 | .detail-title |
| src/styles.css | 551 | .detail-desc |
| src/styles.css | 552 | .detail-tabs |
| src/styles.css | 554 | .review-list |
| src/styles.css | 555 | .review-card |
| src/styles.css | 556 | .review-avatar |
| src/styles.css | 557 | .review-body |
| src/styles.css | 558 | .review-head |
| src/styles.css | 559 | .review-author |
| src/styles.css | 560 | .review-date |
| src/styles.css | 561 | .review-text |
| src/styles.css | 562 | .stars |
| src/styles.css | 582 | .acct-actions |
| src/styles.css | 583 | .btn-gold |
| src/styles.css | 584 | .btn-gold:hover |
| src/styles.css | 585 | .acct-info-box |
| src/styles.css | 586 | .acct-info-box strong |
| src/styles.css | 611 | .profile-gate-btn |
| src/styles.css | 625 | .btn-circle.active-watch |
| src/styles.css | 628 | .review-form |
| src/styles.css | 629 | .review-form h3 |
| src/styles.css | 630 | .review-form textarea |
| src/styles.css | 631 | .star-input |
| src/styles.css | 632 | .star-input button |
| src/styles.css | 633 | .star-input button.on |
| src/styles.css | 636 | .ad-overlay |
| src/styles.css | 637 | .ad-video, .ad-image |
| src/styles.css | 638 | .ad-image |
| src/styles.css | 640 | .ad-skip |
| src/styles.css | 641 | .ad-skip.disabled |
| src/styles.css | 642 | .ad-loading |
| src/styles.css | 668 | .profile-kid |
| src/styles.css | 669 | .profile-delete |
| src/styles.css | 686 | html.lenis, html.lenis body |
| src/styles.css | 687 | .lenis.lenis-smooth |
| src/styles.css | 688 | .lenis.lenis-smooth [data-lenis-prevent] |
| src/styles.css | 689 | .lenis.lenis-stopped |
| src/styles.css | 769-776 | .subscribe-btn |
| src/styles.css | 777-782 | .subscribe-btn::after |
| src/styles.css | 783 | .subscribe-btn:hover |
| src/styles.css | 784 | .subscribe-btn:hover::after |
| src/styles.css | 785 | .subscribe-btn:active |
| src/styles.css | 813 | .lang-card:hover |
| src/styles.css | 820-825 | .hero-bg |
| src/styles.css | 836 | .hero-stagger > * |
| src/styles.css | 837 | .hero-stagger > *:nth-child(1) |
| src/styles.css | 838 | .hero-stagger > *:nth-child(2) |
| src/styles.css | 839 | .hero-stagger > *:nth-child(3) |
| src/styles.css | 840 | .hero-stagger > *:nth-child(4) |
| src/styles.css | 841 | .hero-stagger > *:nth-child(5) |
| src/styles.css | 863-874 | .nav-drop-menu |
| src/styles.css | 875-879 | .nav-drop:hover .nav-drop-menu, .nav-drop:focus-within .nav-drop-menu |
| src/styles.css | 880 | .nav-drop-menu a |
| src/styles.css | 946 | .subscribe-glass |
| src/styles.css | 947-950 | .subscribe-glass-text |
| src/styles.css | 951 | .subscribe-glass .glass-button-text |
| src/styles.css | 952 | .login-liquid |
| src/styles.css | 953 | .login-liquid .liquid-glass-backdrop |
| src/styles.css | 969 | .pv-thumb |
| src/styles.css | 970 | .pv-body |
| src/styles.css | 972-976 | .pv-play |
| src/styles.css | 977 | .pv-play:hover |
| src/styles.css | 978-983 | .pv-icon |
| src/styles.css | 984 | .pv-icon:hover |
| src/styles.css | 987 | .pv-meta .pv-match |
| src/styles.css | 1001 | .subscribe-glass .glass-button-text |
| src/styles.css | 1023 | .detail-title |
| src/styles.css | 1040 | .hero-live-title |
| src/styles.css | 1041 | .detail-title |
| src/styles.css | 1056 | .detail-tabs |
| src/styles.css | 1057-1060 | .discrete-tabs |
| src/styles.css | 1061 | .discrete-tabs::-webkit-scrollbar |
| src/styles.css | 1062-1069 | .tabs .discrete-tab |
| src/styles.css | 1070-1074 | .tabs .discrete-tab.active |
| src/styles.css | 1075 | .tabs .discrete-tab:hover |
| src/styles.css | 1076 | .discrete-tab:focus-visible |
| src/styles.css | 1077 | .discrete-tab-icon |
| src/styles.css | 1078 | .discrete-tab-label |
| src/styles.css | 1083-1086 | .supplement-kicker |
| src/styles.css | 1089 | .bible-grid |
| src/styles.css | 1090-1093 | .bible-verse |
| src/styles.css | 1094 | .bible-verse p |
| src/styles.css | 1095 | .bible-verse cite |
| src/styles.css | 1096 | .bible-link |
| src/styles.css | 1109 | .bible-grid |
| src/styles.css | 1110 | .bible-verse |
| src/styles.css | 1114 | .detail-player |
| src/styles.css | 1115 | .detail-info |
| src/styles.css | 1116 | .detail-tabs |
| src/styles.css | 1117 | .tabs .discrete-tab |
| src/styles.css | 1118 | .tabs .discrete-tab.active |
| src/styles.css | 1121 | .bible-verse p |
| src/styles.css | 1126 | .tabs .discrete-tab |
| src/styles.css | 1479-1483 | .subscribe-glass |
| src/styles.css | 1484 | .subscribe-glass .glass-button |
| src/styles.css | 1485 | .subscribe-glass .glass-button-text |
| src/styles.css | 1486 | .subscribe-glass-text |
| src/styles.css | 1487 | .login-liquid |
| src/styles.css | 1523 | .pv-thumb |
| src/styles.css | 1524 | .pv-thumb video, .pv-thumb iframe |
| src/styles.css | 1535 | .detail-info, .detail-tabs |
| src/styles.css | 1537 | .detail-tabs .discrete-tabs |
| src/styles.css | 1539 | .episode-copy |
| src/styles.css | 1540 | .ep-meta |
| src/styles.css | 1541 | .season-selector-layout |
| src/styles.css | 1542 | .season-selector-layout > :only-child |
| src/styles.css | 1543 | .season-summary |
| src/styles.css | 1544 | .season-summary-poster |
| src/styles.css | 1545 | .season-summary-copy |
| src/styles.css | 1546 | .season-summary-kicker |
| src/styles.css | 1547 | .season-summary-title |
| src/styles.css | 1548 | .season-summary-meta |
| src/styles.css | 1549 | .season-summary-desc |
| src/styles.css | 1550 | .season-selector |
| src/styles.css | 1551 | .season-pills |
| src/styles.css | 1552 | .episode-list |
| src/styles.css | 1553 | .episode-list .episode-row:last-child |
| src/styles.css | 1554 | .episode-empty |
| src/styles.css | 1571 | .subscribe-glass |
| src/styles.css | 1572 | .login-liquid |
| src/styles.css | 1585 | .subscribe-glass |
| src/styles.css | 1586 | .subscribe-glass .glass-button |
| src/styles.css | 1587 | .subscribe-glass .glass-button-text |
| src/styles.css | 1588 | .subscribe-glass-text |
| src/styles.css | 1589 | .login-liquid |
| src/styles.css | 1590 | .avatar-link .avatar |
| src/styles.css | 1592-1595 | .mobile-menu-backdrop |
| src/styles.css | 1620 | .season-selector-layout |
| src/styles.css | 1624 | .search-cols |
| src/styles.css | 1630 | .subscribe-glass |
| src/styles.css | 1633 | .hero-live-title |
| src/styles.css | 1640 | .detail-title |
| src/styles.css | 1641 | .detail-player |
| src/styles.css | 1642 | .detail-info, .detail-tabs |
| src/styles.css | 1643 | .episode-row |
| src/styles.css | 1644 | .episode-row .thumb |
| src/styles.css | 1645 | .ep-name |
| src/styles.css | 1646 | .season-summary-copy |
| src/styles.css | 1647 | .bible-verse |
| src/styles.css | 1649 | .search-hero |
| src/styles.css | 1650 | .search-cols |
| src/tv-theme.css | 45 | .btn-circle |
| src/tv-theme.css | 46 | .btn-circle svg |
| src/tv-theme.css | 51 | .pv-play |
| src/tv-theme.css | 52 | .pv-icon |

## Reproduction and reviewed snapshot

- Run the local installed compiler: ./node_modules/.bin/tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false. Result: TS6133 only for api.ts:971 couponCode, change-password.tsx:4 NeedsAuth, subscription-plan.tsx:1 Link.
- Search each removed symbol in src, scripts and demo. Do not count its declaration or a source-text test assertion as a runtime consumer.
- Parse all src/*.css with installed PostCSS; candidate selection requires an absent positive class token in every comma-separated selector. Match exact class token boundaries, not substrings (bible-verse is distinct from bible-verse-select). Exempt lucide-* runtime classes and :not() cases.
- Final implementation validation should include tsc, production build, all current behavioral gates, and desktop/mobile screenshot comparison, especially header, poster hover, watch modal, profile/library and rich-editor controls.

Reviewed file SHA-256 values (source was not edited by this leaf):

- src/components/Detail.tsx: 7f35423a8ccbb6ee9c204186cdb839ad2ed026dc3b05bb350b2e5d2f5f39cef3
- src/components/Poster.tsx: e685960ac8464531cba9a68b2cfc9b0e6f061ba42fb50d9e0ffdc431cdf78d05
- src/components/ui/liquid-glass-logo-reveal.tsx: 1820a77bf7d2962da9faf95e2dd611a469d267a262ccf3652bb4e8ef012702ba
- src/components/ui/liquid-glass.tsx: 2dc7a97925753ea91f811616929a926272006fc04dd3fd5b791502572b4fe890
- src/styles.css: 245dadcacd8e9e5264caaa4502315061f93b186a9b63934bbee4ebae814222aa


## Executable CSS removal and proof specification

Runtime producers were reviewed explicitly: `MotionRoot` adds only `scrolled`/`in`; the only assembled application class-name family is `search-category-${category.key}`; Lucide generates `lucide`/`lucide-*`; Tiptap/ProseMirror generates editor/selection classes; Radix uses state attributes plus the local `rte-*` wrappers. All are protected. The three unreachable UI files are excluded from the baseline source proof; no other source modules are excluded. All `className` passthroughs terminate at static application callsites or the protected editor wrappers. Provider iframes have separate documents; production CMS has no class-bearing markup. Inline style attributes cannot make one of these class selectors match.

No remaining reason to retain the 266 rules was found. Do not extrapolate to other rules, keyframes, shared declaration groups, or tokens. In particular, do not delete `.admin-table`, generic modal/field rules, `.tv-detail-*`, live `.bible-verse-select`, generated icons, or active glass/editor styles.

Run this code from the repository using the existing Node dependencies. Default mode validates and calculates the exact effect without writing application files. The implementation owner may run with `APPLY=1` only after driver authorization. All matches and syntax checks finish before any file write. Current rules are matched by original selector, exact rule text, and ancestor condition, so the four earlier duplicate-rule cuts do not shift or corrupt this operation. There is no blanket source-to-style purge or line-number edit.

```js
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'

const baseline = '.unlazy/cleanup-baseline/'
const cms = JSON.parse(fs.readFileSync(baseline + 'cms-class-scan.json', 'utf8'))
assert.equal(cms.rows, 31)
assert.deepEqual(cms.class_tokens, [])
assert.equal(cms.has_style_element, false)
assert.equal(cms.has_script_element, false)
const report = fs.readFileSync('gates/cleanup-live/audit-frontend.md', 'utf8')
const specs = [...report.matchAll(/^\| (src\/[^|]+\.css) \| (\d+)(?:-(\d+))? \| (.+) \|$/gm)]
  .map(m => ({ file: m[1], start: +m[2], end: +(m[3] || m[2]), selector: m[4] }))
assert.equal(specs.length, 266)
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])
const excluded = new Set([
  'src/components/ui/discrete-tab.tsx',
  'src/components/ui/glass-button.tsx',
  'src/components/ui/liquid-glass-button.tsx',
])
const sourceAt = prefix => walk(prefix + 'src')
  .filter(f => /\.(tsx?|json)$/.test(f) && !excluded.has(f.slice(prefix.length)))
  .map(f => fs.readFileSync(f, 'utf8')).join('\n')
const allSource = sourceAt(baseline) + '\n' + sourceAt('')
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const protectedClass = c => /^(lucide(?:-|$)|search-category-|rte-|tiptap(?:-|$)|ProseMirror|is-editor-empty|fake-selection)/.test(c)
const absent = c => !protectedClass(c) && !new RegExp('(?<![\\w-])' + escape(c) + '(?![\\w-])').test(allSource)
const ancestors = node => {
  const result = []
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent)
    result.unshift(p.type === 'atrule' ? [p.name, p.params] : [p.type, p.selector])
  return JSON.stringify(result)
}
const signature = node => JSON.stringify([ancestors(node), node.selector, node.toString()])
const rulesOf = root => { const result = []; root.walkRules(r => result.push(r)); return result }
const replacements = []
let removed = 0
for (const [file, entries] of Map.groupBy(specs, s => s.file)) {
  const originalRules = rulesOf(postcss.parse(fs.readFileSync(baseline + file, 'utf8')))
  const before = fs.readFileSync(file, 'utf8')
  const current = postcss.parse(before)
  const currentRules = rulesOf(current)
  const selected = new Set()
  for (const spec of entries) {
    const original = originalRules.find(r => r.source.start.line === spec.start &&
      r.source.end.line === spec.end && r.selector === spec.selector)
    assert(original, `Original rule missing: ${file}:${spec.start}`)
    const selectors = selectorParser().astSync(original.selector)
    for (const selector of selectors.nodes) {
      const witness = selector.nodes.find(n => n.type === 'class' && absent(n.value))
      assert(witness, `No absent positive top-level class: ${file}:${spec.start} ${selector}`)
    }
    const matches = currentRules.filter(r => !selected.has(r) && signature(r) === signature(original))
    assert.equal(matches.length, 1, `Current rule changed/ambiguous: ${file}:${spec.start}`)
    selected.add(matches[0])
  }
  const retained = currentRules.filter(r => !selected.has(r)).map(signature)
  for (const node of selected) node.remove()
  current.walkAtRules(a => { if (a.nodes && a.nodes.length === 0) a.remove() })
  const after = current.toString()
  const parsed = postcss.parse(after)
  assert.deepEqual(rulesOf(parsed).map(signature), retained, `Retained CSS changed: ${file}`)
  replacements.push({ file, before, after, removed: selected.size })
  removed += selected.size
}
assert.equal(removed, 266)
const lines = s => (s.match(/\n/g) || []).length
console.log(JSON.stringify({ mode: process.env.APPLY === '1' ? 'apply' : 'proof', rules: removed,
  files: replacements.map(r => ({ file: r.file, rules: r.removed,
    linesSaved: lines(r.before) - lines(r.after), bytesSaved: Buffer.byteLength(r.before) - Buffer.byteLength(r.after) })) }, null, 2))
if (process.env.APPLY === '1') for (const r of replacements) fs.writeFileSync(r.file, r.after)
```


Proof-mode execution passed against the current working tree after the implementation owner's initial cuts: 266 exact nodes, all retained rules unchanged, all output CSS reparsed. Serialized savings are **371 lines / 26,212 bytes** (catalogue 2/109, detail 1/96, player 8/565, styles 356/25,173, tv-theme 4/269). This includes removal of newly empty media wrappers; the table's 358 counts only original rule spans. No application files were written during proof mode.

To execute the guarded block without creating a helper file:

```sh
python3 - <<'PYCODE' | node --input-type=module
from pathlib import Path
print(Path('gates/cleanup-live/audit-frontend.md').read_text().split('```js\n')[1].split('\n```')[0])
PYCODE
```

The implementation owner changes the Node command to `APPLY=1 node --input-type=module` for the authorized write.
