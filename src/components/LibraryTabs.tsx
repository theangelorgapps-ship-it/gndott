import { useId, type ReactNode } from 'react'
import '../viewing-library.css'

/** Automatic-activation tabs with a single keyboard stop and a labelled panel. */
export function LibraryTabs<T extends string>({ label, tabs, active, onChange, children }: {
  label: string; tabs: { value: T; label: string }[]; active: T; onChange: (value: T) => void; children: ReactNode
}) {
  const id = useId()
  return <><div className="personal-library-tabs" role="tablist" aria-label={label} onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = tabs.findIndex(tab => tab.value === active)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    onChange(tabs[next].value)
    ;(event.currentTarget.querySelectorAll('[role="tab"]')[next] as HTMLElement)?.focus()
  }}>{tabs.map(tab => <button type="button" key={tab.value} id={`${id}-${tab.value}`} role="tab" aria-selected={active === tab.value} aria-controls={`${id}-panel`} tabIndex={active === tab.value ? 0 : -1} onClick={() => onChange(tab.value)}>{tab.label}</button>)}</div>
  <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${active}`} tabIndex={0}>{children}</div></>
}
