import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { BellRing, ShoppingBag } from 'lucide-react'
import { dismissStoreReminders, getDueReminders, type ContentType, type RecommendedProduct } from '../lib/recommendedProducts'
import { storeMoney } from '../lib/storeTypes'

// Shown when a viewer who chose "Remind Me" finishes the video or closes the
// player: the saved products, a direct route to the store page, or dismissal.
// onDone must be called exactly once — the caller uses it to finish closing.
export function StoreReminderPrompt({ contentType, contentId, onDone }: { contentType: ContentType; contentId: number; onDone: () => void }) {
  const [reminders, setReminders] = useState<RecommendedProduct[] | null>(null)

  useEffect(() => {
    let alive = true
    getDueReminders({ data: { contentType, contentId } })
      .then(res => {
        if (!alive) return
        if (!res.reminders.length) onDone()
        else setReminders(res.reminders)
      })
      .catch(() => { if (alive) onDone() })
    return () => { alive = false }
    // onDone intentionally excluded: fire once per prompt open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, contentId])

  async function finish(productIds: number[]) {
    try { await dismissStoreReminders({ data: { contentType, contentId, productIds } }) } catch { /* Dismissal is best-effort; the close must not block. */ }
    onDone()
  }

  if (!reminders) return null
  return (
    <div className="reminder-overlay" role="alertdialog" aria-modal="true" aria-labelledby="reminder-heading">
      <div className="reminder-card">
        <span className="reminder-icon"><BellRing size={22} /></span>
        <h3 id="reminder-heading">Before you go</h3>
        <p>You asked us to remind you about {reminders.length === 1 ? 'this resource' : 'these resources'}.</p>
        <div className="reminder-list">
          {reminders.map(p => (
            <div key={p.id} className="reminder-item">
              <img src={p.image} alt="" loading="lazy" />
              <div className="reminder-item-copy">
                <strong>{p.name}</strong>
                <span>{storeMoney(p.price, p.currency, p.minorUnit)}</span>
              </div>
              <Link to={p.path as any} className="reminder-buy" onClick={() => { void dismissStoreReminders({ data: { contentType, contentId, productIds: [p.id] } }).catch(() => undefined) }}>
                <ShoppingBag size={15} /> Buy now
              </Link>
            </div>
          ))}
        </div>
        <button type="button" className="reminder-later" onClick={() => void finish(reminders.map(p => p.id))}>Not now</button>
      </div>
    </div>
  )
}
