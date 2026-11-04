import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getFaqs } from '../lib/api'

export const Route = createFileRoute('/faq')({
  loader: async () => await getFaqs(),
  component: Faq,
})

function Faq() {
  const faqs = Route.useLoaderData() as any[]
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div>
      <h1 className="page-title-center" style={{ margin: '34px 0 30px' }}>FAQ</h1>
      <div className="faq-list">
        {faqs.map((f, i) => (
          <div key={f.id} className={`faq-item${open === f.id ? ' open' : ''}`}>
            <button className="faq-q" onClick={() => setOpen(open === f.id ? null : f.id)}>
              <span>{i + 1}. {f.question}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                strokeLinecap="round" strokeLinejoin="round" className="faq-chev">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {open === f.id && <div className="faq-a" dangerouslySetInnerHTML={{ __html: f.answer ?? '' }} />}
          </div>
        ))}
        {faqs.length === 0 && <div className="empty">No FAQs available yet.</div>}
      </div>
    </div>
  )
}
