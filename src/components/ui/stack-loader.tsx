// HaloBox preloader — stack-to-spread intro.
// Adapted from Hyperiux Vault stack-loader: square art -> landscape thumbnails
// served from our own /media directory, HaloBox copy, session-guarded so it
// only plays once per visit and never slows repeat navigation.

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/dist/SplitText'

gsap.registerPlugin(SplitText)

const INTRO_EASE = 'cubic-bezier(0.25,1,0.5,1)'
const IMAGE_ENTRY_Y_PERCENT = 500
const TEXT_ROTATE_X_START = 90
const TEXT_TRANSFORM_PERSPECTIVE = 1000
const IMAGE_Z_INDEX_DURATION = 0.1
const IMAGE_Z_INDEX_STAGGER = 0.2
const TEXT_STAGGER = 0.08
const STACK_SCALE_STEP = 0.15
const STACK_Y_PERCENT_STEP = 20
const SPREAD_Y_PERCENT_STEP = 110
const IMAGE_FADE_STAGGER = 0.08

/** Landscape thumbnails (1200×675) from our own media directory. Absolute URLs
 *  so they load in local dev too; same-origin in production. */
const STACK_IMAGE_SOURCES = [
  'https://halobox.tv/media/legacy-20261105/f9b541ed40e1fde7d3f11a5fbc77167378ac045d8fba61bd19fd9a52cb50a284.jpg',
  'https://halobox.tv/media/legacy-20261105/f2b8f4a8cbf0980675e4378b0673ed0dc86d705658734055ee859df613d89dc3.png',
  'https://halobox.tv/media/legacy-20261105/f1d9bf714cfed20ab48c1694041bb26870298e405cc67f532f505e71e9c2ea94.png',
  'https://halobox.tv/media/legacy-20261105/eb4208619c2e65ef6e71383b5886d8236ecceb31a2d70d84831c82e71f338c36.jpg',
  'https://halobox.tv/media/legacy-20261105/e850692a46e766225a3354c4a5e3dc9bb345579878a717977b23cd395ca10bc0.jpg',
  'https://halobox.tv/media/legacy-20261105/e44fa7a87bcd3b972d16353fce3dd579ba0e0c7904b0dea8655c7e0cbc172280.png',
  'https://halobox.tv/media/legacy-20261105/de4649e6ae6f9717a13ea5049db210261cda61e5f658ef331c12efa9e6dd614b.jpg',
]

const INTRO_DURATION = 1
const FADE_OUT_DURATION = 0.8

export function StackLoaderIntro({ onComplete }: { onComplete?: () => void }) {
  const uid = useId().replace(/:/g, '')
  const imgsWrapperId = `loader-imgs-${uid}`
  const rootRef = useRef<HTMLElement | null>(null)
  const imagesRef = useRef<(HTMLDivElement | null)[]>([])
  const text1Ref = useRef<HTMLParagraphElement | null>(null)
  const text2Ref = useRef<HTMLParagraphElement | null>(null)
  const descriptionTextRef = useRef<HTMLParagraphElement | null>(null)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useLayoutEffect(() => {
    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false

    // Reduced-motion: images already in a vertical line — smooth opacity only.
    if (reduceMotion) {
      const ctx = gsap.context(() => {
        const imageElements = imagesRef.current.filter(Boolean)
        const sideText = [text1Ref.current, text2Ref.current].filter(Boolean)
        const description = descriptionTextRef.current
        const totalImages = imageElements.length
        const totalSpread =
          totalImages > 1 ? SPREAD_Y_PERCENT_STEP * (totalImages - 1) : 0

        gsap.set(`#${imgsWrapperId}`, { yPercent: 0, opacity: 1 })
        gsap.set(imageElements, {
          opacity: 0,
          scale: 1,
          zIndex: (index: number) => index,
          yPercent: (index: number) =>
            totalImages === 1
              ? 0
              : -totalSpread / 2 + index * SPREAD_Y_PERCENT_STEP,
        })
        gsap.set(sideText, { opacity: 0, rotateX: 0 })
        if (description) gsap.set(description, { opacity: 0, rotateX: 0 })

        const tl = gsap.timeline({
          defaults: { ease: 'power2.inOut' },
          onComplete: () => {
            gsap.set(rootRef.current, { display: 'none' })
            onCompleteRef.current?.()
          },
        })
        tl.timeScale(1 / INTRO_DURATION)

        tl.to(imageElements, {
          opacity: 1,
          duration: 0.7,
          stagger: { each: 0.06, from: 'center' },
        })

        tl.to(sideText, { opacity: 1, duration: 0.55 }, '-=0.35')
        if (description) {
          tl.to(description, { opacity: 1, duration: 0.55 }, '<')
        }

        tl.to(
          [...sideText, description].filter(Boolean),
          { opacity: 0, duration: 0.5 },
          '+=0.55',
        )
        tl.to(
          imageElements,
          {
            opacity: 0,
            duration: FADE_OUT_DURATION,
            stagger: { each: 0.04, from: 'edges' },
          },
          '-=0.15',
        )
        tl.to(
          rootRef.current,
          { opacity: 0, duration: FADE_OUT_DURATION },
          '-=0.2',
        )
      }, rootRef)

      return () => ctx.revert()
    }

    const ctx = gsap.context(() => {
      const imageElements = imagesRef.current.filter(Boolean)

      const text1 = SplitText.create(text1Ref.current, { type: 'words' })
      const text2 = SplitText.create(text2Ref.current, { type: 'words' })
      const descriptionText = SplitText.create(descriptionTextRef.current, {
        type: 'words,lines',
      })

      const animatedTextTargets = [
        text1.words,
        text2.words,
        descriptionText.lines,
      ]

      gsap.set(animatedTextTargets, {
        rotateX: TEXT_ROTATE_X_START,
        opacity: 0,
        transformPerspective: TEXT_TRANSFORM_PERSPECTIVE,
        transformOrigin: '50% 100%',
        willChange: 'transform',
      })

      gsap.set(imageElements, { opacity: 0 })
      gsap.set(descriptionTextRef.current, { opacity: 1 })

      const tl = gsap.timeline()
      tl.timeScale(1 / INTRO_DURATION)

      tl.fromTo(
        `#${imgsWrapperId}`,
        { yPercent: IMAGE_ENTRY_Y_PERCENT, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.5, ease: INTRO_EASE },
      )

      tl.set([text1Ref.current, text2Ref.current], { opacity: 1 }, '<')

      tl.to(
        imageElements,
        { opacity: 1, duration: 0.5, ease: INTRO_EASE },
        '<',
      )

      tl.to(
        animatedTextTargets,
        {
          rotateX: 0,
          opacity: 1,
          stagger: TEXT_STAGGER,
          ease: INTRO_EASE,
        },
        '<+0.5',
      )

      imageElements.forEach((imageElement, index) => {
        tl.to(
          imageElement,
          { zIndex: index, duration: IMAGE_Z_INDEX_DURATION, ease: INTRO_EASE },
          index * IMAGE_Z_INDEX_STAGGER,
        )
      })

      tl.to(
        imageElements,
        {
          scale: (index: number) => 1 + index * STACK_SCALE_STEP,
          yPercent: (index: number) => -(index * STACK_Y_PERCENT_STEP),
          duration: 1,
          stagger: { each: 0.01, from: 'end' },
          ease: 'power3.inOut',
        },
        '<',
      )

      tl.to(
        imageElements,
        {
          scale: 1,
          yPercent: (index: number, _target: unknown, elements: unknown[]) => {
            const totalImages = elements.length
            if (totalImages === 1) return 0
            const totalSpread = SPREAD_Y_PERCENT_STEP * (totalImages - 1)
            return -totalSpread / 2 + index * SPREAD_Y_PERCENT_STEP
          },
          duration: 1,
          stagger: { each: 0.01, from: 'end' },
          ease: 'power3.inOut',
        },
        '+=0.2',
      )

      tl.to(
        descriptionText.lines,
        {
          rotateX: TEXT_ROTATE_X_START,
          transformOrigin: 'top center',
          opacity: 0,
          duration: 1,
          stagger: TEXT_STAGGER,
          ease: INTRO_EASE,
        },
        '<-0.1',
      )

      tl.to(`#${imgsWrapperId}`, { yPercent: 0, ease: INTRO_EASE }, '<')

      tl.to([text1.words, text2.words], {
        opacity: 0,
        duration: 0.5,
        rotateX: TEXT_ROTATE_X_START,
        transformOrigin: 'top center',
        stagger: TEXT_STAGGER,
        ease: INTRO_EASE,
      })

      tl.to(
        imageElements,
        {
          opacity: 0,
          duration: FADE_OUT_DURATION,
          stagger: { each: IMAGE_FADE_STAGGER, from: 'end' },
          onComplete: () => {
            gsap.to(rootRef.current, {
              opacity: 0,
              duration: FADE_OUT_DURATION,
              ease: INTRO_EASE,
              onComplete: () => {
                gsap.set(rootRef.current, { display: 'none' })
                onCompleteRef.current?.()
              },
            })
          },
        },
        '<+0.2',
      )

      return () => {
        text1.revert()
        text2.revert()
        descriptionText.revert()
      }
    }, rootRef)

    return () => ctx.revert()
  }, [imgsWrapperId])

  return (
    <section
      ref={rootRef}
      aria-hidden="true"
      className="fixed inset-0 z-[999] flex h-screen w-full items-center justify-center bg-black px-[2.5vw] text-white max-[1025px]:px-[5vw] max-md:px-[6vw]"
    >
      <div className="flex w-full items-center justify-between max-[1025px]:flex-col max-[1025px]:justify-center max-[1025px]:gap-[33vh] max-md:gap-[70vw]">
        <p ref={text1Ref} className="text-[1.6vw] font-semibold uppercase tracking-[0.25em] opacity-0 max-[1025px]:text-[2.8vw] max-md:text-[5vw]">
          GoodNews
        </p>

        <div
          id={imgsWrapperId}
          className="relative aspect-video max-[1025px]:z-99"
          style={{ width: 'clamp(9rem, 16vw, 24rem)' }}
        >
          {STACK_IMAGE_SOURCES.map((src, index) => (
            <div
              key={src}
              ref={(element) => {
                imagesRef.current[index] = element
              }}
              className="absolute top-0 left-0 size-full overflow-hidden rounded-md opacity-0"
            >
              <img
                src={src}
                width={480}
                height={270}
                className="h-full w-full object-cover"
                alt=""
                decoding="async"
                fetchPriority={index === 0 ? 'high' : 'auto'}
              />
            </div>
          ))}
        </div>

        <p ref={text2Ref} className="text-[1.6vw] font-semibold uppercase tracking-[0.25em] opacity-0 max-[1025px]:text-[2.8vw] max-md:text-[4vw]">
          Halobox
        </p>
      </div>

      <p
        ref={descriptionTextRef}
        className="absolute bottom-[3vw] left-1/2 w-[40vw] -translate-x-1/2 text-center text-[1.2vw] leading-[1.2] tracking-[0.08em] text-white/70 opacity-0 max-[1025px]:bottom-[3vw] max-[1025px]:w-[68vw] max-[1025px]:text-[2.4vw] max-md:bottom-[6vw] max-md:w-[90%] max-md:text-[3.5vw]"
      >
        Sermons, Shows &amp; Teachings — with Prophet Uebert Angel
      </p>
    </section>
  )
}

const INTRO_SEEN_KEY = 'hb-intro-seen-v1'

/** Session-guarded preloader: plays once per browser session, then never again. */
export function SitePreloader() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(INTRO_SEEN_KEY)) setShow(true)
    } catch {
      // storage unavailable — skip the intro rather than risk replay loops
    }
  }, [])

  const handleComplete = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, '1')
    } catch {
      // ignore
    }
    setShow(false)
  }, [])

  if (!show) return null
  return <StackLoaderIntro onComplete={handleComplete} />
}
