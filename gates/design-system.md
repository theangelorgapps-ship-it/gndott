# Gates: Apple TV design library

Scope: Control-level extraction and 24-category HTML demonstration of supplied Apple TV screenshots. Browser screenshots and the single independent visual review belong to the parent integration gate.

- [x] D1: Eight screenshots considered, control regions documented, control-only pixel samples recorded and screenshot/inferred sources separated.
  EVIDENCE: demo/apple-tv/analysis.md records S1–S8 and regions R01–R40. All eight images were inspected with view_image; control-samples.json records 21 exact pixels and full SHA-256 values. Eight inputs / seven unique; S4 = S5.

- [x] D2: tokens.json and tokens.css include primitives, semantic/component tokens and --tv- application aliases.
  CHECK: python3 demo/apple-tv/verify-library.py
  EXPECT: PASS: 11 app aliases
  EVIDENCE: PASS: 8 sources / 7 unique; 21 control samples; token references and local links resolve. | PASS: 11 app aliases; focus, reduced motion, native disabled states; no unresolved markers. Static verificat

- [x] D3: components.html and components-list.md contain all 24 categories and required states; style-guide.html documents tokens, type and motion.
  CHECK: python3 demo/apple-tv/verify-library.py
  EXPECT: PASS: 24 categories, 40 variants, 77 specimens; every required state covered.
  EVIDENCE: PASS: 8 sources / 7 unique; 21 control samples; token references and local links resolve. | PASS: 11 app aliases; focus, reduced motion, native disabled states; no unresolved markers. Static verificat

- [x] D4: No unresolved placeholders except intentional gray icon/avatar/poster blocks, no unfinished markers, manual reread finds no remaining improvement in this leaf's implementation scope.
  EVIDENCE: Four-pass record in demo/apple-tv/analysis.md. Static check reports no unresolved markers; node --check library.js passes. Final reread corrected selected-tab semantics and arrow-key behavior, normalized glass to composite #181818, and confirmed native disabled controls. No browser or service started by this leaf; independent visual findings remain under parent review.
