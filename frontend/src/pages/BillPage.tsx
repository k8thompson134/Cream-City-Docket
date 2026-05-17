import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchBill, fetchBillVotes, legistarUrl, subscribeToAlerts } from '../api'
import type { BillDetail, BillVote } from '../api'
import { useSettings } from '../useSettings'
import { usePageTitle } from '../usePageTitle'
import { statusColor, formatDate, cleanSummary } from '../utils'
import './BillPage.css'

// -- helpers --

const TIMELINE_LABELS: Record<string, string> = {
  'ASSIGNED TO': 'Assigned to committee',
  'REFERRED': 'Referred to committee',
  'RECOMMENDED FOR ADOPTION': 'Committee recommended adoption',
  'RECOMMENDED FOR PASSAGE': 'Committee recommended passage',
  'HELD TO CALL OF THE CHAIR': 'Held in committee',
  'HEARING NOTICES SENT': 'Hearing scheduled',
  'IN COUNCIL-ADOPTION': 'Before full council — adoption vote',
  'IN COUNCIL-PASSAGE': 'Before full council — passage vote',
  'IN COUNCIL-CONFIRMATION': 'Before full council — confirmation vote',
  'PASSED': 'Passed by council',
  'ADOPTED': 'Adopted by council',
  'FAILED': 'Failed',
  'PLACED ON FILE': 'Shelved (placed on file)',
  'SIGNED': 'Signed by Mayor Johnson',
  'VETOED': 'Vetoed by mayor',
  'PUBLISHED': 'Published — ordinance now in effect',
  'SUBSTITUTE': 'Substitute version filed',
  'RECEIVED': 'Received',
  'READ': 'Read into record',
  'LAID OVER': 'Postponed',
}

function friendlyAction(raw: string): string {
  return TIMELINE_LABELS[raw.toUpperCase().trim()] ?? raw
}

function formatAlderName(raw: string) {
  return raw.replace('ALD. ', 'Ald. ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

const isYea = (v: string | null) => ['yea', 'aye', 'yes'].includes((v ?? '').toLowerCase())
const isNay = (v: string | null) => ['nay', 'no'].includes((v ?? '').toLowerCase())

function groupVotesByBody(allVotes: BillVote[]) {
  const map = new Map<string, { bodyName: string; eventDate: string | null; votes: BillVote[] }>()
  for (const v of allVotes) {
    const key = v.event_body_name ?? 'Vote'
    if (!map.has(key)) map.set(key, { bodyName: key, eventDate: v.event_date ?? null, votes: [] })
    map.get(key)!.votes.push(v)
  }
  return Array.from(map.values()).sort((a, b) =>
    (b.eventDate ?? '') > (a.eventDate ?? '') ? 1 : -1
  )
}

function groupVoteSummary(groupVotes: BillVote[]): string {
  const y = groupVotes.filter(v => isYea(v.vote_value)).length
  const n = groupVotes.filter(v => isNay(v.vote_value)).length
  const passed = y > n
  const result = passed ? 'Passed' : 'Failed'
  if (n === 0 && y > 0) return `${result} unanimously (${y}–0)`
  if (y === 0 && n > 0) return `${result} unanimously (0–${n})`
  if (n <= 2 && passed) {
    const names = groupVotes
      .filter(v => isNay(v.vote_value))
      .map(v => formatAlderName(v.alder_name))
      .join(' and ')
    return `${result} ${y}–${n}, with ${names} dissenting`
  }
  return `${result} ${y}–${n}`
}

interface UrgencyInfo {
  style: 'dark' | 'medium' | 'gray'
  message: string
  detail?: string
  cta?: { label: string; href: string }
}

function computeUrgency(
  bill: BillDetail,
  votes: BillVote[],
  nextHearing: string | null
): UrgencyInfo | null {
  const signed = bill.mayor_actions.find(a => a.action_type.toLowerCase() === 'signed')
  const vetoed = bill.mayor_actions.find(a => a.action_type.toLowerCase() === 'vetoed')

  if (signed) {
    const info: UrgencyInfo = {
      style: 'gray',
      message: `Signed into law by Mayor Johnson · ${formatDate(signed.action_date)}`,
    }
    if (bill.matter_type.toLowerCase().includes('charter') && signed.action_date) {
      const effective = new Date(signed.action_date)
      effective.setDate(effective.getDate() + 60)
      info.detail = `Effective ${effective.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (60 days after signing)`
    }
    return info
  }

  if (vetoed) {
    return {
      style: 'dark',
      message: `Vetoed by Mayor Johnson · ${formatDate(vetoed.action_date)} — veto override vote may be scheduled`,
      cta: { label: 'Contact your alder →', href: '/alders' },
    }
  }

  if (bill.matter_status === 'Placed On File') {
    return {
      style: 'gray',
      message: 'Shelved without a final vote — can be recalled by the council',
    }
  }

  if (bill.matter_status === 'Passed') {
    const y = votes.filter(v => isYea(v.vote_value)).length
    const n = votes.filter(v => isNay(v.vote_value)).length
    const score = y > 0 ? ` ${y}–${n}` : ''
    return {
      style: 'medium',
      message: `Passed${score} — awaiting mayor action`,
      cta: { label: 'Contact Mayor Johnson →', href: '/mayor' },
    }
  }

  if (bill.matter_status.toLowerCase().startsWith('in council')) {
    return {
      style: 'dark',
      message: 'Full council vote upcoming — contact your alder before the vote',
      cta: { label: 'Find my alder →', href: '/alders' },
    }
  }

  if (nextHearing && (bill.matter_status === 'In Committee' || bill.matter_status === 'In Commission')) {
    const diff = Math.round(
      (new Date(nextHearing).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000
    )
    if (diff <= 7) {
      const msg =
        diff === 0 ? 'Hearing today — public testimony accepted' :
        diff === 1 ? 'Committee hearing tomorrow — last chance to testify' :
        `Hearing in ${diff} days — last chance to testify`
      const info: UrgencyInfo = {
        style: 'dark',
        message: msg,
        detail: formatDate(nextHearing) + (bill.body_name ? ` · ${bill.body_name}` : ''),
      }
      const firstSponsor = bill.sponsors[0]
      if (firstSponsor) {
        const alderName = formatAlderName(firstSponsor.name)
        info.cta = firstSponsor.email
          ? { label: `Contact ${alderName} →`, href: `mailto:${firstSponsor.email}` }
          : { label: `View ${alderName}'s profile →`, href: `/alders/${firstSponsor.id}` }
      }
      return info
    }
  }

  return null
}

export default function BillPage() {
  const { id } = useParams<{ id: string }>()
  const { settings } = useSettings()
  const [bill, setBill] = useState<BillDetail | null>(null)
  const [votes, setVotes] = useState<BillVote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [copied, setCopied] = useState(false)
  const [trackEmail, setTrackEmail] = useState('')
  const [trackStatus, setTrackStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

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

  const urgency = computeUrgency(bill, votes, nextHearing)
  const voteGroups = groupVotesByBody(votes)
  const reversedHistory = [...bill.history].reverse()

  function handleShare() {
    const url = window.location.href
    if (typeof navigator.share === 'function') {
      navigator.share({
        title: bill!.title,
        text: summary ? summary.slice(0, 200) : '',
        url,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault()
    if (!bill || !trackEmail) return
    setTrackStatus('loading')
    try {
      await subscribeToAlerts({ email: trackEmail, tags: bill.tags, district: null })
      setTrackStatus('success')
    } catch {
      setTrackStatus('error')
    }
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
          <div className="bp-share-wrap">
            <button className="bp-share-btn" onClick={handleShare}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              Share
            </button>
            {copied && <span className="bp-share-tooltip">Link copied!</span>}
          </div>
        </div>
      </div>

      {urgency && (
        <div className={`bill-page-urgency bill-page-urgency--${urgency.style}`}>
          <div className="bill-page-urgency-inner">
            <div className="bill-page-urgency-text">
              <span className="bill-page-urgency-message">{urgency.message}</span>
              {urgency.detail && <span className="bill-page-urgency-detail">{urgency.detail}</span>}
            </div>
            {urgency.cta && (
              urgency.cta.href.startsWith('mailto:') || urgency.cta.href.startsWith('http')
                ? <a href={urgency.cta.href} className="bill-page-urgency-cta">{urgency.cta.label}</a>
                : <Link to={urgency.cta.href} className="bill-page-urgency-cta">{urgency.cta.label}</Link>
            )}
          </div>
        </div>
      )}

      <div className="bill-page-body">
        <main className="bill-page-main">

          {settings.showSummaries && (
            <section className="bill-page-section">
              <h2>Plain-English Summary</h2>
              <div className="bp-section-body">
                {summary && summary.length < 100 && (
                  <blockquote className="bp-summary-context">{bill.title}</blockquote>
                )}
                {summary
                  ? <p className="bill-page-summary">{summary}</p>
                  : <p className="bp-empty-state">No summary available yet.</p>
                }
                {summary && (
                  <p className="bill-page-ai-note">
                    AI-generated summary · always verify with the{' '}
                    <a href={legistarUrl(bill)} target="_blank" rel="noreferrer">official text on Legistar ↗</a>
                  </p>
                )}
              </div>
            </section>
          )}

          {votes.length > 0 && (
            <section className="bill-page-section">
              <h2>Council Vote</h2>
              <div className="bp-section-body">
              {voteGroups.map((group, gi) => {
                const gy = group.votes.filter(v => isYea(v.vote_value))
                const gn = group.votes.filter(v => isNay(v.vote_value))
                const go = group.votes.filter(v => v.vote_value && !isYea(v.vote_value) && !isNay(v.vote_value))
                const allSameWay = (gn.length === 0 && go.length === 0 && gy.length > 0)
                  || (gy.length === 0 && go.length === 0 && gn.length > 0)
                return (
                  <div key={gi} className="bp-vote-group">
                    {voteGroups.length > 1 && (
                      <div className="bp-vote-group-label">
                        {group.bodyName}
                        {group.eventDate && (
                          <span className="bp-vote-group-date"> · {formatDate(group.eventDate)}</span>
                        )}
                      </div>
                    )}
                    <p className="bill-vote-summary">{groupVoteSummary(group.votes)}</p>
                    <div className="bill-page-vote-breakdown">
                      {allSameWay ? (
                        <div className={`bp-vote-row ${gy.length > 0 ? 'bp-vote-row--yea' : 'bp-vote-row--nay'}`}>
                          <span className="bp-vote-label">
                            {gy.length > 0 ? `Yea (${gy.length})` : `Nay (${gn.length})`}
                          </span>
                          <span className="bp-vote-names">Unanimous</span>
                        </div>
                      ) : (
                        <>
                          {gy.length > 0 && (
                            <div className="bp-vote-row bp-vote-row--yea">
                              <span className="bp-vote-label">Yea ({gy.length})</span>
                              <span className="bp-vote-names">
                                {gy.map((v, i) => (
                                  <span key={i}>
                                    {i > 0 && ', '}
                                    {v.alder_id
                                      ? <Link to={`/alders/${v.alder_id}`} className="bp-vote-alder-link">{formatAlderName(v.alder_name)}</Link>
                                      : formatAlderName(v.alder_name)}
                                    {v.alder_district && <span className="bp-vote-district"> D{v.alder_district}</span>}
                                  </span>
                                ))}
                              </span>
                            </div>
                          )}
                          {gn.length > 0 && (
                            <div className="bp-vote-row bp-vote-row--nay">
                              <span className="bp-vote-label">Nay ({gn.length})</span>
                              <span className="bp-vote-names">
                                {gn.map((v, i) => (
                                  <span key={i}>
                                    {i > 0 && ', '}
                                    {v.alder_id
                                      ? <Link to={`/alders/${v.alder_id}`} className="bp-vote-alder-link">{formatAlderName(v.alder_name)}</Link>
                                      : formatAlderName(v.alder_name)}
                                    {v.alder_district && <span className="bp-vote-district"> D{v.alder_district}</span>}
                                  </span>
                                ))}
                              </span>
                            </div>
                          )}
                          {go.length > 0 && (
                            <div className="bp-vote-row bp-vote-row--other">
                              <span className="bp-vote-label">Other ({go.length})</span>
                              <span className="bp-vote-names">
                                {go.map((v, i) => (
                                  <span key={i}>
                                    {i > 0 && ', '}
                                    {v.alder_id
                                      ? <Link to={`/alders/${v.alder_id}`} className="bp-vote-alder-link">{formatAlderName(v.alder_name)}</Link>
                                      : formatAlderName(v.alder_name)}
                                    {v.alder_district && <span className="bp-vote-district"> D{v.alder_district}</span>}
                                    {' '}({v.vote_value})
                                  </span>
                                ))}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
              </div>
            </section>
          )}

          <section className="bill-page-section">
            <h2>Legislative History</h2>
            <div className="bp-section-body">
              {reversedHistory.length === 0 ? (
                <p className="bp-empty-state">No legislative history recorded yet.</p>
              ) : (
                <div className="bill-page-timeline">
                  {reversedHistory.map((h, i) => (
                    <div key={i} className="bp-timeline-item">
                      <div className="bp-timeline-dot-col">
                        <span className={`bp-timeline-dot${i === 0 ? ' bp-timeline-dot--current' : ''}`} />
                        {i < reversedHistory.length - 1 && <span className="bp-timeline-connector" />}
                      </div>
                      <div className="bp-timeline-content2">
                        <span className="bp-timeline-date">{formatDate(h.action_date)}</span>
                        <span className="bp-timeline-action">{friendlyAction(h.action_name)}</span>
                        {h.result && <span className="bp-timeline-result">{h.result}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {bill.mayor_actions.length > 0 && (
            <section className="bill-page-section">
              <h2>Mayoral Actions</h2>
              <div className="bp-section-body">
                <div className="bill-page-timeline">
                  {[...bill.mayor_actions].reverse().map((a, i, arr) => (
                    <div key={i} className="bp-timeline-item">
                      <div className="bp-timeline-dot-col">
                        <span className={`bp-timeline-dot${i === 0 ? ' bp-timeline-dot--current' : ''}`} />
                        {i < arr.length - 1 && <span className="bp-timeline-connector" />}
                      </div>
                      <div className="bp-timeline-content2">
                        <span className="bp-timeline-date">{formatDate(a.action_date)}</span>
                        <span className="bp-timeline-action" style={{ textTransform: 'capitalize' }}>{a.action_type}</span>
                      </div>
                    </div>
                  ))}
                </div>
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
            {nextHearing && (
              <div className="bp-info-row">
                <span className="bp-info-label">Next Hearing</span>
                <span className="bp-info-value">
                  {new Date(nextHearing).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                  })}
                  {bill.body_name && <span className="bp-info-sublabel">{bill.body_name}</span>}
                </span>
              </div>
            )}
          </div>

          {bill.sponsors.length > 0 && (
            <div className="bp-sidebar-card">
              <h3>Sponsored By</h3>
              {bill.sponsors.map(s => (
                <div key={s.id} className="bp-sponsor-row">
                  <Link to={`/alders/${s.id}`} className="bp-sponsor-link">
                    {formatAlderName(s.name)}
                  </Link>
                  {s.district && <span className="bp-sponsor-district">District {s.district}</span>}
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="bp-sponsor-contact">{s.email}</a>
                  )}
                  {s.phone && (
                    <a href={`tel:${s.phone}`} className="bp-sponsor-contact">{s.phone}</a>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="bp-sidebar-card">
            <h3>Get alerted about this bill</h3>
            {trackStatus === 'success' ? (
              <p className="bp-track-success">
                You'll get alerts for this bill. Check your email to confirm.
              </p>
            ) : (
              <form onSubmit={handleTrack} className="bp-track-form">
                <p className="bp-track-desc">
                  Receive an email when this bill is scheduled for a vote or the mayor acts on it.
                </p>
                <input
                  type="email"
                  className="bp-track-input"
                  placeholder="you@example.com"
                  value={trackEmail}
                  onChange={e => setTrackEmail(e.target.value)}
                  required
                />
                <button type="submit" className="bp-track-btn" disabled={trackStatus === 'loading'}>
                  {trackStatus === 'loading' ? 'Sending…' : 'Alert me →'}
                </button>
                {trackStatus === 'error' && (
                  <p className="bp-track-error">Something went wrong. Try again.</p>
                )}
              </form>
            )}
          </div>

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
