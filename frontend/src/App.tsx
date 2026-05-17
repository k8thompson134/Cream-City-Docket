import { useEffect, useState } from 'react'
import { Routes, Route, useSearchParams } from 'react-router-dom'
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
  const sponsors = bill.sponsors.map(s => s.name.replace('ALD. ', 'Ald. ')).join(', ') || '—'
  const summary = cleanSummary(bill.summary)
  return (
    <div className={`bill-row${selected ? ' bill-row--selected' : ''}`} onClick={onClick}>
      <div className="bill-row-header">
        <span className="bill-type">{bill.matter_type}</span>
        <span className="bill-status" style={{ background: statusColor(bill.matter_status) }}>
          {bill.matter_status}
        </span>
        {bill.tags.map(t => <span key={t} className="tag-chip">{t}</span>)}
      </div>
      <div className="bill-title">{bill.title}</div>
      {showSummaries && !compact && summary && <div className="bill-summary">{summary}</div>}
      <div className="bill-meta">
        {showFileNumbers && <span>{bill.file_number ?? `#${bill.legistar_matter_id}`}</span>}
        <span>{sponsors}</span>
        <span>{formatDate(bill.intro_date)}</span>
      </div>
    </div>
  )
}

function formatAlderName(raw: string) {
  return raw.replace('ALD. ', 'Ald. ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function BillDetailPanel({ id, onClose, showSummaries }: {
  id: number
  onClose: () => void
  showSummaries: boolean
}) {
  const [bill, setBill] = useState<BillDetail | null>(null)
  const [votes, setVotes] = useState<BillVote[]>([])

  useEffect(() => {
    setBill(null)
    setVotes([])
    fetchBill(id).then(setBill)
    fetchBillVotes(id).then(setVotes)
  }, [id])

  if (!bill) return <div className="detail-panel"><div className="loading">Loading…</div></div>

  const sponsors = bill.sponsors.map(s =>
    `${s.name.replace('ALD. ', 'Ald. ')}${s.district ? ` (Dist. ${s.district})` : ''}`
  ).join(', ') || '—'

  const nextHearing = bill.agenda_date && new Date(bill.agenda_date) > new Date()
    ? bill.agenda_date : null

  const yeas = votes.filter(v => v.vote_value?.toLowerCase() === 'yea')
  const nays = votes.filter(v => v.vote_value?.toLowerCase() === 'nay')
  const others = votes.filter(v => v.vote_value && !['yea', 'nay'].includes(v.vote_value.toLowerCase()))

  return (
    <div className="detail-panel">
      <button className="close-btn" onClick={onClose}>✕ Close</button>
      <div className="detail-type-row">
        <span className="bill-type">{bill.matter_type}</span>
        <span className="bill-status" style={{ background: statusColor(bill.matter_status) }}>
          {bill.matter_status}
        </span>
        {bill.tags.map(t => <span key={t} className="tag-chip">{t}</span>)}
      </div>
      <h2>{bill.title}</h2>

      {nextHearing && (
        <div className="next-hearing-callout">
          <span className="next-hearing-label">Next hearing</span>
          <span className="next-hearing-date">{formatDate(nextHearing)}</span>
          {bill.body_name && <span className="next-hearing-body">{bill.body_name}</span>}
        </div>
      )}

      <div className="detail-meta">
        <div><strong>File</strong> {bill.file_number ?? `#${bill.legistar_matter_id}`}</div>
        <div><strong>Sponsor{bill.sponsors.length !== 1 ? 's' : ''}</strong> {sponsors}</div>
        <div><strong>Committee</strong> {bill.body_name ?? '—'}</div>
        <div><strong>Introduced</strong> {formatDate(bill.intro_date)}</div>
        {bill.passed_date && <div><strong>Passed</strong> {formatDate(bill.passed_date)}</div>}
      </div>

      {showSummaries && cleanSummary(bill.summary) && (
        <div className="detail-section">
          <h3>Summary</h3>
          <p>{cleanSummary(bill.summary)}</p>
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
                <span className="timeline-action">{h.action_name}</span>
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

      <a
        className="legistar-link"
        href={legistarUrl(bill)}
        target="_blank"
        rel="noreferrer"
      >
        View on Legistar{bill.file_number ? ` — File #${bill.file_number}` : ''} ↗
      </a>
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
    return `${diff} days away`
  }

  return (
    <div className="upcoming-section">
      <div className="upcoming-label">Upcoming Hearings</div>
      <div className="upcoming-cards">
        {bills.slice(0, 5).map(bill => {
          const isToday = bill.agenda_date ? daysUntil(bill.agenda_date) === 0 : false
          return (
            <div
              key={bill.id}
              className={`upcoming-card${isToday ? ' upcoming-card--today' : ''}`}
              onClick={() => onSelect(bill.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="upcoming-date">{formatDate(bill.agenda_date)}</div>
              <div className="upcoming-title">{bill.title}</div>
              {bill.body_name && <div className="upcoming-body">{bill.body_name}</div>}
              {bill.agenda_date && (
                <div className="upcoming-urgency">{urgencyLabel(bill.agenda_date)}</div>
              )}
              <div className="upcoming-legistar-row">
                <a
                  className="upcoming-legistar-link"
                  href={legistarUrl(bill)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                >
                  View on Legistar ↗
                </a>
              </div>
            </div>
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
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const LIMIT = 25

  const selectedId = searchParams.get('bill') ? parseInt(searchParams.get('bill')!) : null

  function selectBill(id: number) {
    setSearchParams(prev => { prev.set('bill', String(id)); return prev })
  }
  function closeBill() {
    setSearchParams(prev => { prev.delete('bill'); return prev })
  }

  useEffect(() => { fetchMeta().then(setMeta) }, [])
  useEffect(() => { fetchUpcoming().then(setUpcoming).catch(() => {}) }, [])

  useEffect(() => {
    setLoading(true)
    fetchBills({ skip, limit: LIMIT, matter_type: typeFilter || undefined, status: statusFilter || undefined, tag: tagFilter || undefined })
      .then(res => { setBills(res.items); setTotal(res.total) })
      .finally(() => setLoading(false))
  }, [skip, typeFilter, statusFilter, tagFilter])

  function handleFilterChange() {
    setSkip(0)
    closeBill()
  }

  return (
    <div className="layout">
      <aside className="sidebar">
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
          <label>
            Issue Area
            <select value={tagFilter} onChange={e => { setTagFilter(e.target.value); handleFilterChange() }}>
              <option value="">All issues</option>
              {meta?.tags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <div className="count">{total} bills</div>
      </aside>

      <main className="feed">
        <UpcomingSection bills={upcoming} onSelect={selectBill} />
        {loading && <div className="loading">Loading…</div>}
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

        {!loading && (
          <div className="pagination">
            <button disabled={skip === 0} onClick={() => setSkip(s => Math.max(0, s - LIMIT))}>← Prev</button>
            <span>{Math.floor(skip / LIMIT) + 1} / {Math.ceil(total / LIMIT) || 1}</span>
            <button disabled={skip + LIMIT >= total} onClick={() => setSkip(s => s + LIMIT)}>Next →</button>
          </div>
        )}
      </main>

      {selectedId !== null && (
        <BillDetailPanel
          id={selectedId}
          onClose={closeBill}
          showSummaries={settings.showSummaries}
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
