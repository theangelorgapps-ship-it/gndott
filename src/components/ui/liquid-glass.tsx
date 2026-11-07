/** Adapted from the supplied layered glass reference. Decoration never catches input. */
export function LiquidGlassLayers() {
  return <span className="liquid-glass-layers" aria-hidden="true"><span className="liquid-glass-refraction" /><span className="liquid-glass-tint" /><span className="liquid-glass-light" /></span>
}

export function LiquidGlassFilter() {
  return <svg className="liquid-glass-filter" width="0" height="0" aria-hidden="true" focusable="false"><defs>
    <filter id="streamit-glass-distortion" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.001 0.005" numOctaves="1" seed="17" result="texture" />
      <feGaussianBlur in="texture" stdDeviation="3" result="softTexture" />
      <feDisplacementMap in="SourceGraphic" in2="softTexture" scale="18" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs></svg>
}
