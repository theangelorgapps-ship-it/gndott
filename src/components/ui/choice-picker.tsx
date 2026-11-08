import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { MobileLiquidGlass } from './liquid-glass'

export type ChoiceOption = { value: string; label: string; group?: string }

/** A top-layer picker also works inside the full-screen player. On phones we
 * focus the close button, so opening a list never summons the keyboard. */
export function ChoicePicker({ label, value, options, onChange, disabled, className = '', compact = false, displayValue }: {
  label: string; value: string; options: ChoiceOption[]; onChange: (value: string) => void
  disabled?: boolean; className?: string; compact?: boolean; displayValue?: string
}) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find(option => option.value === value)
  const choices = options.filter(option => `${option.label} ${option.group ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  useEffect(() => {
    if (!open || !dialog.current) return
    const element = dialog.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) search.current?.focus({ preventScroll: true })
    else close.current?.focus({ preventScroll: true })
    return () => {
      element.close()
      document.body.style.overflow = overflow
      trigger.current?.focus({ preventScroll: true })
    }
  }, [open])
  return <div className={`choice-picker ${className}`}>
    <MobileLiquidGlass asChild>
      <button ref={trigger} type="button" className={`choice-trigger${compact ? ' choice-compact' : ''}`} disabled={disabled}
        aria-label={`${label}: ${selected?.label ?? value}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
        onClick={() => { setQuery(''); setOpen(true) }}>
        <span>{!compact && <small>{label}</small>}<strong>{displayValue ?? selected?.label ?? value}</strong></span><ChevronDown size={17} aria-hidden="true" />
      </button>
    </MobileLiquidGlass>
    {open && <dialog id={id} ref={dialog} className="choice-sheet" aria-labelledby={`${id}-title`}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); setOpen(false) }}
      onKeyDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) setOpen(false) }}>
      <div className="choice-sheet-inner">
        <header><h2 id={`${id}-title`}>Choose {label.toLowerCase()}</h2><button ref={close} type="button" aria-label={`Close ${label.toLowerCase()} choices`} onClick={() => setOpen(false)}><X size={21} /></button></header>
        <label className="choice-search"><Search size={18} aria-hidden="true" /><input ref={search} type="search" value={query}
          aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}…`} autoComplete="off"
          onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); if (event.key === 'ArrowDown') { event.preventDefault(); list.current?.querySelector('button')?.focus() } }} /></label>
        <div ref={list} className="choice-options" role="group" aria-label={`${label} options`} onKeyDown={event => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const buttons = Array.from(list.current?.querySelectorAll('button') ?? [])
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
          buttons[next]?.focus()
        }}>
          {choices.map((option, index) => <div key={option.value}>
            {option.group && option.group !== choices[index - 1]?.group && <p className="choice-group">{option.group}</p>}
            <button type="button" aria-pressed={value === option.value} onClick={() => { onChange(option.value); setOpen(false) }}><span>{option.label}</span>{value === option.value && <Check size={18} aria-hidden="true" />}</button>
          </div>)}
          {!choices.length && <p role="status">No matches. Try another search.</p>}
        </div>
      </div>
    </dialog>}
  </div>
}
