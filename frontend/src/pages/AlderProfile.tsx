import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchAlder } from '../api'
import type { AlderDetail, Bill } from '../api'
import { statusColor, formatDate, cleanSummary } from '../utils'
import { usePageTitle } from '../usePageTitle'
import './AlderProfile.css'

function BillRow({ bill }: { bill: Bill }) {
  const sponsors = bill.sponsors.map(s => s.name.replace('ALD. ', 'Ald. ')).join(', ') || '—'
  const summary = cleanSummary(bill.summary)
  return (
    <div className="bill-row">
      <div className="bill-row-header">
        <span className="bill-type">{bill.matter_type}</span>
        <span className="bill-status" style={{ background: statusColor(bill.matter_status) }}>
          {bill.matter_status}
        </span>
        {bill.tags.map(t => <span key={t} className="tag-chip">{t}</span>)}
      </div>
      <div className="bill-title">{bill.title}</div>
      {summary && <div className="bill-summary">{summary}</div>}
      <div className="bill-meta">
        <span>{bill.file_number ?? `#${bill.legistar_matter_id}`}</span>
        <span>{sponsors}</span>
        <span>{formatDate(bill.intro_date)}</span>
      </div>
    </div>
  )
}

export default function AlderProfile() {
  const { id } = useParams<{ id: string }>()
  const [alder, setAlder] = useState<AlderDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  usePageTitle(
    alder ? `${alder.name}, District ${alder.district}` : 'Alder Profile',
    alder
      ? `${alder.name} represents Milwaukee's Aldermanic District ${alder.district}. View sponsored legislation and contact info.`
      : undefined
  )

  useEffect(() => {
    if (!id) return
    setAlder(null)
    fetchAlder(parseInt(id))
      .then(setAlder)
      .catch(err => setError(err.message))
  }, [id])

  if (error) return <div className="page-wrap"><div className="error">{error}</div></div>
  if (!alder) return <div className="page-wrap"><div className="loading">Loading…</div></div>

  return (
    <div className="page-wrap">
      <div className="page-hero">
        <h1>{alder.name}</h1>
        <p>District {alder.district}</p>
      </div>

      <div className="profile-container">
        <main className="profile-body">
          {(alder.email || alder.phone) && (
            <div className="contact-block">
              {alder.email && (
                <div className="contact-row">
                  <span className="contact-label">Email</span>
                  <a href={`mailto:${alder.email}`}>{alder.email}</a>
                </div>
              )}
              {alder.phone && (
                <div className="contact-row">
                  <span className="contact-label">Phone</span>
                  <a href={`tel:${alder.phone}`}>{alder.phone}</a>
                </div>
              )}
            </div>
          )}

          <section className="profile-section">
            <h2>Sponsored Legislation</h2>
            {alder.sponsored_bills.length === 0 ? (
              <div className="empty-state">No sponsored legislation found.</div>
            ) : (
              <div className="bills-list">
                {alder.sponsored_bills.map(bill => (
                  <BillRow key={bill.id} bill={bill} />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
