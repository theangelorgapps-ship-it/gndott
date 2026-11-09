# Gates: responsive liquid glass refinement

Scope: implement the requested rail edges, badges, Categories, black brand opener, mobile dock/editor/reader and 4K layout in the existing local application.

- [x] R1: All shared horizontal content rails soften artwork into glass blur at both scrolling edges while keeping cards and controls usable.
  EVIDENCE: Browser inspection found all 13 home content rails wrapped; 12px blur, masked gradients and pointer-events:none. Scrolling Categories to 129px showed both edges, nonoverflowing Continue Watching showed neither. Clip rails use the same component. Title page width equals 320px after removing the inappropriate negative margin.
- [x] R2: Recently Uploaded badges are horizontally centred and remain a single readable line on phones.
  EVIDENCE: At 391px, all eight badges measured clientWidth=scrollWidth=99px, white-space:nowrap and centre error below .006px. Phone poster minimum is 116px. Screenshot: verification/glass-mobile-badges.jpg.
- [x] R3: Categories replaces Genres in the home section and category cards use the clear glass material with working navigation.
  EVIDENCE: Visible Categories heading and Categories titles region. Cards contain refraction/tint/light layers, have 0px borders and navigate correctly; Faith opened /search?q=&type=all&genre=19. Screenshot: verification/glass-categories.jpg.
- [x] R4: The supplied reveal opens on black with the Halobox logo, exits reliably, supports skip and reduced motion, and releases rendering resources.
  EVIDENCE: Forced home reload showed gold logo refraction, black rgb(0,0,0) background and GoodNews/Halobox wordmark. Skip and automatic dismissal removed dialog and canvas. StrictMode timer replay fixed. Source review confirms reduced-motion static logo, 700ms exit, six-second safety deadline, observer/animation cleanup and explicit GL disposal. Reduced-motion and no-WebGL paths were reviewed in source, not emulated on hardware.
- [x] R5: Mobile navigation matches the reference proportions and bottom placement; the search circle shares its centre line and the material is clear with visible refraction and highlights.
  EVIDENCE: At 391×844 both controls top=770, bottom=834, height=64; at 320×800 both top=730, bottom=790, height=60. Separate search circle, blue selected bubble, clear layered artwork visible underneath. Search-page home/input also share top=732/bottom=786 at 320px. Screenshot: verification/glass-mobile-badges.jpg.
- [x] R6: The mobile notes editor has reachable formatting and actions without overflow, preserves edits, and works inside the player.
  EVIDENCE: Six primary controls measure 46.67×44px at 320px; editor width=288px with no panel overflow. More exposes full formatting. Typed a suffix into the existing formatted draft, then Undo restored original HTML including bold and link; existing note was not overwritten. Save/PDF buttons share a 46px-high row. Screenshot: verification/glass-mobile-notes.png.
- [x] R7: Bible selectors, passage and verse actions read comfortably on mobile, scroll independently and retain a useful desktop two-column layout.
  EVIDENCE: 320px phone selectors fit at 73.78/130.22/68px wide and 46px high, single-column verses, no panel overflow. 391px player panel independently scrolls 4593px within 540px. At 3840px reader width=1600px, two columns, 24px verse type. Next chapter loaded John 4 and panel scrollTop=0. Existing saved highlight remained intact.
- [x] R8: The layout scales intentionally to 3840 × 2160 with readable navigation, headings, cards and bounded reading widths.
  EVIDENCE: Actual CSS viewport 3840×2160, body width=3840, navigation type=24.96px, section headings=44px, hero title=99.84px, home posters=345.59×518.39px. Sermon grid has nine 363.88px columns, filters=23px, hero height=1560px. Reader bounded at 1600px. Browser viewport verification, not a physical television performance test.
- [x] R9: TypeScript, production build and relevant playback/library regressions pass, with no whitespace errors.
  CHECK: node scripts/gate-glass-responsive.mjs
  EXPECT: GLASS_RESPONSIVE_OK
  CWD: /Users/charlesfinney/Documents/Codex/Projects/New project/gndott
  EVIDENCE: automatic-evidence=v1; definition-sha256=d3878e53ec587723b91b1f0dda42c3de30c6e830d2f839a1a291992dc941fc5d; exit=0; EXPECT=matched; output-sha256=94efa7b7c1b5a3cbb5fed81c5e5c1e598f3a2afff03b09209df108643da69f0e; output-bytes=1727; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/Codex/Projects/New project/gndott; path=ca21ac988431/25 entries
