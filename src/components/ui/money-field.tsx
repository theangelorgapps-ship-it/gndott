import { forwardRef, useCallback, useId, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

// Money amount field, ported from the Arc MoneyInput design and trimmed to
// HaloBox giving: USD only, quick-add chips, grouped digits while typing,
// arrow-key stepping, and clear min/max feedback. Value is in cents.

export interface MoneyFieldProps {
  label: string
  value: number | null            // cents; null = empty
  onValueChange: (cents: number | null) => void
  min?: number                    // cents
  max?: number                    // cents
  quickAdd?: number[]             // dollars
  description?: string
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

function toDisplay(cents: number | null): { whole: string; fraction: string } {
  if (cents === null) return { whole: '', fraction: '' }
  const text = String(Math.max(0, Math.round(cents))).padStart(3, '0')
  return { whole: group(text.slice(0, -2)), fraction: text.slice(-2) }
}

export const MoneyField = forwardRef<HTMLInputElement, MoneyFieldProps>(function MoneyField(
  { label, value, onValueChange, min = 100, max = 100000000, quickAdd = [10, 25, 50, 100], description },
  forwardedRef,
) {
  const reduced = useReducedMotion()
  const uid = useId()
  const inputId = `${uid}-amount`
  const messageId = `${uid}-message`
  const [focused, setFocused] = useState(false)
  const [touched, setTouched] = useState(false)
  const [draft, setDraft] = useState<string | null>(null) // raw text while editing
  const [flash, setFlash] = useState('')
  const flashTimer = useRef<number | undefined>(undefined)

  const display = toDisplay(value)
  const raw = draft ?? (value === null ? '' : `${display.whole}.${display.fraction}`)

  const parse = (text: string): number | null => {
    const clean = text.replace(/[^0-9.]/g, '')
    if (!clean) return null
    const [w, f] = clean.split('.')
    const cents = Number((w || '0')) * 100 + Number((f ?? '').padEnd(2, '0').slice(0, 2) || '0')
    return Number.isSafeInteger(cents) ? cents : null
  }

  const announceLimit = useCallback((message: string) => {
    setFlash(message)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(''), 1600)
  }, [])

  function change(text: string) {
    const cents = parse(text)
    if (cents !== null && cents > max) { announceLimit(`The maximum is ${usd.format(max / 100)}`); return }
    setDraft(text)
    onValueChange(cents)
  }

  function nudge(dollars: number) {
    const next = (value ?? 0) + dollars * 100
    if (next > max) { onValueChange(max); setDraft(String(max / 100)); announceLimit(`The maximum is ${usd.format(max / 100)}`); return }
    onValueChange(next)
    if (focused) setDraft(String(next / 100))
  }

  const belowMin = touched && !focused && value !== null && value < min
  const message = flash || (belowMin ? `The minimum is ${usd.format(min / 100)}` : '')

  return (
    <div className="money-field">
      <label htmlFor={inputId} className="money-label">{label}</label>
      <div className={`money-control${focused ? ' focused' : ''}${message ? ' invalid' : ''}`}>
        <span className="money-symbol" aria-hidden="true">$</span>
        <input
          ref={forwardedRef}
          id={inputId}
          type="text"
          role="spinbutton"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0.00"
          value={raw}
          aria-invalid={!!message || undefined}
          aria-describedby={message || description ? messageId : undefined}
          aria-valuenow={value === null ? undefined : value / 100}
          aria-valuemin={min / 100}
          aria-valuemax={max / 100}
          onChange={event => change(event.target.value)}
          onFocus={() => { setFocused(true); setDraft(value === null ? '' : String(value / 100)) }}
          onBlur={() => { setFocused(false); setTouched(true); setDraft(null) }}
          onKeyDown={event => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault()
              nudge((event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 10 : 1))
            }
          }}
        />
        <span className="money-code">USD</span>
      </div>
      {quickAdd.length > 0 && (
        <div className="money-chips" role="group" aria-label="Quick add">
          {quickAdd.map(amount => (
            <button key={amount} type="button" className="money-chip" onClick={() => nudge(amount)} aria-label={`Add ${usd.format(amount)}`}>
              +${amount}
            </button>
          ))}
        </div>
      )}
      <AnimatePresence initial={false}>
        {(message || description) && (
          <motion.span
            id={messageId}
            className={message ? 'money-message' : 'money-hint'}
            role={message ? 'alert' : undefined}
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            {message || description}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
})
