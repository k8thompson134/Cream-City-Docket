import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchBill, fetchBillVotes, legistarUrl } from '../api'
import type { BillDetail, BillVote } from '../api'
import { useSettings } from '../useSettings'
import { usePageTitle } from '../usePageTitle'
import { statusColor, formatDate, cleanSummary } from '../utils'
import './BillPage.css'

function formatAlderName(raw: string) {
  return raw.replace('ALD. ', 'Ald. ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export default function BillPage() {
  const { id } = useParams<{ id: string }>()
  const { settings } = useSettings()
  const [bill, setBill] = useState<BillDetail | null>(null)
  const [votes, setVotes] = useState<BillVote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const summary = bill ? cleanSummary(bill.summary) : null

  usePageTitle(
    bill ? bill.title : 'Bill',
    summary ? summary.slice(0, 160) : undefined
  )

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    Promise.all([
      fetchBill(parseInt(id)).then(setBill),
      fetchBillVotes(parseInt(id)).then(setVotes),
    ])
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="bill-page-loading">Loading…</div>
  if (error || !bill) return (
    <div className="bill-page-loading">
      Bill not found. <Link to="/">Back to The Docket</Link>
    </div>
  )

  const nextHearing = bill.agenda_date && new Date(bill.agenda_date) > new Date()
    ? bill.agenda_date : null

  const isYea = (val: string | null) => ['yea', 'aye', 'yes'].includes((val ?? '').toLowerCase())
  const isNay = (val: string | null) => ['nay', 'no'].includes((val ?? '').toLowerCase())

  const yeas = votes.filter(v => isYea(v.vote_value))
  const nays = votes.filter(v => isNay(v.vote_value))
  const others = votes.filter(v => v.vote_value && !isYea(v.vote_value) && !isNay(v.vote_value))

  function voteSummary(): string | null {
    if (votes.length === 0) return null
    const y = yeas.length, n = nays.length
    const passed = y > n
    const result = passed ? 'Passed' : 'Failed'
    if (n === 0) return `${result} unanimously (${y}–0)`
    const score = `${y}–${n}`
    if (n <= 2) {
      const names = nays.map(v => formatAlderName(v.alder_name)).join(' and ')
      return `${result} ${score}, with ${names} dissenting`
    }
    return `${result} ${score}`
  }

  return (
    <div className="bill-page">
      <div className="bill-page-hero">
        <div className="bill-page-breadcrumb">
          <Link to="/">The Docket</Link>
          <span>›</span>
          <span>{bill.matter_type}</span>
        </div>
        <div className="bill-page-badges">
          <span className="bill-type">{bill.matter_type}</span>
          <span className="bill-status" style={{ background: statusColor(bill.matter_status) }}>
            {bill.matter_status}
          </span>
          {bill.tags.map(t => <span key={t} className="tag-chip">{t}</span>)}
        </div>
        <h1 className="bill-page-title">{bill.title}</h1>
        <div className="bill-page-meta-row">
          {bill.file_number && <span>File #{bill.file_number}</span>}
          <span>Introduced {formatDate(bill.intro_date)}</span>
          {bill.passed_date && <span>Passed {formatDate(bill.passed_date)}</span>}
        </div>
      </div>

      {nextHearing && (
        <div className="bill-page-hearing">
          <div className="bill-page-hearing-inner">
            <div className="bill-page-hearing-label">Next hearing</div>
            <div className="bill-page-hearing-date">{formatDate(nextHearing)}</div>
            {bill.body_name && <div className="bill-page-hearing-body">{bill.body_name}</div>}
          </div>
        </div>
      )}

      <div className="bill-page-body">
        <main className="bill-page-main">

          {settings.showSummaries && summary && (
            <section className="bill-page-section">
              <h2>Plain-English Summary</h2>
              <p className="bill-page-summary">{summary}</p>
              <p className="bill-page-ai-note">AI-generated summary · always verify with the <a href={legistarUrl(bill)} target="_blank" rel="noreferrer">official text on Legistar ↗</a></p>
            </section>
          )}

          {votes.length > 0 && (
            <section className="bill-page-section">
              <h2>Council Vote</h2>
              {voteSummary() && <p className="bill-vote-summary">{voteSummary()}</p>}
              <div className="bill-page-vote-breakdown">
                {yeas.length > 0 && (
                  <div className="bp-vote-row bp-vote-row--yea">
                    <span className="bp-vote-label">Yea ({yeas.length})</span>
                    <span className="bp-vote-names">{yeas.map(v => formatAlderName(v.alder_name)).join(', ')}</span>
                  </div>
                )}
                {nays.length > 0 && (
                  <div className="bp-vote-row bp-vote-row--nay">
                    <span className="bp-vote-label">Nay ({nays.length})</span>
                    <span className="bp-vote-names">{nays.map(v => formatAlderName(v.alder_name)).join(', ')}</span>
                  </div>
                )}
                {others.length > 0 && (
                  <div className="bp-vote-row bp-vote-row--other">
                    <span className="bp-vote-label">Other ({others.length})</span>
                    <span className="bp-vote-names">{others.map(v => `${formatAlderName(v.alder_name)} (${v.vote_value})`).join(', ')}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {bill.history.length > 0 && (
            <section className="bill-page-section">
              <h2>Legislative Timeline</h2>
              <div className="bill-page-timeline">
                {bill.history.map((h, i) => (
                  <div key={i} className="bp-timeline-item">
                    <span className="bp-timeline-date">{formatDate(h.action_date)}</span>
                    <div className="bp-timeline-content">
                      <span className="bp-timeline-action">{h.action_name}</span>
                      {h.result && <span className="bp-timeline-result">{h.result}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {bill.mayor_actions.length > 0 && (
            <section className="bill-page-section">
              <h2>Mayoral Actions</h2>
              <div className="bill-page-timeline">
                {bill.mayor_actions.map((a, i) => (
                  <div key={i} className="bp-timeline-item">
                    <span className="bp-timeline-date">{formatDate(a.action_date)}</span>
                    <div className="bp-timeline-content">
                      <span className="bp-timeline-action" style={{ textTransform: 'capitalize' }}>{a.action_type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="bill-page-sidebar">
          <div className="bp-sidebar-card">
            <h3>Bill Info</h3>
            {bill.file_number && (
              <div className="bp-info-row">
                <span className="bp-info-label">File</span>
                <span className="bp-info-value">#{bill.file_number}</span>
              </div>
            )}
            <div className="bp-info-row">
              <span className="bp-info-label">Type</span>
              <span className="bp-info-value">{bill.matter_type}</span>
            </div>
            <div className="bp-info-row">
              <span className="bp-info-label">Status</span>
              <span className="bp-info-value">{bill.matter_status}</span>
            </div>
            {bill.body_name && (
              <div className="bp-info-row">
                <span className="bp-info-label">Committee</span>
                <span className="bp-info-value">{bill.body_name}</span>
              </div>
            )}
            <div className="bp-info-row">
              <span className="bp-info-label">Introduced</span>
              <span className="bp-info-value">{formatDate(bill.intro_date)}</span>
            </div>
            {bill.passed_date && (
              <div className="bp-info-row">
                <span className="bp-info-label">Passed</span>
                <span className="bp-info-value">{formatDate(bill.passed_date)}</span>
              </div>
            )}
          </div>

          {bill.sponsors.length > 0 && (
            <div className="bp-sidebar-card">
              <h3>Sponsor{bill.sponsors.length !== 1 ? 's' : ''}</h3>
              {bill.sponsors.map(s => (
                <div key={s.id} className="bp-sponsor-row">
                  <Link to={`/alders/${s.id}`} className="bp-sponsor-link">
                    {s.name.replace('ALD. ', 'Ald. ')}
                  </Link>
                  {s.district && <span className="bp-sponsor-district">District {s.district}</span>}
                </div>
              ))}
            </div>
          )}

          <div className="bp-sidebar-card">
            <a href={legistarUrl(bill)} target="_blank" rel="noreferrer" className="bp-legistar-btn">
              View full text on Legistar ↗
            </a>
          </div>
        </aside>
      </div>
    </div>
  )
}
