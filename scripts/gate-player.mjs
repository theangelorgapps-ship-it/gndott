#!/usr/bin/env node
// Exercise production bridge/progress logic without a browser, network, or writes.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
function compile(path, imports = {}, globals = {}) {
  const module = { exports: {} }
  const source = readFileSync(resolve(root, path), 'utf8')
  const out = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(out, { module, exports: module.exports, require: (name) => name.endsWith('.css') ? {} : name === './youtubeBridge' ? compile('src/components/youtubeBridge.ts', { './playerBridge': compile('src/components/playerBridge.ts') }) : imports[name] ?? require(name), URL, console, ...globals })
  return module.exports
}
function bridgeGate() {
  const listeners = new Map(), frameListeners = new Map(), messages = []
  const frameWindow = { postMessage: (data, origin) => messages.push({ data: JSON.parse(data), origin }) }
  const window = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name) } }
  const iframe = { src: 'https://iframe.mediadelivery.net/embed/123/one', contentWindow: frameWindow, addEventListener: (name, fn) => frameListeners.set(name, fn), removeEventListener: (name, fn) => { if (frameListeners.get(name) === fn) frameListeners.delete(name) } }
  const production = compile('src/components/playerBridge.ts', {}, { window })
  let ready = 0, played = 0, paused = 0, ended = 0, error = 0, timing = null
  const bridge = production.createPlayerBridge(iframe, { ready: () => ready++, play: () => played++, pause: () => paused++, ended: () => ended++, error: () => error++, timing: (value) => { timing = value } })
  const methods = ['play', 'pause', 'setCurrentTime', 'getDuration', 'getCurrentTime', 'getMuted', 'getPaused', 'getVolume', 'setVolume', 'mute', 'unmute']
  function emit(data, origin = 'https://iframe.mediadelivery.net', source = frameWindow) { listeners.get('message')?.({ origin, source, data: JSON.stringify({ context: 'player.js', ...data }) }) }
  emit({ event: 'ready', value: { methods } }, 'https://attacker.test')
  assert.equal(ready, 0, 'An unrelated origin cannot activate controls')
  emit({ event: 'ready', value: { methods } }, undefined, {})
  assert.equal(ready, 0, 'Another iframe on the same origin cannot activate controls')
  bridge.play()
  assert.equal(messages.filter((item) => item.data.method === 'play').length, 0, 'No playback command before readiness')
  emit({ event: 'ready', value: { methods } })
  assert.equal(ready, 1)
  const subscription = (event) => messages.find((item) => item.data.method === 'addEventListener' && item.data.value === event).data.listener
  emit({ event: 'timeupdate', listener: 'unknown', value: { seconds: 10, duration: 90 } })
  assert.equal(timing, null, 'Unsubscribed timing events are ignored')
  emit({ event: 'timeupdate', listener: subscription('timeupdate'), value: JSON.stringify({ seconds: 10, duration: 90 }) })
  assert.equal(timing.seconds, 10, 'Bunny string timing payload is accepted')
  emit({ event: 'timeupdate', listener: subscription('timeupdate'), value: { seconds: -1, duration: 90 } })
  assert.equal(timing.seconds, 10, 'Invalid timing does not overwrite observed position')
  for (const event of ['play', 'pause', 'ended']) emit({ event, listener: subscription(event) })
  assert.equal(played + paused + ended, 3)
  bridge.seek(-10)
  assert.equal(messages.at(-1).data.value, 0, 'Rewind is bounded at the start')
  const beforeInvalidSeek = messages.length
  bridge.seek(NaN)
  assert.equal(messages.length, beforeInvalidSeek, 'Invalid seek is never sent')
  let total = 0
  bridge.get('getDuration', (value) => { total = value })
  emit({ event: 'getDuration', listener: messages.at(-1).data.listener, value: 90 })
  assert.equal(total, 90)
  bridge.play()
  assert.equal(messages.at(-1).data.method, 'play')
  bridge.volume(.35)
  assert.equal(messages.at(-1).data.method, 'setVolume')
  assert.equal(messages.at(-1).data.value, 35, 'Normalized slider value becomes Bunny percent')
  bridge.volume(2)
  assert.equal(messages.at(-1).data.value, 100)
  bridge.volume(-1)
  assert.equal(messages.at(-1).data.value, 0)
  const volumeCount = messages.length
  bridge.volume(NaN)
  assert.equal(messages.length, volumeCount)
  let volume = 0
  bridge.get('getVolume', value => { volume = value })
  emit({ event: 'getVolume', listener: messages.at(-1).data.listener, value: 35 })
  assert.equal(volume, 35)
  bridge.mute(true)
  assert.equal(messages.at(-1).data.method, 'mute')
  bridge.destroy()
  assert.equal(listeners.size, 0)
  assert.equal(frameListeners.size, 0)
  const count = messages.length
  bridge.play()
  assert.equal(messages.length, count, 'Unmounted bridge cannot send commands')
  assert.equal(production.parsePlayerTiming('bad'), null)
  assert.equal(production.parsePlayerTiming({ seconds: 100, duration: 90 }).seconds, 90)
  assert.equal(error, 0)
  const unsupported = production.createPlayerBridge(iframe, { ready: () => ready++, play() {}, pause() {}, ended() {}, timing() {}, error: () => error++ })
  emit({ event: 'ready', value: { methods: ['play'] } })
  assert.equal(error, 1, 'Missing seek/timing capabilities trigger native fallback')
  assert.equal(ready, 1, 'Unsupported bridge never activates custom controls')
  unsupported.destroy()
  console.log('PLAYER_BRIDGE_OK')
}

function controlsGate() {
  const states = [], refs = []
  let stateIndex = 0, refIndex = 0
  const react = {
    useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
    useRef(initial) { const i = refIndex++; return refs[i] ||= { current: initial } },
    useCallback: fn => fn, useEffect() {},
  }
  const production = compile('src/components/ImmersivePlayer.tsx', {
    react,
    './Detail': { BiblePanel() {}, ContentNotes() {}, youtubeId: () => null },
    './Poster': { img: v => v, plainText: v => v },
    './playerBridge': {}, './directPlayback': {}, '../lib/liveSources': compile('src/lib/liveSources.ts'),
    '../hooks/usePlaybackProgress': { usePlaybackProgress: () => ({ loaded: false, record() {} }) },
    '../hooks/useTypingViewport': { useTypingViewport() {} }, './PlayerLoading': { PlayerLoading() {} },
    './playbackResume': compile('src/components/playbackResume.ts'),
    './playbackEnding': compile('src/components/playbackEnding.ts', {'../lib/contentRoutes': compile('src/lib/contentRoutes.ts')}), './PlaybackEndScreen': { PlaybackEndScreen() {} }, '../release2-experience.css': {},
    './playerCapabilities': compile('src/components/playerCapabilities.ts'),
    './SeekPreview': { SeekPreview() {} }, './TitlePeople': { TitlePeople() {} },
    '../player-chat-refinement.css': {}, './ui/liquid-glass-navbar': { LiquidNavbar() {} }, './ui/choice-picker': { ChoicePicker() {} },
  }, { setTimeout, clearTimeout })
  const render = () => { stateIndex = refIndex = 0; return production.ImmersivePlayer({ title: 'Test', contentId: 1, contentType: 'movie', directVideoUrl: 'https://media.test/test.mp4' }) }
  function find(tree, predicate) {
    if (!tree || typeof tree !== 'object') return null
    if (Array.isArray(tree)) { for (const child of tree) { const result = find(child, predicate); if (result) return result } return null }
    if (predicate(tree)) return tree
    return find(tree.props?.children, predicate)
  }
  let tree = render()
  const media = { currentTime: 10, duration: 100, volume: 1, muted: false }
  const video = find(tree, el => el.type === 'video')
  video.props.ref.current = media
  video.props.onLoadedMetadata({ currentTarget: media })
  tree = render()
  let timeline = find(tree, el => el.props?.['aria-label'] === 'Playback position')
  timeline.props.onPointerDown({ pointerId: 1, currentTarget: { setPointerCapture() {} } })
  timeline.props.onChange({ target: { value: '40' } })
  video.props.onTimeUpdate({ currentTarget: media })
  tree = render()
  timeline = find(tree, el => el.props?.['aria-label'] === 'Playback position')
  assert.equal(timeline.props.value, 40, 'Incoming playback cannot move the thumb during dragging')
  timeline.props.onPointerUp({ currentTarget: { value: '40' } })
  assert.equal(media.currentTime, 40, 'Release seeks the actual video once')
  media.currentTime = 12; video.props.onTimeUpdate({ currentTarget: media })
  tree = render()
  assert.equal(find(tree, el => el.props?.['aria-label'] === 'Playback position').props.value, 40, 'Late pre-seek events cannot snap the thumb back')
  media.currentTime = 40; video.props.onTimeUpdate({ currentTarget: media })
  media.currentTime = 41; video.props.onTimeUpdate({ currentTarget: media })
  tree = render()
  assert.equal(find(tree, el => el.props?.['aria-label'] === 'Playback position').props.value, 41)
  find(tree, el => el.props?.['aria-label'] === 'Volume').props.onChange({ target: { value: '.35' } })
  assert.equal(media.volume, .35, 'The slider writes actual HTMLMediaElement volume')
  tree = render(); find(tree, el => el.props?.['aria-label'] === 'Mute').props.onClick()
  assert.equal(media.muted, true)
  tree = render(); find(tree, el => el.props?.['aria-label'] === 'Unmute').props.onClick()
  assert.equal(media.muted, false); assert.equal(media.volume, .35)
  tree = render(); find(tree, el => el.props?.['aria-label'] === 'Volume').props.onChange({ target: { value: '0' } })
  assert.equal(media.muted, true)
  tree = render(); find(tree, el => el.props?.['aria-label'] === 'Unmute').props.onClick()
  assert.equal(media.volume, .35, 'Unmute from zero restores the last audible volume')
  let tabs = find(render(), el => el.props?.label === 'Player information')
  assert.equal(tabs.props.active, -1, 'Playback begins without an active reading panel')
  tabs.props.onChange(1);tabs=find(render(), el => el.props?.label === 'Player information')
  assert.equal(tabs.props.active, 1);assert.equal(tabs.props.items[3].label, 'Continue Watching')
  assert.ok(find(render(), el => el.props?.['aria-label'] === 'Bible reading'))
  tabs.props.onChange(1);assert.equal(find(render(), el => el.props?.label === 'Player information').props.active,-1,'The active reading tab toggles closed')
  find(render(), el => el.props?.label === 'Player information').props.onChange(0)
  find(render(), el => el.props?.label === 'Player information').props.onChange(3)
  assert.equal(find(render(), el => el.props?.label === 'Player information').props.active,-1,'Continue Watching returns to the video')
  find(render(), el => el.type === 'button' && el.props?.['aria-label'] === 'Playback settings').props.onClick()
  const speed = find(render(), el => el.props?.label === 'Speed')
  speed.props.onChange('1.5');assert.equal(media.playbackRate, 1.5, 'Glass speed picker updates the actual video')
  video.props.onPlay()
  media.currentTime = 98; video.props.onTimeUpdate({ currentTarget: media })
  let endScreen = find(render(), el => typeof el.props?.onReplay === 'function')
  assert.ok(endScreen, 'Actual playback in the closing seconds opens the end screen')
  assert.equal(endScreen.props.ended, false, 'Near-end must not start the next-title countdown')
  video.props.onEnded()
  endScreen = find(render(), el => typeof el.props?.onReplay === 'function')
  assert.equal(endScreen.props.ended, true, 'Only the actual ended event enables next-title countdown')
  endScreen.props.onReplay()
  assert.equal(media.currentTime, 0, 'Replay seeks the actual video to the beginning')
  assert.equal(find(render(), el => typeof el.props?.onReplay === 'function'), null, 'Replay restores the player controls')
  console.log('PLAYER_CONTROLS_OK: drag, stale timing, actual volume, mute restoration, liquid tabs, speed, near-end/ended distinction and replay')
}

function initialPlaybackGate() {
  function harness(options = {}) {
    const states = [], refs = [], effects = [], queue = [], transports = []
    let stateIndex = 0, refIndex = 0, effectIndex = 0, tree, plays = 0, destroyed = 0, providerHandlers
    const progress = { loaded: false, saved: { position: 42, duration: 120 }, record() {} }
    const media = { currentTime: 0, duration: 120, volume: 1, muted: false, addEventListener() {}, removeEventListener() {} }
    const host = { closest() { return null }, contains() { return false } }
    const react = {
      useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
      useRef(initial) { const i = refIndex++; return refs[i] ||= { current: initial } },
      useCallback: fn => fn,
      useEffect(fn, deps) { const i = effectIndex++, old = effects[i]; if (!old || !deps || deps.some((v, j) => !Object.is(v, old.deps[j]))) queue.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() } }) },
    }
    function find(node, predicate) {
      if (!node || typeof node !== 'object') return null
      if (Array.isArray(node)) { for (const child of node) { const found = find(child, predicate); if (found) return found } return null }
      return predicate(node) ? node : find(node.props?.children, predicate)
    }
    const bridge = { play() { plays++ }, get(method, callback) { callback(method === 'getPaused' ? true : method === 'getDuration' ? 120 : 0) }, destroy() { destroyed++ }, seek() {}, supports() { return true } }
    const production = compile('src/components/ImmersivePlayer.tsx', {
      react, './Detail': { BiblePanel() {}, ContentNotes() {}, youtubeId: () => null }, './Poster': { img: v => v, plainText: v => v },
      './directPlayback': { createDirectPlayback(video, url, callbacks) { const transport = { play() { plays++; if (options.blocked) callbacks.blocked(); return Promise.resolve() }, pause() {}, destroy() { destroyed++ } }; transports.push(transport); return transport } },
      './playerBridge': { createPlayerBridge(frame, handlers) { providerHandlers = handlers; return bridge } },
      '../lib/liveSources': compile('src/lib/liveSources.ts'), '../hooks/usePlaybackProgress': { usePlaybackProgress: () => progress },
      '../hooks/useTypingViewport': { useTypingViewport() {} }, './PlayerLoading': { PlayerLoading() {} },
      './playbackResume': compile('src/components/playbackResume.ts'),
    './playbackEnding': compile('src/components/playbackEnding.ts', {'../lib/contentRoutes': compile('src/lib/contentRoutes.ts')}), './PlaybackEndScreen': { PlaybackEndScreen() {} }, '../release2-experience.css': {},
      './playerCapabilities': { createIdleControls: () => ({ reveal() {}, destroy() {} }), createPlaybackWakeLock: () => ({ setPlaying() {}, destroy() {} }), supportsPictureInPicture: () => false, isPictureInPicture: () => false },
      './SeekPreview': { SeekPreview() {} }, './TitlePeople': { TitlePeople() {} }, '../player-chat-refinement.css': {}, './ui/liquid-glass-navbar': { LiquidNavbar() {} }, './ui/choice-picker': { ChoicePicker() {} },
    }, { setTimeout, clearTimeout, navigator: {}, document: { activeElement: null }, window: { addEventListener() {}, removeEventListener() {} }, HTMLElement: class {} })
    function render() {
      stateIndex = refIndex = effectIndex = 0
      tree = production.ImmersivePlayer({ title: 'Test', contentId: 1, contentType: 'movie', viewerId: 1, initialAutoPlay: options.enabled ?? true,
        ...(options.provider ? { bunnyLibraryId: '123', bunnyVideoId: 'abc' } : { directVideoUrl: 'https://media.test/test.mp4' }) })
      tree.props.ref.current = host
      const video = find(tree, el => el.type === 'video'); if (video) video.props.ref.current = media
      const frame = find(tree, el => el.type === 'iframe'); if (frame) frame.props.ref.current = {}
      for (const run of queue.splice(0)) run()
      return tree
    }
    return { render, progress, media, get plays() { return plays }, get destroyed() { return destroyed },
      playButton: () => find(render(), el => el.props?.['aria-label'] === 'Play video'),
      ready() { providerHandlers.ready(bridge) }, confirmPlay() { providerHandlers.play() },
      strictRemount() { effects.forEach(item => item.cleanup?.()); effects.length = 0; render() },
      cleanup() { effects.forEach(item => item.cleanup?.()) }, find }
  }
  const disabled = harness({ enabled: false }); disabled.progress.loaded = true; disabled.render(); assert.equal(disabled.plays, 0, 'Other mount contexts remain idle'); disabled.cleanup()
  const start = harness(); start.render(); assert.equal(start.plays, 0, 'Wait for saved progress before consuming the opening Play intent')
  start.progress.loaded = true; start.render(); assert.equal(start.plays, 1); assert.equal(start.media.currentTime, 42, 'Initial playback retains the saved position')
  start.render(); assert.equal(start.plays, 1, 'Renders do not repeat the initial playback attempt')
  start.strictRemount(); assert.equal(start.plays, 2, 'A recreated Strict Mode transport consumes the intent'); start.cleanup()
  const denied = harness({ blocked: true }); denied.progress.loaded = true; denied.render(); assert.ok(denied.playButton(), 'Policy denial restores the Play button')
  denied.render(); assert.equal(denied.plays, 1, 'Autoplay rejection does not retry automatically')
  denied.playButton().props.onClick(); assert.equal(denied.plays, 2, 'The viewer can retry with an explicit gesture'); denied.cleanup()
  const manual = harness(); manual.render(); manual.playButton().props.onClick(); assert.equal(manual.plays, 1)
  manual.progress.loaded = true; manual.render(); assert.equal(manual.plays, 1, 'Explicit viewer interaction consumes the initial intent'); manual.cleanup()
  const provider = harness({ provider: true }); provider.progress.loaded = true; provider.render(); assert.equal(provider.plays, 0)
  provider.ready(); provider.render(); assert.equal(provider.plays, 1); assert.ok(provider.playButton(), 'An unconfirmed provider autoplay attempt keeps Play available')
  provider.confirmPlay(); assert.equal(provider.playButton(), null); provider.cleanup()
  assert.match(readFileSync(resolve(root, 'src/components/TitleDetail.tsx'), 'utf8'), /<WatchSection[^\n]*\{\.\.\.playback\}[^\n]*initialAutoPlay \/>/, 'Only the user-opened playback dialog opts in')
  console.log('PLAYER_INITIAL_PLAY_OK')
}

async function progressGate(enabled) {
  let now = 100000, reads = 0, release = null, concurrency = 0, maxConcurrency = 0
  const states = [], effects = [], events = new Map(), writes = []
  // Minimal hook scheduler: effects are explicit and persistence requests are
  // controllable promises, letting the test assert ordering under slow requests.
  const react = {
    useState: (initial) => { const index = states.length; states.push(initial); return [initial, (value) => { states[index] = value }] },
    useRef: (value) => ({ current: value }), useCallback: (fn) => fn, useEffect: (fn) => effects.push(fn),
  }
  const api = {
    getPlaybackProgress: async () => { reads++; return { position: 30, duration: 100 } },
    recordWatchProgress: async ({ data }) => { writes.push(data); concurrency++; maxConcurrency = Math.max(maxConcurrency, concurrency); await new Promise((resolve) => { release = resolve }); concurrency--; return { ok: true } },
  }
  const document = { visibilityState: 'visible', addEventListener: (name, fn) => events.set(name, fn), removeEventListener: (name) => events.delete(name) }
  const production = compile('src/hooks/usePlaybackProgress.ts', { react, '../lib/playback': api }, { document, Date: { now: () => now } })
  const hook = production.usePlaybackProgress({ contentType: 'episode', contentId: 20 }, enabled)
  const cleanups = effects.map((fn) => fn())
  const tick = async () => { for (let index = 0; index < 10; index++) await Promise.resolve() }
  await tick()
  assert.equal(writes.length, 0, 'Loading a saved position must never create watch history')
  hook.record(NaN, 100); hook.record(4, 0)
  await tick()
  assert.equal(writes.length, 0)
  hook.record(1, 100)
  await tick()
  if (!enabled) { assert.equal(reads, 0); assert.equal(writes.length, 0); return }
  assert.equal(reads, 1)
  assert.equal(writes.length, 1)
  assert.equal(writes[0].contentId, 20, 'Episode identity reaches the API unchanged')
  hook.record(2, 100); hook.record(3, 100)
  await tick()
  assert.equal(writes.length, 1, 'Time updates within 10 seconds are throttled')
  hook.record(12, 100, true)
  await tick()
  assert.equal(writes.length, 1, 'Pause flush must queue behind an in-flight save')
  release(); await tick()
  assert.equal(writes.length, 2)
  assert.equal(writes[1].position, 12)
  assert.equal(maxConcurrency, 1, 'Older writes cannot finish after a newer write')
  release(); await tick()
  hook.flush(); await tick()
  assert.equal(writes.length, 2, 'Identical saved positions are deduplicated')
  now += 11000
  hook.record(105, 100); await tick()
  assert.equal(writes.at(-1).position, 100, 'Positions are bounded by duration')
  release(); await tick()
  hook.record(80, 100)
  document.visibilityState = 'hidden'; events.get('visibilitychange')(); await tick()
  assert.equal(writes.at(-1).position, 80, 'Backgrounding flushes the latest observed event')
  release(); await tick()
  cleanups.filter(Boolean).forEach((fn) => fn())
  assert.equal(events.size, 0)
}

function resumeGate() {
  let now = 0
  const seeks = [], statuses = []
  const { createResumeController } = compile('src/components/playbackResume.ts')
  const controller = createResumeController({ seek: (position) => seeks.push(position), status: (text) => statuses.push(text), now: () => now })
  controller.restore({ position: 420, duration: 900 })
  assert.equal(seeks.at(-1), 420)
  assert.equal(controller.pending(), true, 'Sending seek does not prove the provider accepted it')
  assert.equal(controller.observe(0, 900, false), false, 'Preload at zero cannot overwrite saved progress')
  controller.onPlay()
  assert.equal(seeks.length, 2, 'Playback start retries a seek rejected during preload')
  now = 1500
  assert.equal(controller.observe(1, 900, true), false)
  assert.equal(seeks.length, 3, 'Real playback events retry while saved target is unconfirmed')
  assert.equal(controller.observe(420, 900, true), true)
  assert.equal(controller.pending(), false, 'Actual media position confirms successful resume')
  assert.equal(statuses.at(-1), '')
  assert.equal(controller.observe(421, 900, true), true, 'Confirmed playback can be persisted')
  const startOver = createResumeController({ seek: (position) => seeks.push(position), status() {}, now: () => now })
  startOver.restore({ position: 420, duration: 900 }); startOver.cancel()
  const count = seeks.length
  startOver.onPlay()
  assert.equal(seeks.length, count, 'Explicit start-over/manual seek cancels automatic resume')
  assert.equal(startOver.observe(0, 900, true), true)
  const completed = createResumeController({ seek: () => assert.fail('Completed titles should start from beginning'), status() {} })
  completed.restore({ position: 895, duration: 900 })
  assert.equal(completed.pending(), false)
  console.log('PLAYER_RESUME_OK')
}

function episodeIntentGate() {
  const setters = []
  const show = compile('src/components/ShowDetail.tsx', {
    react: { useState: (value) => { const index = setters.length; setters.push([]); return [value, (next) => setters[index].push(next)] } },
    './Poster': { img: (value) => value || '/poster.jpg', plainText: (value) => String(value || '') }, './Detail': { hasPlaybackSource: (library, video, trailer) => !!((library && video) || trailer) },
    './TitleDetail': { TitleDetail: () => null, PlaybackDialog: () => null },
    './playbackEnding': compile('src/components/playbackEnding.ts', {'../lib/contentRoutes': compile('src/lib/contentRoutes.ts')}),
  })
  const data = { show: { id: 10, name: 'Show', movie_access: 'paid' }, seasons: [{ id: 1 }, { id: 2 }], episodes: [{ id: 20, season_id: 1, name: 'First', bunny_video_url: 'first' }, { id: 24, season_id: 2, name: 'Saved episode', bunny_video_url: 'saved-source', access: 'paid', myPurchase: true }], bunnyLibraryId: '123', viewerId: 7 }
  const child = show.ShowDetail({ data, kind: 'tvshow' })
  const shell = child.type(child.props)
  shell.props.onPlay(24)
  const selected = setters[3].at(-1)
  assert.equal(selected.contentId, 24)
  assert.equal(selected.bunnyVideoId, 'saved-source')
  assert.equal(selected.myPurchase, true)
  assert.equal(selected.parentGate.contentId, 10)
  assert.equal(setters[2].at(-1), 1, 'Resuming selects the episode’s actual season')
  shell.props.onPlay(999)
  assert.equal(setters[3].length, 1, 'Unavailable episode cannot silently play a different episode')
  assert.match(setters[1].at(-1), /no longer available/)
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]
  const redacted = { id: 28, season_id: 1, name: 'Paid episode', access: 'paid', bunny_video_url: null, video_url_input: null, trailer_url: null }
  for (const [parentPaid, episodePaid] of [[false, true], [true, false], [true, true]]) {
    setters.length = 0
    const fixture = { ...data, show: { ...data.show, movie_access: parentPaid ? 'paid' : 'free' }, episodes: [{ ...redacted, access: episodePaid ? 'paid' : 'free' }] }
    const element = show.ShowDetail({ data: fixture, kind: 'tvshow' })
    const view = element.type(element.props)
    const card = nodes(view).find(node => node.props?.className === 'tv-episode-card')
    assert.equal(card.props.disabled, false, 'Redacted paid episodes still expose the rental action')
    assert.equal(card.props['aria-label'], 'View rental options for Paid episode')
    card.props.onClick()
    assert.equal(setters[3].at(-1).contentId, 28)
    assert.equal(setters[3].at(-1).bunnyVideoId, null, 'The UI never fabricates a protected playback source')
    assert.equal(!!setters[3].at(-1).parentGate, parentPaid)
    view.props.onPlay(28)
    assert.equal(setters[3].at(-1).contentId, 28, 'A resume link can reach the rental gate')
    view.props.onPlay()
    assert.equal(setters[3].at(-1).contentId, 28, 'The first episode rental remains reachable from the hero action')
  }
  setters.length = 0
  const unavailable = show.ShowDetail({ data: { ...data, myPurchase: true, episodes: [{ ...redacted, myPurchase: true }] }, kind: 'tvshow' })
  const unavailableView = unavailable.type(unavailable.props)
  assert.equal(nodes(unavailableView).find(node => node.props?.className === 'tv-episode-card').props.disabled, true, 'An owned episode with no source remains unavailable')
  console.log('PLAYER_EPISODE_INTENT_OK')
}

function videoEntitlementGate() {
  let data = { video: { id: 30, name: 'Paid video', access: 'paid' }, myPurchase: { id: 4 }, viewerId: 7 }
  const route = compile('src/routes/video.$id.tsx', {
    react: { useState: value => [value, () => {}] },
    '@tanstack/react-router': { createFileRoute: () => options => ({ ...options, useLoaderData: () => data }) },
    '../lib/contentRoutes': {}, '../lib/api': {}, '../components/Poster': {}, '../components/Detail': {},
    '../components/TitleDetail': { TitleDetail() {} },
  }).Route
  assert.equal(route.component().props.playback.myPurchase.id, 4, 'The server video entitlement reaches the player gate')
  data = { ...data, myPurchase: null }
  assert.equal(route.component().props.playback.myPurchase, null, 'Missing entitlement remains gated')
  console.log('PLAYER_VIDEO_ENTITLEMENT_OK')
}

async function directPlaybackGate() {
  const { createDirectPlayback } = compile('src/components/directPlayback.ts')
  let imports = 0, plays = 0, destroyed = 0, failures = 0, blocked = 0
  const events = new Map(), operations = [], seenLevels = []
  let instance
  class HlsMock {
    static Events = { MANIFEST_PARSED: 'manifest', ERROR: 'error' }
    static isSupported() { return true }
    constructor() { instance = this; this.levels = [{ height: 720, bitrate: 2000000 }, { height: 1080, bitrate: 4500000 }]; this.currentLevel = -1 }
    on(name, callback) { events.set(name, callback) }
    attachMedia(video) { operations.push(['attach', video]) }
    loadSource(url) { operations.push(['source', url]) }
    destroy() { destroyed++ }
  }
  const video = { src: '', currentTime: 0, canPlayType: () => '', load() { operations.push(['load']) }, play: async () => { plays++ }, pause() { operations.push(['pause']) }, removeAttribute(name) { operations.push(['remove', name]) } }
  const callbacks = { qualities: (levels) => seenLevels.push(levels), failure: () => failures++, blocked: () => blocked++ }
  const load = async () => { imports++; return { default: HlsMock } }
  const controller = createDirectPlayback({ ...video, canPlayType: () => 'probably' }, 'https://media.test/title.m3u8', callbacks, load, false)
  assert.equal(imports, 0, 'HLS must not import or load before playback intent')
  await controller.play()
  assert.equal(imports, 1)
  assert.equal(plays, 1)
  assert.equal(operations[0][0], 'attach')
  assert.equal(operations[1][1], 'https://media.test/title.m3u8', 'The actual supplied media URL is loaded unchanged')
  events.get('manifest')()
  assert.deepEqual(Array.from(seenLevels[0], (level) => level.label), ['720p', '1080p'])
  controller.quality(1)
  assert.equal(instance.currentLevel, 1, 'Manual quality sets the actual HLS level')
  controller.quality(-1)
  assert.equal(instance.currentLevel, -1, 'Auto restores adaptive selection')
  controller.quality(999)
  assert.equal(instance.currentLevel, -1, 'Unknown quality levels are rejected')
  await controller.play()
  assert.equal(imports, 1, 'Repeated Play reuses one controller')
  events.get('error')('error', { fatal: false })
  assert.equal(failures, 0)
  events.get('error')('error', { fatal: true })
  assert.equal(failures, 1, 'Fatal delivery errors invoke the provider fallback')
  controller.destroy()
  assert.equal(destroyed, 1)
  await controller.play()
  assert.equal(plays, 2, 'Disposed player cannot restart')
  const native = { ...video, canPlayType: () => 'probably' }
  const safari = createDirectPlayback(native, 'https://media.test/native.m3u8', callbacks, load, true)
  await safari.play()
  assert.equal(imports, 1, 'Native HLS is preferred without importing hls.js')
  assert.equal(native.src, 'https://media.test/native.m3u8')
  safari.destroy()
  const mp4 = createDirectPlayback(video, 'https://media.test/title.mp4', callbacks, load)
  await mp4.play()
  assert.equal(imports, 1, 'MP4 uses native delivery')
  mp4.destroy()
  const interrupted = createDirectPlayback(video, 'https://media.test/title.m3u8', callbacks, async () => ({ default: class extends HlsMock { static isSupported() { return false } } }))
  await interrupted.play()
  assert.equal(failures, 2, 'Unsupported MSE invokes fallback')
  interrupted.destroy()
  assert.equal(blocked, 0)
  let releaseLoader
  const beforeRace = plays
  const racing = createDirectPlayback(video, 'https://media.test/slow.m3u8', callbacks, () => new Promise(resolve => { releaseLoader = resolve }), false)
  const started = racing.play()
  racing.pause()
  releaseLoader({ default: HlsMock })
  await started
  assert.equal(plays, beforeRace, 'Pausing during HLS initialization cancels the pending play')
  await racing.play()
  assert.equal(plays, beforeRace + 1, 'A later explicit play still works')
  racing.destroy()
  console.log('PLAYER_DIRECT_HLS_OK')
}

async function fullscreenGate() {
  let requested = 0, exited = 0, iosCalls = 0
  const document = { fullscreenEnabled: true, fullscreenElement: null, exitFullscreen: async () => { exited++; document.fullscreenElement = null } }
  const surface = { tagName: 'DIV', requestFullscreen: async () => { requested++; document.fullscreenElement = surface }, querySelector: () => null }
  const { enterPlayerFullscreen, togglePlayerFullscreen } = compile('src/components/playerFullscreen.ts', {}, { document })
  await enterPlayerFullscreen(surface)
  assert.equal(document.fullscreenElement, surface)
  await enterPlayerFullscreen(surface)
  assert.equal(requested, 1, 'Playing inside fullscreen must not toggle it off')
  await togglePlayerFullscreen(surface)
  assert.equal(exited, 1)
  document.fullscreenEnabled = false
  await enterPlayerFullscreen({ querySelector: () => ({ webkitEnterFullscreen: () => iosCalls++ }) })
  assert.equal(iosCalls, 1, 'iOS native video fallback remains available')
  await assert.rejects(() => enterPlayerFullscreen({ querySelector: () => null }), /not supported/)
  const dialogSource = readFileSync(resolve(root, 'src/components/TitleDetail.tsx'), 'utf8')
  assert.ok(dialogSource.includes('enterPlayerFullscreen(surfaceRef.current)'), 'Fullscreen targets the inner DIV; HTMLDialogElement is forbidden by the browser')
  assert.ok(dialogSource.includes('tv-playback-content tv-playback-surface'))
  assert.ok(!dialogSource.includes('togglePlayerFullscreen(dialogRef.current)'))
  console.log('PLAYER_FULLSCREEN_OK')
}

function paidGate() {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
  const detail = compile('src/components/Detail.tsx', {
    './Poster': { img: (value) => value || '/poster.jpg', IconPlay: () => null, IconPlus: () => null },
    './BibleReader': { BibleReader: () => null }, './TitlePeople': { TitlePeople: () => null },
    './LibraryNoteEditor': { LibraryNoteEditor: () => null },
    './ScrollRail': compile('src/components/ScrollRail.tsx'),
    '@/lib/contentRoutes': {contentPath: () => '/'},
    './ImmersivePlayer': { ImmersivePlayer: (props) => React.createElement('div', { 'data-player-id': props.contentId, 'data-player-auto': String(!!props.initialAutoPlay) }) },
    '../lib/api': {}, '@tanstack/react-router': { useRouter: () => ({ navigate() {} }) },
  })
  const props = { contentType: 'episode', contentId: 20, title: 'Episode', viewerId: 1, movieAccess: 'paid', initialAutoPlay: true }
  const render = (data) => renderToStaticMarkup(React.createElement(detail.WatchSection, data))
  assert.ok(!render(props).includes('data-player-id'), 'Unpurchased episode cannot mount a player')
  assert.ok(render({ ...props, myPurchase: true }).includes('data-player-id="20"'), 'Owned episode mounts its own source identity')
  assert.ok(render({ ...props, myPurchase: true }).includes('data-player-auto="true"'), 'The authorised player receives the dialog intent through the purchase gate')
  assert.ok(!render({ ...props, myPurchase: true, parentGate: { contentType: 'tvshow', contentId: 10, title: 'Show', movieAccess: 'paid' } }).includes('data-player-id'), 'Parent purchase is independently required')
  assert.ok(!render({ ...props, parentGate: { contentType: 'tvshow', contentId: 10, title: 'Show', movieAccess: 'paid', myPurchase: true } }).includes('data-player-id'), 'Parent ownership cannot grant episode ownership')
  assert.ok(!render({ ...props, myPurchase: true, hasSubscriptionAccess: false }).includes('data-player-id'), 'PPV ownership cannot bypass a subscription gate')
  assert.ok(render({ ...props, myPurchase: true, hasSubscriptionAccess: false }).includes('Subscription required'), 'Subscription denial explains how to unlock the title')
  assert.ok(!render({ ...props, myPurchase: true, parentGate: { contentType: 'tvshow', contentId: 10, title: 'Show', hasSubscriptionAccess: false } }).includes('data-player-id'), 'Parent subscription access is independently required')
  console.log('PLAYER_PAID_GATE_OK')
}
bridgeGate()
await directPlaybackGate()
await fullscreenGate()
resumeGate()
episodeIntentGate()
videoEntitlementGate()
await progressGate(true)
await progressGate(false)
console.log('PLAYER_PROGRESS_OK')
paidGate()

controlsGate()
initialPlaybackGate()
