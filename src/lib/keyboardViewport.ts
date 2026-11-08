export type ViewportMetrics = {
  height: number
  offsetTop: number
  scale: number
  baselineHeight: number
  editing: boolean
  compact: boolean
}

/** Zoom and browser chrome changes must not be mistaken for a software keyboard. */
export function typingViewport(metrics: ViewportMetrics) {
  const height = Math.max(1, metrics.height)
  const typing = metrics.editing && metrics.compact && Math.abs(metrics.scale - 1) < .05
  return {
    height,
    top: Math.max(0, metrics.offsetTop),
    typing,
    keyboard: typing && metrics.baselineHeight - height > 120,
  }
}

/** Move only as far as needed; tall selections retain their lower caret edge. */
export function caretScrollDelta(top: number, bottom: number, visibleTop: number, visibleBottom: number) {
  if (bottom > visibleBottom) return bottom - visibleBottom
  if (top < visibleTop) return top - visibleTop
  return 0
}
