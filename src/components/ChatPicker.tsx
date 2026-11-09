import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'

/** A native top-layer popover escapes scrolling panels and fullscreen clipping. */
export function ChatPicker({ anchor, label, className, onClose, children }: {
  anchor: RefObject<HTMLButtonElement | null>
  label: string
  className: string
  onClose: () => void
  children: ReactNode
}) {
  const popup = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useLayoutEffect(() => {
    const element = popup.current
    if (!element) return
    const reposition = () => {
      const trigger = anchor.current?.getBoundingClientRect()
      if (!trigger) return
      const viewport = window.visualViewport
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0
      const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight
      element.style.maxHeight = `${Math.max(44, height - 16)}px`
      element.style.maxWidth = `${Math.max(44, width - 16)}px`
      const bounds = element.getBoundingClientRect()
      element.style.left = `${Math.max(left + 8, Math.min(trigger.right - bounds.width, left + width - bounds.width - 8))}px`
      element.style.top = `${Math.max(top + 8, Math.min(trigger.top - bounds.height - 8, top + height - bounds.height - 8))}px`
    }
    element.showPopover()
    reposition()
    element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    window.visualViewport?.addEventListener('resize', reposition)
    window.visualViewport?.addEventListener('scroll', reposition)
    return () => {
      const restore = element.contains(document.activeElement)
      element.hidePopover()
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
      window.visualViewport?.removeEventListener('resize', reposition)
      window.visualViewport?.removeEventListener('scroll', reposition)
      if (restore) anchor.current?.focus({ preventScroll: true })
    }
  }, [anchor])
  return <div ref={popup} popover="auto" className={`chat-floating-picker ${className}`} role="group" aria-label={label}
    onToggle={event => { if (event.newState === 'closed') close.current() }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current() } }}>
    {children}
  </div>
}
