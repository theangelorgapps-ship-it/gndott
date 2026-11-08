type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitExitFullscreen?: () => void; webkitDisplayingFullscreen?: boolean; webkitSetPresentationMode?: (mode: 'fullscreen' | 'inline') => void }
export async function enterPlayerFullscreen(container: HTMLElement | null) {
  if (!container || document.fullscreenElement) return
  const video = container.querySelector('video') as WebkitVideo | null
  // iPhone uses the video's native presentation, not Element.requestFullscreen.
  // Keep this call synchronous with the tap to retain user activation.
  if (video?.webkitEnterFullscreen && !document.fullscreenEnabled) { video.webkitEnterFullscreen(); return }
  if (container.requestFullscreen && document.fullscreenEnabled) {
    try { await container.requestFullscreen(); return } catch { /* Try native video below. */ }
  }
  if (video?.webkitEnterFullscreen) { video.webkitEnterFullscreen(); return }
  if (video?.webkitSetPresentationMode) { video.webkitSetPresentationMode('fullscreen'); return }
  throw new Error('Full screen is not supported in this browser. The player fills the window.')
}
export async function togglePlayerFullscreen(container: HTMLElement | null) {
  const video = container?.querySelector('video') as WebkitVideo | null
  if (document.fullscreenElement) await document.exitFullscreen()
  else if (video?.webkitDisplayingFullscreen) video.webkitExitFullscreen?.()
  else await enterPlayerFullscreen(container)
}
