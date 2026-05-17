import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { fetchBills, fetchBill, fetchMeta } from './api'
import type { Bill, BillDetail, Meta } from './api'
import { useSettings } from './useSettings'
import { statusColor, formatDate, cleanSummary } from './utils'
import { usePageTitle } from './usePageTitle'
import Nav from './Nav'
import About from './pages/About'
import Settings from './pages/Settings'
import Alders from './pages/Alders'
import AlderDetail from './pages/AlderDetail'
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

function BillDetailPanel({ id, onClose, showSummaries }: {
  id: number
  onClose: () => void
  showSummaries: boolean
}) {
  const [bill, setBill] = useState<BillDetail | null>(null)

  useEffect(() => {
    setBill(null)
    fetchBill(id).then(setBill)
  }, [id])

  if (!bill) return <div className="detail-panel"><div className="loading">Loading…</div></div>

  const sponsors = bill.sponsors.map(s =>
    `${s.name.replace('ALD. ', 'Ald. ')}${s.district ? ` (Dist. ${s.district})` : ''}`
  ).join(', ') || '—'

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
        href="https://milwaukee.legistar.com/Legislation.aspx"
        target="_blank"
        rel="noreferrer"
      >
        Search Legistar{bill.file_number ? ` — File #${bill.file_number}` : ''} ↗
      </a>
    </div>
  )
}

function Docket() {
  usePageTitle(undefined, 'Track Milwaukee Common Council legislation in real time. Filter by issue area, read plain-English summaries, and get free email alerts before the vote.')
  const { settings } = useSettings()
  const [bills, setBills] = useState<Bill[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const LIMIT = 25

  useEffect(() => { fetchMeta().then(setMeta) }, [])

  useEffect(() => {
    setLoading(true)
    fetchBills({ skip, limit: LIMIT, matter_type: typeFilter || undefined, status: statusFilter || undefined, tag: tagFilter || undefined })
      .then(res => { setBills(res.items); setTotal(res.total) })
      .finally(() => setLoading(false))
  }, [skip, typeFilter, statusFilter, tagFilter])

  function handleFilterChange() {
    setSkip(0)
    setSelectedId(null)
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
        {loading && <div className="loading">Loading…</div>}
        {!loading && bills.map(b => (
          <BillRow
            key={b.id}
            bill={b}
            onClick={() => setSelectedId(b.id)}
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
          onClose={() => setSelectedId(null)}
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
        <Route path="/about" element={<About />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/subscribe" element={<Subscribe />} />
      </Routes>
    </div>
  )
}
