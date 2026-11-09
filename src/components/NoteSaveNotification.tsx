import { useEffect, useRef } from 'react'
import { CircleCheck, CircleAlert, X } from 'lucide-react'
import './note-save-notification.css'

export type NoteSaveNotice = { kind: 'success' | 'error'; message: string }

/** Native popovers escape player clipping and remain above modal dialogs. */
export function NoteSaveNotification({ notice, onDismiss }: { notice: NoteSaveNotice; onDismiss: () => void }) {
  const card = useRef<HTMLDivElement>(null)
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss
  useEffect(() => {
    const element = card.current
    element?.showPopover?.()
    let timer: ReturnType<typeof setTimeout> | undefined
    const pause = () => clearTimeout(timer)
    const resume = () => {
      pause()
      if (notice.kind === 'success') timer = setTimeout(() => dismiss.current(), 10000)
    }
    resume()
    element?.addEventListener('pointerenter', pause)
    element?.addEventListener('pointerleave', resume)
    element?.addEventListener('focusin', pause)
    element?.addEventListener('focusout', resume)
    return () => {
      pause()
      element?.removeEventListener('pointerenter', pause)
      element?.removeEventListener('pointerleave', resume)
      element?.removeEventListener('focusin', pause)
      element?.removeEventListener('focusout', resume)
      if (element?.hidePopover && element.matches(':popover-open')) element.hidePopover()
    }
  }, [notice])
  const success = notice.kind === 'success'
  const label = success ? 'Note saved' : 'Note could not be saved'
  const Icon = success ? CircleCheck : CircleAlert
  return <div ref={card} popover="manual" className={`note-save-notification is-${notice.kind}`} role={success ? 'status' : 'alert'} aria-label={label} aria-atomic="true"
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onDismiss() } }}>
    <Icon className="note-save-notification-icon" size={23} aria-hidden="true" />
    <div className="note-save-notification-copy"><strong>{label}</strong><p>{notice.message}</p></div>
    <button type="button" aria-label="Dismiss notification" onClick={onDismiss}><X size={18} aria-hidden="true" /></button>
  </div>
}
