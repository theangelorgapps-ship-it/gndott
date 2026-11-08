# Release 2 Watch icons

Four generated, photorealistic objects replace the earlier illustrated Watch icons. The parent visually approved the source set; the converted files were decoded and inspected again at 128px and the actual 56px menu size on a dark background.

| Menu label | Subject | Direct public asset | Encoded bytes |
| --- | --- | --- | ---: |
| Sermons | Silver microphone resting across an open Bible | `/images/watch-icons/sermons.avif?v=20261108-r2` | 18,382 |
| Teachings | Open leather-bound Bible | `/images/watch-icons/teachings.avif?v=20261108-r2` | 15,201 |
| Shows | Thin black television with a metal stand | `/images/watch-icons/shows.avif?v=20261108-r2` | 6,004 |
| Videos | Brushed silver Play triangle | `/images/watch-icons/videos.avif?v=20261108-r2` | 9,277 |

The complete set is 48,864 bytes. Each file is 256×256, uses AV1 compression inside an AVIF container, and retains transparent, partially transparent and opaque pixels. The files are served directly from `public`, without the image transformation route. The version query refreshes previously cached artwork. Decorative images use empty alternative text because each destination already has a visible text label.

## Source artwork

The generated PNG originals remain outside the repository at:

`/Users/charlesfinney/.codex/generated_images/01a1b374-fa62-7e41-b7ee-b6de19942e55/`

| Asset | Original |
| --- | --- |
| Sermons | `exec-06c0d9af-1717-467d-9683-ccf3fa73b952.png` |
| Teachings | `exec-2862031f-535f-412e-a052-b4681cfcc715.png` |
| Shows | `exec-c3d37b06-312b-4a3e-902e-d202a4b4d696.png` |
| Videos | `exec-f6244eb0-885a-4ddd-92cb-8f56990eee11.png` |

Shared generator direction, as supplied by the parent: premium photorealistic small navigation asset for dark Halobox; transparent alpha; isolated studio cutout; silver, charcoal and ivory materials; approximately 82% canvas fill; recognizable at 56px; no cartoon, toy, cobalt plastic, pedestal or watermark. The subject varies according to the table above. The source files are 1254×1254 RGBA PNGs.

## Conversion and verification

The existing Sharp 0.35.5 installation, libvips 8.18.7 and libheif 1.23.5 were used; no dependency was installed. Conversion preserves alpha without flattening:

```js
await sharp(source)
  .resize(256, 256, { fit: 'contain', background: '#00000000' })
  .avif({ quality: 90, effort: 7, chromaSubsampling: '4:4:4' })
  .toFile(destination)
```

The runnable V1 check in `gates/nov08-release2/visual.md` validates the actual `ftyp`/`avif` file header, AV1 decoder metadata, 256×256 dimensions, and decoded alpha pixel values. It does not infer the format from the filename. Run from the repository root:

```sh
node /Users/charlesfinney/.codex/skills/unlazy/scripts/gate-check.mjs --timeout 60 gates/nov08-release2/visual.md
./node_modules/.bin/tsc --noEmit
```

The decoder gate and TypeScript passed on 2026-11-08. The local decoded contact sheet is `/tmp/halobox-r2-avif-decoded.png`; it contains each asset at 128px and 56px on `#151515`. Browser MIME, cache behavior and responsive layout are final integration checks owned by the parent.

## Four review passes

1. Implementation: converted all four supplied originals, retained the existing public filenames, added a version query, replaced the header Library glyph with a bookmark, and removed the store eyebrow. Scoped CSS restores white Play controls, adds neutral translucent black behind the dock, and tightens the shop header/subnav spacing.
2. Expert review: inspected the decoded assets at actual menu size. The microphone distinguishes Sermons from Teachings; the television silhouette and Play triangle remain recognizable. Kept text labels and decorative image semantics. Store padding reserves the fixed site header once and preserves the 44px order-history target.
3. Defect review: verified actual AV1 rather than a renamed image, preserved transparent alpha, checked root CSS import precedence, and moved reduced-transparency rules after the no-backdrop fallback so the user preference wins. No image-transform route, matte or new package was introduced.
4. Polish review: reviewed the full owned diff, tablet/mobile breakpoints, safe-area spacing, 320px subnav fit and existing focus treatments. No additional source changes were warranted. Live responsive screenshots and computed styles remain with the parent; this review is not claimed as browser verification.
