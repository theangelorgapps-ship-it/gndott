/** Bunny Stream's documented Player.js protocol, with source/origin validation
 * and cleanup (the hosted legacy Player.js build has no destroy method).
 * https://bunny.net/blog/introducing-player-js-support-for-bunny-stream-advanced-player-control-and-monitoring-api/
 * https://github.com/embedly/player.js/blob/master/SPEC.rst
 */
export type PlayerTiming = { seconds: number; duration: number }
export type PlayerBridge = {
  play: () => void
  pause: () => void
  seek: (seconds: number) => void
  mute: (muted: boolean) => void
  volume: (level: number) => void
  get: (method: 'getDuration' | 'getCurrentTime' | 'getPaused' | 'getMuted' | 'getVolume', callback: (value: unknown) => void) => void
  supports: (method: string) => boolean
  destroy: () => void
}
export function parsePlayerTiming(value: unknown): PlayerTiming | null {
  try {
    const data = typeof value === 'string' ? JSON.parse(value) : value
    const seconds = Number((data as PlayerTiming)?.seconds)
    const duration = Number((data as PlayerTiming)?.duration)
    return Number.isFinite(seconds) && Number.isFinite(duration) && seconds >= 0 && duration > 0 ? { seconds: Math.min(seconds, duration), duration } : null
  } catch { return null }
}
export function createPlayerBridge(iframe: HTMLIFrameElement, handlers: {
  ready: (bridge: PlayerBridge) => void
  play: () => void
  pause: () => void
  ended: () => void
  timing: (timing: PlayerTiming) => void
  error: () => void
}): PlayerBridge {
  const origin = new URL(iframe.src).origin
  const subscriptions = new Map<string, string>()
  const callbacks = new Map<string, (value: unknown) => void>()
  let methods = new Set<string>()
  let ready = false
  let active = true
  let sequence = 0
  const id = () => `gndott-${Date.now()}-${++sequence}`
  const send = (method: string, value?: unknown, listener?: string) => {
    if (!active) return
    iframe.contentWindow?.postMessage(JSON.stringify({ context: 'player.js', version: '0.0.11', method, ...(value === undefined ? {} : { value }), ...(listener ? { listener } : {}) }), origin)
  }
  const subscribe = (event: string) => { const listener = id(); subscriptions.set(event, listener); send('addEventListener', event, listener) }
  const bridge: PlayerBridge = {
    play: () => { if (ready && methods.has('play')) send('play') },
    pause: () => { if (ready && methods.has('pause')) send('pause') },
    seek: (seconds) => { if (ready && methods.has('setCurrentTime') && Number.isFinite(seconds)) send('setCurrentTime', Math.max(0, seconds)) },
    mute: (muted) => { const method = muted ? 'mute' : 'unmute'; if (ready && methods.has(method)) send(method) },
    volume: (level) => { if (ready && methods.has('setVolume') && Number.isFinite(level)) send('setVolume', Math.round(Math.max(0, Math.min(1, level)) * 100)) },
    get: (method, callback) => { if (!ready || !methods.has(method)) return; const listener = id(); callbacks.set(listener, callback); send(method, undefined, listener) },
    supports: (method) => methods.has(method),
    destroy: () => {
      for (const [event, listener] of subscriptions) send('removeEventListener', event, listener)
      active = false
      window.removeEventListener('message', receive)
      iframe.removeEventListener('load', handshake)
      callbacks.clear()
      subscriptions.clear()
    },
  }
  function receive(event: MessageEvent) {
    if (!active || event.origin !== origin || event.source !== iframe.contentWindow) return
    let data: { context?: string; event?: string; listener?: string; value?: any }
    try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data } catch { return }
    if (!data || data.context !== 'player.js') return
    if (data.event === 'ready' && !ready) {
      methods = new Set(Array.isArray(data.value?.methods) ? data.value.methods : [])
      if (!['play', 'pause', 'setCurrentTime', 'getDuration', 'getCurrentTime'].every((method) => methods.has(method))) { handlers.error(); return }
      ready = true
      for (const name of ['play', 'pause', 'ended', 'timeupdate', 'error', 'seeked']) subscribe(name)
      handlers.ready(bridge)
      return
    }
    if (data.listener && callbacks.has(data.listener)) { callbacks.get(data.listener)?.(data.value); callbacks.delete(data.listener); return }
    if (!ready || subscriptions.get(data.event ?? '') !== data.listener) return
    if (data.event === 'timeupdate') { const timing = parsePlayerTiming(data.value); if (timing) handlers.timing(timing) }
    else if (data.event === 'play') handlers.play()
    else if (data.event === 'pause') handlers.pause()
    else if (data.event === 'ended') handlers.ended()
    else if (data.event === 'error') handlers.error()
    else if (data.event === 'seeked') bridge.get('getCurrentTime', (seconds) => bridge.get('getDuration', (duration) => { const timing = parsePlayerTiming({ seconds, duration }); if (timing) handlers.timing(timing) }))
  }
  function handshake() { if (!ready) subscribe('ready') }
  window.addEventListener('message', receive)
  iframe.addEventListener('load', handshake)
  handshake()
  return bridge
}
