import React, { useEffect, useRef, useState } from 'react'
import { Routes, Route, Link, useSearchParams } from 'react-router-dom'
import { fetchBills, fetchBill, fetchBillVotes, fetchMeta, fetchUpcoming, legistarUrl } from './api'
import type { Bill, BillDetail, BillVote, Meta } from './api'
import { useSettings } from './useSettings'
import { statusColor, formatDate, cleanSummary } from './utils'
import { usePageTitle } from './usePageTitle'
import Nav from './Nav'
import About from './pages/About'
import Settings from './pages/Settings'
import Alders from './pages/Alders'
import AlderDetail from './pages/AlderDetail'
import BillPage from './pages/BillPage'
import Mayor from './pages/Mayor'
import Subscribe from './pages/Subscribe'
import './App.css'

function BillRow({ bill, onClick, selected, showSummaries, showFileNumbers, compact }: {
  bill: Bill
  onClick: () => void
  selected: boolean
  showSummaries: boolean
  showFileNumbers: boolean
  compact: boolean
}) {
  const sponsors = bill.sponsors.map(s => s.name.replace('ALD. ', 'Ald. ')).join(', ')
  const summary = cleanSummary(bill.summary)
  const isNew = bill.intro_date
    ? Date.now() - new Date(bill.intro_date).getTime() < 7 * 24 * 60 * 60 * 1000
    : false

  const metaParts: string[] = []
  if (showFileNumbers) metaParts.push(bill.file_number ?? `#${bill.legistar_matter_id}`)
  if (sponsors) metaParts.push(sponsors)
  metaParts.push(formatDate(bill.intro_date))

  return (
    <button type="button" className={`bill-row${selected ? ' bill-row--selected' : ''}`} onClick={onClick} aria-expanded={selected}>
      <div className="bill-row-header">
        <span className="bill-type">{bill.matter_type}</span>
        <span className="bill-status" style={{ background: statusColor(bill.matter_status) }}>
          {bill.matter_status}
        </span>
        {isNew && <span className="badge-new">New</span>}
        {bill.tags.map(t => <span key={t} className="tag-chip">{t}</span>)}
      </div>
      <div className="bill-title">{bill.title}</div>
      {showSummaries && !compact && summary && <div className="bill-summary">{summary}</div>}
      <div className="bill-meta">
        <span className="bill-meta-text">{metaParts.join(' · ')}</span>
        <span className="bill-view-arrow">View →</span>
      </div>
    </button>
  )
}

const TIMELINE_LABELS: Record<string, string> = {
  'ASSIGNED TO': 'Assigned to committee',
  'RECOMMENDED FOR ADOPTION': 'Committee recommended adoption',
  'RECOMMENDED FOR PASSAGE': 'Committee recommended passage',
  'HELD TO CALL OF THE CHAIR': 'Held in committee',
  'IN COUNCIL-ADOPTION': 'Before full council — adoption vote',
  'IN COUNCIL-PASSAGE': 'Before full council — passage vote',
  'IN COUNCIL-CONFIRMATION': 'Before full council — confirmation vote',
  'PASSED': 'Passed by council',
  'ADOPTED': 'Adopted by council',
  'FAILED': 'Failed',
  'PLACED ON FILE': 'Placed on file (shelved)',
  'SIGNED': 'Signed by mayor',
  'VETOED': 'Vetoed by mayor',
  'PUBLISHED': 'Published — law takes effect',
  'SUBSTITUTE': 'Substitute version filed',
  'RECEIVED': 'Received',
  'READ': 'Read into record',
}

function friendlyAction(raw: string): string {
  const key = raw.toUpperCase().trim()
  return TIMELINE_LABELS[key] ?? raw
}

function urgencyCopy(agendaDate: string, bodyName: string | null): string {
  const diff = Math.round((new Date(agendaDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
  const isCouncil = (bodyName ?? '').toUpperCase().includes('COMMON COUNCIL')
  if (isCouncil) {
    if (diff === 0) return 'Full council vote today — contact your alder now'
    if (diff === 1) return 'Full council vote tomorrow — contact your alder today'
    return `Full council vote in ${diff} days — contact your alder before then`
  }
  if (diff === 0) return 'Committee hearing today — public testimony accepted'
  if (diff === 1) return 'Committee hearing tomorrow — last chance to testify'
  if (diff <= 3) return `Committee hearing in ${diff} days — public testimony accepted`
  return 'Upcoming committee hearing'
}

function formatSyncTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatAlderName(raw: string) {
  return raw.replace('ALD. ', 'Ald. ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

const STAGE_LABELS = ['Introduced', 'Committee', 'Council', 'Mayor']

function StageBar({ bill }: { bill: BillDetail }) {
  const s = bill.matter_status.toLowerCase()
  const isTerminal = s === 'placed on file' || s === 'dead'

  if (isTerminal) {
    return (
      <div className="stage-bar-terminal">
        {bill.matter_status}
      </div>
    )
  }

  const activeStage =
    bill.mayor_actions.length > 0 ? 4
    : s.startsWith('in council') || s === 'passed' ? 3
    : s === 'in committee' || s === 'in commission' ? 2
    : 1

  return (
    <div className="stage-bar">
      <div className="stage-track">
        {STAGE_LABELS.map((_, i) => {
          const n = i + 1
          const done = n < activeStage
          const active = n === activeStage
          return (
            <React.Fragment key={i}>
              <div className={`stage-dot${done ? ' stage-dot--done' : active ? ' stage-dot--active' : ''}`} />
              {i < STAGE_LABELS.length - 1 && (
                <div className={`stage-conn${done ? ' stage-conn--done' : ''}`} />
              )}
            </React.Fragment>
          )
        })}
      </div>
      <div className="stage-label-row">
        {STAGE_LABELS.map((label, i) => {
          const n = i + 1
          const done = n < activeStage
          const active = n === activeStage
          return (
            <span key={i} className={`stage-label${done ? ' stage-label--done' : active ? ' stage-label--active' : ''}`}>
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function BillDetailPanel({ id, onClose, showSummaries, showConfidence }: {
  id: number
  onClose: () => void
  showSummaries: boolean
  showConfidence: boolean
}) {
  const [bill, setBill] = useState<BillDetail | null>(null)
  const [votes, setVotes] = useState<BillVote[]>([])
  const [copied, setCopied] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setBill(null)
    setVotes([])
    fetchBill(id).then(setBill)
    fetchBillVotes(id).then(setVotes).catch(() => setVotes([]))
    closeRef.current?.focus()
  }, [id])

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!bill) return (
    <div className="detail-panel" role="region" aria-label="Bill detail" aria-live="polite" aria-busy="true">
      <div className="loading">Loading…</div>
    </div>
  )

  const nextHearing = bill.agenda_date && new Date(bill.agenda_date) > new Date()
    ? bill.agenda_date : null

  const substituteEntry = bill.history.find(h =>
    h.action_name.toUpperCase().includes('SUBSTITUTE')
  )

  const isYea = (v: string | null) => ['yea', 'aye', 'yes'].includes((v ?? '').toLowerCase())
  const isNay = (v: string | null) => ['nay', 'no'].includes((v ?? '').toLowerCase())
  const yeas = votes.filter(v => isYea(v.vote_value))
  const nays = votes.filter(v => isNay(v.vote_value))
  const others = votes.filter(v => v.vote_value && !isYea(v.vote_value) && !isNay(v.vote_value))
  const summary = cleanSummary(bill.summary)

  return (
    <div className="detail-panel" role="region" aria-label="Bill detail">
      <div className="detail-panel-header">
        <div className="detail-panel-header-left">
          <button ref={closeRef} className="close-btn" onClick={onClose} aria-label="Close bill detail">✕ Close</button>
          <a href={`/bills/${id}`} className="detail-fullpage-link">Full page →</a>
        </div>
        <button className="copy-link-btn" onClick={copyLink} aria-label="Copy link to this bill">
          {copied ? '✓ Copied' : '⎘ Copy link'}
        </button>
      </div>

      <div className="detail-panel-body">
      <div className="detail-type-row">
        <span className="bill-type">{bill.matter_type}</span>
        {bill.tags.map(t => <span key={t} className="tag-chip">{t}</span>)}
      </div>

      <h2>{bill.title}</h2>

      <StageBar bill={bill} />

      {substituteEntry && (
        <div className="substitute-notice">
          <strong>Amended:</strong> substitute filed {formatDate(substituteEntry.action_date)}.{' '}
          <a href={legistarUrl(bill)} target="_blank" rel="noreferrer">View on Legistar ↗</a>
          {bill.substitute_summary && (
            <p className="substitute-diff">{bill.substitute_summary}</p>
          )}
        </div>
      )}

      {nextHearing && (
        <div className="next-hearing-callout">
          <span className="next-hearing-label">{urgencyCopy(nextHearing, bill.body_name)}</span>
          <span className="next-hearing-date">{formatDate(nextHearing)}</span>
          {bill.body_name && <span className="next-hearing-body">{bill.body_name}</span>}
        </div>
      )}

      <div className="detail-meta">
        <span className="dm-label">Status</span>
        <span className="dm-value">
          <span className="bill-status" style={{ background: statusColor(bill.matter_status) }}>{bill.matter_status}</span>
        </span>
        <span className="dm-label">File</span>
        <span className="dm-value">{bill.file_number ?? `#${bill.legistar_matter_id}`}</span>
        <span className="dm-label">Introduced</span>
        <span className="dm-value">{formatDate(bill.intro_date)}</span>
        {bill.passed_date && <>
          <span className="dm-label">Passed</span>
          <span className="dm-value">{formatDate(bill.passed_date)}</span>
        </>}
        <span className="dm-label">Committee</span>
        <span className="dm-value">{bill.body_name ?? '—'}</span>
        {bill.sponsors.length > 0 && <>
          <span className="dm-label">Sponsor{bill.sponsors.length !== 1 ? 's' : ''}</span>
          <span className="dm-value">
            {bill.sponsors.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ', '}
                <Link to={`/alders/${s.id}`} className="dm-sponsor-link">
                  {formatAlderName(s.name)}{s.district ? ` (D${s.district})` : ''}
                </Link>
              </span>
            ))}
          </span>
        </>}
      </div>

      {showSummaries && summary && (
        <div className="detail-summary">
          <p>{summary}</p>
          {showConfidence && (bill.summary?.length ?? 0) < 150 && (
            <div className="confidence-notice">Summary based on limited bill text — may be incomplete.</div>
          )}
          <span className="detail-summary-note">AI-generated · verify on Legistar</span>
        </div>
      )}

      {votes.length > 0 && (
        <div className="detail-section">
          <h3>Council Vote</h3>
          <div className="vote-breakdown">
            {yeas.length > 0 && (
              <div className="vote-breakdown-row vote-breakdown-row--yea">
                <span className="vb-label">Yea ({yeas.length})</span>
                <span className="vb-names">{yeas.map(v => formatAlderName(v.alder_name)).join(', ')}</span>
              </div>
            )}
            {nays.length > 0 && (
              <div className="vote-breakdown-row vote-breakdown-row--nay">
                <span className="vb-label">Nay ({nays.length})</span>
                <span className="vb-names">{nays.map(v => formatAlderName(v.alder_name)).join(', ')}</span>
              </div>
            )}
            {others.length > 0 && (
              <div className="vote-breakdown-row vote-breakdown-row--other">
                <span className="vb-label">Other ({others.length})</span>
                <span className="vb-names">{others.map(v => `${formatAlderName(v.alder_name)} (${v.vote_value})`).join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {bill.history.length > 0 && (
        <div className="detail-section">
          <h3>Legislative Timeline</h3>
          <div className="timeline">
            {bill.history.map((h, i) => (
              <div key={i} className="timeline-item">
                <span className="timeline-date">{formatDate(h.action_date)}</span>
                <span className="timeline-action">{friendlyAction(h.action_name)}</span>
                {h.result && <span className="timeline-result">{h.result}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {bill.mayor_actions.length > 0 && (
        <div className="detail-section">
          <h3>Mayoral Actions</h3>
          {bill.mayor_actions.map((a, i) => (
            <div key={i} className="timeline-item">
              <span className="timeline-date">{formatDate(a.action_date)}</span>
              <span className="timeline-action" style={{ textTransform: 'capitalize' }}>{a.action_type}</span>
            </div>
          ))}
        </div>
      )}

      <a className="legistar-btn" href={legistarUrl(bill)} target="_blank" rel="noreferrer">
        View full text on Legistar ↗
      </a>
      </div>
    </div>
  )
}

function UpcomingSection({ bills, onSelect }: { bills: Bill[]; onSelect: (id: number) => void }) {
  if (bills.length === 0) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function daysUntil(dateStr: string) {
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0)
    return Math.round((d.getTime() - today.getTime()) / 86400000)
  }

  function urgencyLabel(dateStr: string) {
    const diff = daysUntil(dateStr)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    return `${diff}d`
  }

  return (
    <div className="upcoming-section">
      <div className="upcoming-header">
        <span className="upcoming-label">Upcoming Hearings</span>
        <span className="upcoming-count">{bills.length} this week</span>
      </div>
      <div className="upcoming-cards">
        {bills.map(bill => {
          const diff = bill.agenda_date ? daysUntil(bill.agenda_date) : null
          const isToday = diff === 0
          const isTomorrow = diff === 1
          return (
            <button
              key={bill.id}
              className={`upcoming-card${isToday ? ' upcoming-card--today' : isTomorrow ? ' upcoming-card--soon' : ''}`}
              onClick={() => onSelect(bill.id)}
            >
              <div className="upcoming-card-meta">
                <span className="upcoming-date">{formatDate(bill.agenda_date)}</span>
                {bill.agenda_date && (
                  <span className={`upcoming-urgency${isToday ? ' upcoming-urgency--today' : ''}`}>
                    {urgencyLabel(bill.agenda_date)}
                  </span>
                )}
              </div>
              <div className="upcoming-title">{bill.title}</div>
              {bill.body_name && <div className="upcoming-body">{bill.body_name}</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Docket() {
  usePageTitle(undefined, 'Track Milwaukee Common Council legislation in real time. Filter by issue area, read plain-English summaries, and get free email alerts before the vote.')
  const { settings } = useSettings()
  const [searchParams, setSearchParams] = useSearchParams()
  const [bills, setBills] = useState<Bill[]>([])
  const [upcoming, setUpcoming] = useState<Bill[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [typeFilter, setTypeFilter] = useState(() =>
    settings.defaultTypeFilter === '__all__' ? '' : (settings.defaultTypeFilter || '')
  )
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sort, setSort] = useState('urgency')
  const [loading, setLoading] = useState(true)
  const LIMIT = 25

  const selectedId = searchParams.get('bill') ? parseInt(searchParams.get('bill')!) : null
  const showAll = searchParams.get('all') === '1' || settings.defaultTypeFilter === '__all__'
  const legislativeOnly = !showAll && !typeFilter

  function selectBill(id: number) {
    setSearchParams(prev => { prev.set('bill', String(id)); return prev })
  }
  function closeBill() {
    setSearchParams(prev => { prev.delete('bill'); return prev })
  }
  function showAllTypes() {
    setSearchParams(prev => { prev.set('all', '1'); prev.delete('bill'); return prev })
    setSkip(0)
  }
  function resetToLegislative() {
    setSearchParams(prev => { prev.delete('all'); prev.delete('bill'); return prev })
    setTypeFilter('')
    setSkip(0)
  }

  useEffect(() => { fetchMeta().then(setMeta) }, [])
  useEffect(() => { fetchUpcoming().then(setUpcoming).catch(() => {}) }, [])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setSkip(0); closeBill() }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setLoading(true)
    fetchBills({
      skip,
      limit: LIMIT,
      matter_type: typeFilter || undefined,
      status: statusFilter || undefined,
      tag: tagFilter || undefined,
      legislative_only: legislativeOnly || undefined,
      sort,
      search: search || undefined,
    })
      .then(res => { setBills(res.items); setTotal(res.total) })
      .finally(() => setLoading(false))
  }, [skip, typeFilter, statusFilter, tagFilter, showAll, sort, search])

  function handleFilterChange() {
    setSkip(0)
    closeBill()
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="search-box">
          <input
            className="search-input"
            type="search"
            placeholder="Search bills…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            aria-label="Search bills by title or summary"
          />
        </div>
        <div className="sort-toggle" role="group" aria-label="Sort order">
          <button className={`sort-btn${sort === 'urgency' ? ' sort-btn--active' : ''}`} onClick={() => { setSort('urgency'); setSkip(0) }} aria-pressed={sort === 'urgency'}>Urgent first</button>
          <button className={`sort-btn${sort === 'recent' ? ' sort-btn--active' : ''}`} onClick={() => { setSort('recent'); setSkip(0) }} aria-pressed={sort === 'recent'}>Most recent</button>
        </div>
        <div className="filters">
          <label>
            Type
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); handleFilterChange() }}>
              <option value="">All types</option>
              {meta?.matter_types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); handleFilterChange() }}>
              <option value="">All statuses</option>
              {meta?.statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="filter-chips-section">
            <div className="filter-chips-label">Issue Area</div>
            <div className="filter-chips" role="group" aria-label="Filter by issue area">
              {meta?.tags.map(t => (
                <button
                  key={t}
                  className={`filter-chip${tagFilter === t ? ' filter-chip--active' : ''}`}
                  onClick={() => { setTagFilter(tagFilter === t ? '' : t); handleFilterChange() }}
                  aria-pressed={tagFilter === t}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="count">
          {total} {typeFilter || statusFilter || tagFilter || search ? 'matching' : 'bills'}
        </div>
        {meta?.last_synced && (
          <div className="sync-timestamp">Updated {formatSyncTime(meta.last_synced)}</div>
        )}
        {legislativeOnly && (
          <div className="filter-notice">
            Ordinances &amp; resolutions only.{' '}
            <button className="filter-notice-btn" onClick={showAllTypes}>Show all →</button>
          </div>
        )}
        {showAll && (
          <div className="filter-notice">
            Showing all bill types.{' '}
            <button className="filter-notice-btn" onClick={resetToLegislative}>Legislative only →</button>
          </div>
        )}
      </aside>

      <main className="feed" id="main-content">
        <UpcomingSection bills={upcoming} onSelect={selectBill} />
        {loading && <div className="loading" aria-live="polite" aria-busy="true">Loading…</div>}
        {!loading && bills.map(b => (
          <BillRow
            key={b.id}
            bill={b}
            onClick={() => selectBill(b.id)}
            selected={selectedId === b.id}
            showSummaries={settings.showSummaries}
            showFileNumbers={settings.showFileNumbers}
            compact={settings.compactFeed}
          />
        ))}
        {!loading && bills.length === 0 && <div className="empty">No bills match these filters.</div>}

        {!loading && (() => {
          const currentPage = Math.floor(skip / LIMIT) + 1
          const totalPages = Math.ceil(total / LIMIT) || 1
          const pages: (number | '…')[] = totalPages <= 7
            ? Array.from({ length: totalPages }, (_, i) => i + 1)
            : currentPage <= 4
              ? [1, 2, 3, 4, 5, '…', totalPages]
              : currentPage >= totalPages - 3
                ? [1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
                : [1, '…', currentPage - 1, currentPage, currentPage + 1, '…', totalPages]
          return (
            <nav className="pagination" aria-label="Bill list pagination">
              <button disabled={skip === 0} onClick={() => { setSkip(s => Math.max(0, s - LIMIT)); closeBill() }} aria-label="Previous page">← Prev</button>
              {pages.map((p, i) =>
                p === '…'
                  ? <span key={`ellipsis-${i}`} className="pagination-ellipsis" aria-hidden="true">…</span>
                  : <button
                      key={p}
                      className={p === currentPage ? 'pagination-page pagination-page--active' : 'pagination-page'}
                      onClick={() => { setSkip((p as number - 1) * LIMIT); closeBill() }}
                      aria-current={p === currentPage ? 'page' : undefined}
                      aria-label={`Page ${p}`}
                    >{p}</button>
              )}
              <button disabled={skip + LIMIT >= total} onClick={() => { setSkip(s => s + LIMIT); closeBill() }} aria-label="Next page">Next →</button>
            </nav>
          )
        })()}
      </main>

      {selectedId !== null && (
        <BillDetailPanel
          id={selectedId}
          onClose={closeBill}
          showSummaries={settings.showSummaries}
          showConfidence={settings.showConfidenceIndicator}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <div className="app">
      <Nav />
      <Routes>
        <Route path="/" element={<Docket />} />
        <Route path="/bills/:id" element={<BillPage />} />
        <Route path="/alders" element={<Alders />} />
        <Route path="/alders/:id" element={<AlderDetail />} />
        <Route path="/mayor" element={<Mayor />} />
        <Route path="/about" element={<About />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/subscribe" element={<Subscribe />} />
      </Routes>
    </div>
  )
}
