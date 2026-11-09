# Gates: release 2 visual

- [x] V1: Four professional photorealistic Watch icons (microphone+Bible/Bible/TV/play) served AVIF with correct labels.
  CWD: ../..
  CHECK: node --input-type=module -e 'import sharp from "sharp"; import {readFileSync} from "node:fs"; import assert from "node:assert/strict"; for(const name of ["sermons","teachings","shows","videos"]){const file="public/images/watch-icons/"+name+".avif"; const data=readFileSync(file); const m=await sharp(data).metadata(); const {data:pixels,info}=await sharp(data).ensureAlpha().raw().toBuffer({resolveWithObject:true}); let clear=0,solid=0,edge=0; for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)clear++;else if(pixels[i]===255)solid++;else edge++;} assert.equal(data.toString("ascii",4,8),"ftyp"); assert.equal(data.toString("ascii",8,12),"avif"); assert.equal(m.compression,"av1"); assert.equal(m.hasAlpha,true); assert.equal(info.width,256); assert.equal(info.height,256); assert(clear>0&&solid>0&&edge>0); console.log(name+": AV1 AVIF 256x256 alpha decoded, "+data.length+" bytes");} console.log("PASS: four authentic alpha AVIF icons");'
  EXPECT: PASS: four authentic alpha AVIF icons
  EVIDENCE: automatic-evidence=v1; definition-sha256=d7473464a14798ca87795cdcbd844727d6234fc9047ffdde140830f6e2b2e5b2; exit=0; EXPECT=matched; output-sha256=0ecc7963d7d0e51e78b52e2ec714135235f4473ba15e60c9199d54d024d94c3f; output-bytes=247; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/Codex/Projects/New project/gndott; path=f1160462bf50/25 entries

- [x] V2: Black-white Play, bookmark header Library, translucent black dock backdrop and compact store heading without eyebrow match annotations.
  EVIDENCE: Parent browser verified white Play, bookmark header, open glass shelf and compact shop heading at 430px; screenshots output/playwright/r2-shop-430.png and r2-watch-430-settled.png. No eyebrow remains; cart sits above the dock.

- [x] V3: Phone/tablet/desktop visuals verified, no viewport overflow and no obscured controls.
  EVIDENCE: Parent browser measured document overflow = 0 at 320, 430, 768, 1440 and 3840px. Watch shelf and dock fit the viewport. Inspected r2-home-320.png, r2-home-3840.png and r2-watch-430-settled.png; see docs/qa/nov08-release2.md.

## Leaf review and handoff

All four unlazy passes are documented in `docs/design/release2-icons.md`. The decoded asset contact sheet `/tmp/halobox-r2-avif-decoded.png` was inspected at 128px and 56px: the silver microphone/open Bible, open Bible, television and metal Play triangle are distinct and have clean transparent silhouettes. Total delivery is 48,864 bytes across four 256×256 alpha AVIF files.

No package install, server, watcher, deployment, Git mutation, email or production write was started by the visual leaf. Generated source files outside the repository remain intact. V2/V3 are explicitly retained for parent browser QA, including 320px phone, tablet and desktop, open/closed Watch shelf, `/shop`, white Play computed colors, bookmark appearance and direct asset responses.
