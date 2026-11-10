import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, ChevronLeft, HandHeart, ShieldCheck, Repeat, Sparkles } from 'lucide-react'
import { createGivingCheckout, getGivingStatus, GIVING_KINDS, type GivingFrequency, type GivingKind } from '../lib/giving'
import { MoneyField } from './ui/money-field'
import { LiquidMetalButton } from './ui/liquid-metal-button'
import '../giving.css'

const KIND_COPY: Record<GivingKind, { label: string; hint: string }> = {
  offering: { label: 'Offering', hint: 'A free-will offering' },
  tithe: { label: 'Tithe', hint: 'A tenth, honouring God' },
  partner: { label: 'Partner', hint: 'Partner with the ministry' },
  seed: { label: 'Seed', hint: 'Sow a seed of faith' },
}

const COUNTRIES = [
  'United Kingdom', 'United States', 'Nigeria', 'South Africa', 'Kenya', 'Ghana', 'Zimbabwe', 'Zambia', 'Uganda', 'Tanzania',
  'Canada', 'Australia', 'New Zealand', 'Ireland', 'Germany', 'France', 'Netherlands', 'Spain', 'Italy', 'Sweden',
  'Norway', 'United Arab Emirates', 'India', 'Pakistan', 'Philippines', 'Singapore', 'Malaysia', 'Brazil', 'Jamaica', 'Trinidad and Tobago',
]

function GivingKindPicker({ kind, onChange }: { kind: GivingKind; onChange: (k: GivingKind) => void }) {
  const index = GIVING_KINDS.indexOf(kind)
  return (
    <div className="glass-giving-group" role="radiogroup" aria-label="Choose your giving">
      {GIVING_KINDS.map(k => (
        <label key={k} className={kind === k ? 'active' : ''}>
          <input type="radio" name="giving-kind" value={k} checked={kind === k} onChange={() => onChange(k)} />
          <span>{KIND_COPY[k].label}</span>
        </label>
      ))}
      <i className={`glass-giving-glider is-${kind}`} style={{ transform: `translateX(${index * 100}%)` }} aria-hidden="true" />
    </div>
  )
}

export function GivingPanel({ viewerId }: { viewerId: number | null }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [kind, setKind] = useState<GivingKind>('offering')
  const [frequency, setFrequency] = useState<GivingFrequency>('one_time')
  const [amountCents, setAmountCents] = useState<number | null>(2500)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [available, setAvailable] = useState(true)

  useEffect(() => { getGivingStatus().then(s => setAvailable(s.available)).catch(() => undefined) }, [])
  // Partnership can repeat monthly; everything else is a one-time gift.
  useEffect(() => { if (kind !== 'partner') setFrequency('one_time') }, [kind])

  const signedIn = viewerId != null
  const monthly = kind === 'partner' && frequency === 'monthly'
  const summary = useMemo(() => amountCents ? `$${(amountCents / 100).toFixed(2)}` : '', [amountCents])

  function continueToPayment() {
    setMessage('')
    if (!amountCents || amountCents < 100) { setMessage('Enter an amount of at least $1.00.'); return }
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
      const result = await createGivingCheckout({ data: { kind, frequency, amountCents: amountCents!, name: name.trim(), email: email.trim(), phone: phone.trim(), country } })
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
            <form className="giving-step" noValidate onSubmit={event => { event.preventDefault(); continueToPayment() }}>
              <header className="giving-head">
                <span className="giving-icon"><HandHeart size={20} /></span>
                <div>
                  <h3>Give</h3>
                  <p>{signedIn ? 'Give securely from your account.' : 'Your details stay with your donation record.'}</p>
                </div>
                <span className="giving-step-badge">Step 1 of 2</span>
              </header>

              <GivingKindPicker kind={kind} onChange={setKind} />
              <p className="giving-hint">{KIND_COPY[kind].hint}</p>

              {kind === 'partner' && (
                <div className="giving-frequency" role="radiogroup" aria-label="Partnership frequency">
                  <button type="button" className={frequency === 'one_time' ? 'active' : ''} aria-pressed={frequency === 'one_time'} onClick={() => setFrequency('one_time')}>
                    <Sparkles size={15} /> One-time
                  </button>
                  <button type="button" className={frequency === 'monthly' ? 'active' : ''} aria-pressed={frequency === 'monthly'} onClick={() => setFrequency('monthly')}>
                    <Repeat size={15} /> Monthly partnership
                  </button>
                </div>
              )}
              {monthly && <p className="giving-hint">Your partnership repeats every month. You can cancel any time from your account.</p>}

              <MoneyField label="Amount (USD)" value={amountCents} onValueChange={setAmountCents} quickAdd={[10, 25, 50, 100]} description="US dollars" />

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
              <LiquidMetalButton label={`Continue${summary ? ` — ${summary}` : ''}`} onClick={continueToPayment} disabled={!amountCents} />
            </form>
          </motion.div>
        ) : (
          <motion.div key="step-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            <div className="giving-step">
              <div className="giving-step2-head">
                <button type="button" className="giving-back" onClick={() => { setStep(1); setMessage('') }}><ChevronLeft size={17} /> Back</button>
                <span className="giving-step-badge">Step 2 of 2</span>
              </div>
              <h3 className="giving-step-title">Choose how to pay</h3>
              <p className="giving-hint">{KIND_COPY[kind].label}{monthly ? ' · Monthly' : ''} · {summary} USD{signedIn ? '' : ` · ${name.trim()}`}</p>

              <div className="giving-methods" role="radiogroup" aria-label="Payment method">
                <div className="giving-method active" role="radio" aria-checked="true" tabIndex={0}>
                  <span className="giving-method-icon"><CreditCard size={22} /></span>
                  <span className="giving-method-copy"><strong>Debit / Credit card</strong><span>Visa, Mastercard, Amex, Apple Pay & Google Pay</span></span>
                  <span className="giving-method-radio"><motion.i initial={{ scale: 0 }} animate={{ scale: 1 }} /></span>
                </div>
              </div>

              <p className="giving-secure"><ShieldCheck size={15} /> Secure payment powered by Stripe. You will finish on Stripe’s checkout page.</p>
              {message && <p className="giving-message" role="status">{message}</p>}
              <LiquidMetalButton label={monthly ? `Partner ${summary} / month` : `Give ${summary}`} onClick={() => void give()} busy={busy} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
