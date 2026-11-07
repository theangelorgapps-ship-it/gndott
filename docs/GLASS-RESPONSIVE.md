# Responsive glass refinement

Local preview: http://127.0.0.1:5190/ . To replay the entrance, open http://127.0.0.1:5190/?intro=1 and reload.

The shared `ScrollRail` renders fixed, masked glass edges only where more content is available. It measures scroll position with one animation-frame update and cleans up its listeners/observer. All catalogue and clip rails use it. Recently Uploaded badges are centred and stay on one line.

The mobile dock uses one shared height for its four-item capsule and separate search circle. The optical layer has less blur, translucent tint, displacement and soft reflections. Categories use this same material. Reduced transparency and unsupported-backdrop-filter fallbacks retain readable controls.

The supplied WebGL reveal is integrated as `GlassIconReveal`, with the Halobox logo on black. It is lazy loaded once per browser session, has Skip/Escape, auto dismissal and a six-second deadline. Reduced motion uses the static logo. Rendering is confined to a maximum 620px square and stops offscreen; cleanup releases observers, animation callbacks and GPU resources.

Mobile notes expose Bold, Italic, Highlight, List, Link and More as six large controls. More contains the full existing toolbar. Save/PDF actions remain reachable. Bible selectors fit one row, touch targets are larger, and the player panel scrolls independently. Wide readers use two columns and bounded line lengths.

Above 1800px, navigation, catalogue filters, cards, title heroes and reading controls scale up. At 3840×2160, the sermon grid displays nine columns; the Bible reader is capped at 1600px. Search is capped at 2600px.

## Verification

- Browser checks at 320×800, 391×844 and 3840×2160 CSS pixels: no page overflow; matching dock/search geometry; single-line badges; category navigation; compact editor and restored formatting after typing/undo; Bible chapter change and desktop two-column reading.
- Opener Skip and automatic removal verified. Reduced-motion and no-WebGL fallback reviewed in source; physical iPhone/TV performance was not measured.
- TypeScript, production build, library isolation/sanitization, mocked billing/AVIF handling, readable routes, player bridge/HLS/fullscreen/resume/access gates and 18 recommendation fixtures pass via `scripts/gate-glass-responsive.mjs`.
- Production build still reports existing large lazy chunks for the editor, HLS and PDF dependencies; the new reveal is a separate lazy chunk.
- This pass changes presentation and the opener. Live Bunny media delivery was not certified by these UI checks; player contracts were regression tested with mocks.

Evidence: `gates/glass-responsive/GATES.md`, `verification/glass-build.log`, `verification/glass-mobile-badges.jpg`, `verification/glass-mobile-preview.jpg`, and `verification/glass-categories.jpg`.

The local dev server is retained for review. No deployment, commit or push was performed.
