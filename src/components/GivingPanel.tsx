import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, HandHeart, Repeat, Sparkles, Check } from 'lucide-react'
import { getGivingStatus, GIVING_KINDS, type GivingFrequency, type GivingKind } from '../lib/giving'
import { GivingPayment, settleGivingPayment } from './GivingPayment'
import { MoneyField } from './ui/money-field'
import { LiquidGlassButton } from './ui/apple-tahoe-liquid-glass-button'
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
  const [message, setMessage] = useState('')
  const [available, setAvailable] = useState(true)
  const [publishableKey, setPublishableKey] = useState('')
  const [done, setDone] = useState<{ kind: string; frequency: string; amountCents: number; name: string; id: string; paidAt: string | null } | null>(null)

  useEffect(() => {
    getGivingStatus().then(s => { setAvailable(s.available); setPublishableKey(s.publishableKey ?? '') }).catch(() => undefined)
  }, [])
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


  if (!available) return <div className="giving-panel"><p className="giving-note">Giving is being set up. Please check back soon.</p></div>

  return (
    <div className="giving-panel">
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div key="step-done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
            <div className="giving-done">
              <span className="giving-done-check"><Check size={30} strokeWidth={2.6} /></span>
              <h3>Thank you for giving!</h3>
              <p>Your {KIND_COPY[done.kind as GivingKind]?.label.toLowerCase()} of ${(done.amountCents / 100).toFixed(2)}{done.frequency === 'monthly' ? ' every month' : ''} is confirmed.</p>
              <p className="giving-hint">A receipt and thank-you note are on their way to your email. Reference {done.id.slice(0, 8).toUpperCase()}.</p>
              <LiquidGlassButton interactive appearance="dark" className="w-full" onClick={() => { setStep(1); setDone(null); setAmountCents(2500) }}>Amen — back to the video</LiquidGlassButton>
            </div>
          </motion.div>
        ) : step === 1 ? (
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
              {monthly && <p className="giving-hint">Repeats monthly. Cancel any time.</p>}

              <MoneyField label="Amount (USD)" value={amountCents} onValueChange={setAmountCents} quickAdd={[10, 25, 50, 100]} />

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
              <LiquidGlassButton interactive appearance="dark" className="w-full" disabled={!amountCents} onClick={continueToPayment}>Continue{summary ? ` — ${summary}` : ''}</LiquidGlassButton>
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
              {message && <p className="giving-message" role="status">{message}</p>}
              {publishableKey ? (
                <GivingPayment
                  donor={{ kind, frequency, amountCents: amountCents!, name: name.trim(), email: email.trim(), phone: phone.trim(), country }}
                  viewerId={viewerId}
                  summary={summary}
                  monthly={monthly}
                  publishableKey={publishableKey}
                  onError={setMessage}
                  onReset={() => setStep(1)}
                  onSuccess={donationId => {
                    setMessage('')
                    void settleGivingPayment(donationId).then(donation => setDone(donation ?? { kind, frequency, amountCents: amountCents!, name: signedIn ? 'your account' : name.trim(), id: donationId, paidAt: null }))
                  }}
                />
              ) : <p className="giving-note">Secure payment is being set up. Please check back soon.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
