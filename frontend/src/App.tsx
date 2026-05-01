import { useEffect, useState } from 'react'
import { fetchBills, fetchBill, fetchMeta } from './api'
import type { Bill, BillDetail, Meta } from './api'
import './App.css'

const STATUS_COLORS: Record<string, string> = {
  'Passed': '#12284B',
  'In Committee': '#1a4d7a',
  'In Commission': '#1a4d7a',
  'In Council': '#0a3d6b',
  'In Council-Adoption': '#0a3d6b',
  'In Council-Passage': '#0a3d6b',
  'In Council-Confirmation': '#0a3d6b',
  'In Council-Approval': '#0a3d6b',
  'Placed On File': '#444',
  'Dead': '#5a1a1a',
  'Introduced': '#2a5a2a',
}

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? '#444'
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function BillRow({ bill, onClick, selected }: { bill: Bill; onClick: () => void; selected: boolean }) {
  const sponsors = bill.sponsors.map(s => s.name.replace('ALD. ', 'Ald. ')).join(', ') || '—'
  return (
    <div className={`bill-row${selected ? ' bill-row--selected' : ''}`} onClick={onClick}>
      <div className="bill-row-header">
        <span className="bill-type">{bill.matter_type}</span>
        <span className="bill-status" style={{ background: statusColor(bill.matter_status) }}>
          {bill.matter_status}
        </span>
      </div>
      <div className="bill-title">{bill.title}</div>
      <div className="bill-meta">
        <span>{bill.file_number ?? `#${bill.legistar_matter_id}`}</span>
        <span>{sponsors}</span>
        <span>{formatDate(bill.intro_date)}</span>
      </div>
    </div>
  )
}

function BillDetailPanel({ id, onClose }: { id: number; onClose: () => void }) {
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
      </div>
      <h2>{bill.title}</h2>
      <div className="detail-meta">
        <div><strong>File</strong> {bill.file_number ?? `#${bill.legistar_matter_id}`}</div>
        <div><strong>Sponsor{bill.sponsors.length !== 1 ? 's' : ''}</strong> {sponsors}</div>
        <div><strong>Committee</strong> {bill.body_name ?? '—'}</div>
        <div><strong>Introduced</strong> {formatDate(bill.intro_date)}</div>
        {bill.passed_date && <div><strong>Passed</strong> {formatDate(bill.passed_date)}</div>}
      </div>

      {bill.summary && (
        <div className="detail-section">
          <h3>Summary</h3>
          <p>{bill.summary}</p>
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

export default function App() {
  const [bills, setBills] = useState<Bill[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const LIMIT = 25

  useEffect(() => { fetchMeta().then(setMeta) }, [])

  useEffect(() => {
    setLoading(true)
    fetchBills({ skip, limit: LIMIT, matter_type: typeFilter || undefined, status: statusFilter || undefined })
      .then(res => { setBills(res.items); setTotal(res.total) })
      .finally(() => setLoading(false))
  }, [skip, typeFilter, statusFilter])

  function handleFilterChange() {
    setSkip(0)
    setSelectedId(null)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Cream City Docket</h1>
        <p>Milwaukee city legislation, made readable.</p>
      </header>

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
          </div>
          <div className="count">{total} bills</div>
        </aside>

        <main className="feed">
          {loading && <div className="loading">Loading…</div>}
          {!loading && bills.map(b => (
            <BillRow key={b.id} bill={b} onClick={() => setSelectedId(b.id)} selected={selectedId === b.id} />
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
          <BillDetailPanel id={selectedId} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  )
}
