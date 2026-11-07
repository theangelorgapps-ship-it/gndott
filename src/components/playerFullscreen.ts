type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }
export async function enterPlayerFullscreen(container: HTMLElement | null) {
  if (!container || document.fullscreenElement) return
  if (container.requestFullscreen && document.fullscreenEnabled) { await container.requestFullscreen(); return }
  const video = container.querySelector('video') as WebkitVideo | null
  if (video?.webkitEnterFullscreen) { video.webkitEnterFullscreen(); return }
  throw new Error('Full screen is not supported in this browser. The player fills the window.')
}
export async function togglePlayerFullscreen(container: HTMLElement | null) {
  if (document.fullscreenElement) await document.exitFullscreen()
  else await enterPlayerFullscreen(container)
}
