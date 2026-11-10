import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, ChevronLeft, HandHeart, ShieldCheck } from 'lucide-react'
import { createGivingCheckout, getGivingStatus, GIVING_KINDS, type GivingKind } from '../lib/giving'
import '../giving.css'

const KIND_COPY: Record<GivingKind, { label: string; hint: string }> = {
  offering: { label: 'Offering', hint: 'A free-will offering' },
  tithe: { label: 'Tithe', hint: 'A tenth, honouring God' },
  partner: { label: 'Partner', hint: 'Partner with the ministry' },
  seed: { label: 'Seed', hint: 'Sow a seed of faith' },
}

const PRESETS = [10, 25, 50, 100, 250]

const COUNTRIES = [
  'United Kingdom', 'United States', 'Nigeria', 'South Africa', 'Kenya', 'Ghana', 'Zimbabwe', 'Zambia', 'Uganda', 'Tanzania',
  'Canada', 'Australia', 'New Zealand', 'Ireland', 'Germany', 'France', 'Netherlands', 'Spain', 'Italy', 'Sweden',
  'Norway', 'United Arab Emirates', 'India', 'Pakistan', 'Philippines', 'Singapore', 'Malaysia', 'Brazil', 'Jamaica', 'Trinidad and Tobago',
]

function GivingKindPicker({ kind, onChange }: { kind: GivingKind; onChange: (k: GivingKind) => void }) {
  return (
    <div className="glass-giving-group" role="radiogroup" aria-label="Choose your giving">
      {GIVING_KINDS.map((k, index) => (
        <label key={k} className={kind === k ? 'active' : ''}>
          <input type="radio" name="giving-kind" value={k} checked={kind === k} onChange={() => onChange(k)} />
          <span>{KIND_COPY[k].label}</span>
          {index === GIVING_KINDS.length - 1 && <i className={`glass-giving-glider is-${kind}`} aria-hidden="true" />}
        </label>
      ))}
    </div>
  )
}

export function GivingPanel({ viewerId }: { viewerId: number | null }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [kind, setKind] = useState<GivingKind>('offering')
  const [preset, setPreset] = useState<number | null>(25)
  const [custom, setCustom] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')
  const [method, setMethod] = useState('card')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [available, setAvailable] = useState(true)

  useEffect(() => { getGivingStatus().then(s => setAvailable(s.available)).catch(() => undefined) }, [])

  const amountCents = useMemo(() => {
    if (preset != null) return preset * 100
    const value = Number(custom)
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0
  }, [preset, custom])

  const signedIn = viewerId != null

  function continueToPayment() {
    setMessage('')
    if (!amountCents || amountCents < 100) { setMessage('Choose or enter an amount of at least $1.00.'); return }
    if (!signedIn) {
      if (name.trim().length < 2) { setMessage('Please enter your name.'); return }
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setMessage('Please enter a valid email address.'); return }
      if (!country) { setMessage('Please choose your country.'); return }
    }
    setStep(2)
  }

  async function give() {
    setBusy(true)
    setMessage('')
    try {
      const result = await createGivingCheckout({ data: { kind, amountCents, name: name.trim(), email: email.trim(), phone: phone.trim(), country } })
      window.location.assign(result.checkoutUrl)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Giving is temporarily unavailable. Please try again.')
      setBusy(false)
    }
  }

  if (!available) return <div className="giving-panel"><p className="giving-note">Giving is being set up. Please check back soon.</p></div>

  return (
    <div className="giving-panel">
      <AnimatePresence mode="wait" initial={false}>
        {step === 1 ? (
          <motion.div key="step-1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            <header className="giving-head">
              <span className="giving-icon"><HandHeart size={20} /></span>
              <div>
                <h3>Give</h3>
                <p>{signedIn ? 'Give securely from your account.' : 'Your details stay with your donation record.'}</p>
              </div>
            </header>

            <GivingKindPicker kind={kind} onChange={setKind} />
            <p className="giving-hint">{KIND_COPY[kind].hint}</p>

            <div className="giving-amounts" role="radiogroup" aria-label="Donation amount in US dollars">
              {PRESETS.map(value => (
                <button key={value} type="button" className={preset === value ? 'active' : ''} aria-pressed={preset === value}
                  onClick={() => { setPreset(value); setCustom('') }}>${value}</button>
              ))}
              <label className={`giving-custom${preset == null ? ' active' : ''}`}>
                <span>$</span>
                <input inputMode="decimal" placeholder="Custom" aria-label="Custom amount in US dollars" value={custom}
                  onChange={event => { setCustom(event.target.value.replace(/[^\d.]/g, '').slice(0, 9)); setPreset(null) }} />
              </label>
            </div>

            {!signedIn && (
              <div className="giving-fields">
                <label>Full name<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Your name" /></label>
                <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" /></label>
                <label>Phone number<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="Optional" /></label>
                <label>Country
                  <select value={country} onChange={e => setCountry(e.target.value)}>
                    <option value="">Choose your country</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="Other">Other</option>
                  </select>
                </label>
              </div>
            )}

            {message && <p className="giving-message" role="status">{message}</p>}
            <button type="button" className="giving-primary" onClick={continueToPayment} disabled={!amountCents}>
              Continue{amountCents ? ` — $${(amountCents / 100).toFixed(2)}` : ''}
            </button>
          </motion.div>
        ) : (
          <motion.div key="step-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            <button type="button" className="giving-back" onClick={() => { setStep(1); setMessage('') }}><ChevronLeft size={17} /> Back</button>
            <h3 className="giving-step-title">Choose how to pay</h3>
            <p className="giving-hint">{KIND_COPY[kind].label} · ${(amountCents / 100).toFixed(2)} USD{signedIn ? '' : ` · ${name.trim()}`}</p>

            <div className="giving-methods" role="radiogroup" aria-label="Payment method">
              <div className={`giving-method${method === 'card' ? ' active' : ''}`} role="radio" aria-checked={method === 'card'} tabIndex={0}
                onClick={() => setMethod('card')} onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && setMethod('card')}>
                <span className="giving-method-icon"><CreditCard size={22} /></span>
                <span className="giving-method-copy"><strong>Debit / Credit card</strong><span>Visa, Mastercard, Amex, Apple Pay & Google Pay</span></span>
                <span className="giving-method-radio"><AnimatePresence>{method === 'card' && <motion.i initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} />}</AnimatePresence></span>
              </div>
            </div>

            <p className="giving-secure"><ShieldCheck size={15} /> Secure payment powered by Stripe. You will finish on Stripe’s checkout page.</p>
            {message && <p className="giving-message" role="status">{message}</p>}
            <button type="button" className="giving-primary" disabled={busy} onClick={() => void give()}>
              {busy ? 'Opening secure checkout…' : `Give $${(amountCents / 100).toFixed(2)}`}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
