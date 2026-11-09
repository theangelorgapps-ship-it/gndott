import { useEffect, type RefObject } from 'react'
import { caretScrollDelta, typingViewport } from '../lib/keyboardViewport'

type CaretBounds = { top: number; bottom: number }
const caretReaders = new WeakMap<HTMLElement, () => CaretBounds>()

/** Editor-native coordinates cover blank paragraphs, wrapped text and reverse selections. */
export function registerTypingCaret(element: HTMLElement, read: () => CaretBounds) {
  caretReaders.set(element, read)
  return () => { caretReaders.delete(element) }
}

export function notifyTypingCaret(element: HTMLElement) {
  element.dispatchEvent(new Event('gndott:caret-update', { bubbles: true }))
}

function textEntry(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && !element.matches(':disabled, [readonly]') &&
    (element.isContentEditable || element.matches('textarea, input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], input[type="number"]'))
}

function caretRect(active: HTMLElement) {
  const read = caretReaders.get(active)
  if (read) {
    try { const rect = read(); if (Number.isFinite(rect.top) && rect.bottom > rect.top) return rect } catch { /* Selection may be changing during composition. */ }
  }
  const selection = window.getSelection()
  if (active.isContentEditable && selection?.rangeCount && active.contains(selection.focusNode)) {
    const range = selection.getRangeAt(0).cloneRange()
    range.setStart(selection.focusNode!, selection.focusOffset)
    range.collapse(true)
    const rect = range.getClientRects?.()[0] || range.getBoundingClientRect()
    if (rect.height) return rect
    // Empty contenteditable lines can have no range rect at all.
    const node = selection.focusNode?.nodeType === 1 ? selection.focusNode as HTMLElement : selection.focusNode?.parentElement
    if (node && active.contains(node)) {
      const bounds = node.getBoundingClientRect()
      const height = parseFloat(getComputedStyle(node).lineHeight) || 24
      return { top: bounds.top, bottom: bounds.top + height }
    }
  }
  return active.getBoundingClientRect()
}

/** Scroll the caret inside its editor/panel, leaving the video and page in place. */
export function revealTypingCaret(root: HTMLElement) {
  const active = document.activeElement
  if (!textEntry(active) || !root.contains(active)) return
  const viewport = window.visualViewport
  const top = (viewport?.offsetTop ?? 0) + 10
  const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 10
  // Native textareas already scroll their own caret; only move their containers.
  for (let parent: HTMLElement | null = active.isContentEditable ? active : active.parentElement; parent && root.contains(parent); parent = parent.parentElement) {
    if (parent.scrollHeight <= parent.clientHeight || !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) continue
    const bounds = parent.getBoundingClientRect()
    const caret = caretRect(active)
    const delta = caretScrollDelta(caret.top, caret.bottom, Math.max(top, bounds.top + 8), Math.min(bottom, bounds.bottom - 8))
    if (delta) parent.scrollTop += delta
  }
  // Standalone Notes/chat can be in a normal page rather than the player dialog.
  if (!root.closest('dialog, .tv-immersive-player') && getComputedStyle(root).position !== 'fixed') {
    const caret = caretRect(active)
    const delta = caretScrollDelta(caret.top, caret.bottom, top, bottom)
    if (delta) window.scrollBy({ top: delta, behavior: 'instant' })
  }
}

/** Compact devices enter focus layout immediately; pinch zoom stays browser-owned. */
export function observeTypingViewport(root: HTMLElement) {
  // The player owns nested Notes/chat, so its geometry has one viewport listener.
  if (root.parentElement?.closest('.tv-immersive-player')) return () => {}
  const viewport = window.visualViewport
  const compact = window.matchMedia('(max-width: 759px), (pointer: coarse)')
  let baselineHeight = Math.max(window.innerHeight, viewport?.height ?? 0)
  let width = window.innerWidth
  let frame = 0, caretFrame = 0
  const update = () => {
    frame = 0
    const active = document.activeElement
    const editing = textEntry(active) && root.contains(active)
    if (Math.abs(window.innerWidth - width) > 100) {
      // The old width is the new unoccluded height after a phone rotation,
      // including browsers that resize both layout and visual viewports.
      baselineHeight = Math.max(window.innerHeight, viewport?.height ?? 0, width)
      width = window.innerWidth
    }
    if (!editing) baselineHeight = Math.max(baselineHeight, window.innerHeight, viewport?.height ?? 0)
    const state = typingViewport({ height: viewport?.height ?? window.innerHeight, offsetTop: viewport?.offsetTop ?? 0, scale: viewport?.scale ?? 1, baselineHeight, editing, compact: compact.matches })
    root.style.setProperty('--typing-viewport-height', `${state.height}px`)
    root.style.setProperty('--typing-viewport-top', `${state.top}px`)
    root.toggleAttribute('data-typing-active', state.typing)
    root.toggleAttribute('data-keyboard-open', state.keyboard)
    root.toggleAttribute('data-typing-short', state.typing && state.height < 310)
    if (state.typing) {
      cancelAnimationFrame(caretFrame)
      caretFrame = requestAnimationFrame(() => { caretFrame = 0; revealTypingCaret(root) })
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
  const editorEvents = ['focusin', 'focusout', 'input', 'keyup', 'compositionend', 'gndott:caret-update']
  for (const event of editorEvents) root.addEventListener(event, schedule)
  document.addEventListener('selectionchange', schedule)
  window.addEventListener('resize', schedule)
  viewport?.addEventListener('resize', schedule)
  viewport?.addEventListener('scroll', schedule)
  compact.addEventListener('change', schedule)
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
  resize?.observe(root)
  schedule()
  return () => {
    cancelAnimationFrame(frame); cancelAnimationFrame(caretFrame)
    for (const event of editorEvents) root.removeEventListener(event, schedule)
    document.removeEventListener('selectionchange', schedule)
    window.removeEventListener('resize', schedule)
    viewport?.removeEventListener('resize', schedule)
    viewport?.removeEventListener('scroll', schedule)
    compact.removeEventListener('change', schedule)
    resize?.disconnect()
    root.removeAttribute('data-typing-active'); root.removeAttribute('data-keyboard-open')
    root.removeAttribute('data-typing-short')
    root.style.removeProperty('--typing-viewport-height'); root.style.removeProperty('--typing-viewport-top')
  }
}

export function useTypingViewport(ref: RefObject<HTMLElement | null>) {
  useEffect(() => ref.current ? observeTypingViewport(ref.current) : undefined, [ref])
}
