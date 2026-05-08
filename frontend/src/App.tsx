import { useEffect, useState } from 'react'
import { Routes, Route, useSearchParams, Link } from 'react-router-dom'
import { fetchBills, fetchBill, fetchMeta, fetchAlders, fetchUpcoming, legistarUrl } from './api'
import type { Bill, BillDetail, Meta, Alder } from './api'
import { useSettings } from './useSettings'
import Nav from './Nav'
import About from './pages/About'
import ManageSubscription from './pages/ManageSubscription'
import Alders from './pages/Alders'
import AlderDetail from './pages/AlderDetail'
import Settings from './pages/Settings'
import Subscribe from './pages/Subscribe'
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

function cleanSummary(text: string | null): string | null {
  if (!text) return null
  const cleaned = text
    .split('\n')
    .filter(line => !line.trimStart().startsWith('#'))
    .join(' ')
    .trim()
  return cleaned || null
}

const TYPE_TOOLTIPS: Record<string, string> = {
  'Ordinance': 'Permanently changes Milwaukee\'s municipal code. Takes effect the day after publication.',
  'Charter Ordinance': 'Changes the City Charter — the foundational document for city government. Requires a 2/3 council vote (10 of 15 alders) and takes effect 60 days after publication.',
  'Resolution': 'A one-time policy directive or formal statement. Does not permanently change the law.',
  'Resolution-Immediate Adoption': 'Fast-track resolution adopted by the council without going through a standard committee hearing first.',
  'Appointment': 'A mayoral nomination that must be confirmed by a vote of the Common Council.',
  'Fire and Police Resolution': 'An action by the Fire and Police Commission — typically a personnel decision (promotion, demotion, discipline).',
  'Plan Commission Resolution': 'A land use or zoning decision from the City Plan Commission.',
  'Housing Authority Resolution': 'An action by the Milwaukee Housing Authority board.',
  'Charter Ordinance-Zoning': 'A zoning change that requires amending the City Charter.',
}

const STATUS_TOOLTIPS: Record<string, string> = {
  'In Committee': 'Referred to a standing committee for review. Public testimony is usually accepted at the committee hearing.',
  'In Commission': 'Under review by a city commission such as the Fire and Police Commission or Plan Commission.',
  'In Council': 'Before the full 15-member Common Council, awaiting a vote.',
  'In Council-Adoption': 'Pending a formal adoption vote by the full council.',
  'In Council-Passage': 'Pending a passage vote by the full council.',
  'In Council-Confirmation': 'Pending a confirmation vote — typically for a mayoral appointment.',
  'In Council-Approval': 'Pending an approval vote by the full council.',
  'In Council-Placed on File': 'The council has voted to place this on file rather than vote on it directly.',
  'Placed On File': 'Shelved without a final vote. The bill can be recalled later but is effectively on hold.',
  'Dead': 'Failed or withdrawn. This bill will not proceed further.',
  'Passed': 'Approved by the council. May still require the mayor\'s signature.',
}

const MAYOR_ACTION_TOOLTIPS: Record<string, string> = {
  'signed': 'The mayor signed the bill into law.',
  'vetoed': 'The mayor rejected the bill. The council can override a veto with 10 votes (2/3 of 15 alders).',
  'published': 'Published in the official city newspaper — the final step before the law takes effect.',
  'lapsed': 'The mayor did not act within the required timeframe, so the bill became law automatically.',
}

const COMMITTEE_TOOLTIPS: Record<string, string> = {
  'JUDICIARY & LEGISLATION COMMITTEE': 'Reviews legislation for legal compliance. Most bills pass through a committee like this before a full council vote.',
  'FINANCE & PERSONNEL COMMITTEE': 'Oversees the city budget, finances, and personnel matters.',
  'PUBLIC WORKS COMMITTEE': 'Reviews infrastructure, streets, sewers, and public facilities.',
  'ZONING, NEIGHBORHOODS & DEVELOPMENT COMMITTEE': 'Reviews land use changes, development proposals, and zoning variances.',
  'PUBLIC SAFETY AND HEALTH COMMITTEE': 'Oversees policing, fire, public health, and safety legislation.',
  'LICENSES COMMITTEE': 'Reviews business license applications and related legislation.',
  'COMMUNITY & ECONOMIC DEVELOPMENT COMMITTEE': 'Focuses on economic growth, housing development, and community investment.',
  'COMMON COUNCIL': 'The full 15-member council — bills here go to a vote by all alders.',
  'FIRE AND POLICE COMMISSION': 'Independent board overseeing the Milwaukee Police and Fire departments.',
  'CAPITAL IMPROVEMENTS COMMITTEE': 'Reviews major city capital projects and infrastructure investments.',
  'STEERING & RULES COMMITTEE': 'Sets the council agenda and rules of procedure.',
  'LIBRARY BOARD': 'Oversees the Milwaukee Public Library system.',
}

function Tooltip({ text }: { text: string }) {
  const { settings } = useSettings()
  if (!settings.showTooltips) return null
  const id = `tt-${text.slice(0, 20).replace(/\s/g, '-')}`
  return (
    <span className="tooltip-container">
      <span
        className="tooltip-q"
        role="button"
        tabIndex={0}
        aria-describedby={id}
        aria-label="More information"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.focus() }}
      >?</span>
      <span className="tooltip-bubble" role="tooltip" id={id}>{text}</span>
    </span>
  )
}

function CopyFileNumber({ fileNumber }: { fileNumber: string }) {
  const [copied, setCopied] = useState(false)
  function copy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(fileNumber).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <button className="copy-file-btn" onClick={copy} title={`Copy file number ${fileNumber}`}>
      {copied ? 'Copied ✓' : 'Copy #'}
    </button>
  )
}

function isNew(introDate: string | null): boolean {
  if (!introDate) return false
  return (Date.now() - new Date(introDate).getTime()) < 14 * 24 * 60 * 60 * 1000
}

function agendaLabel(agendaDate: string | null, bodyName: string | null): string | null {
  if (!agendaDate) return null
  const d = new Date(agendaDate)
  if (d < new Date()) return null
  const isCouncil = (bodyName ?? '').toUpperCase().includes('COMMON COUNCIL')
  const prefix = isCouncil ? 'Full Council' : 'Hearing'
  return `${prefix} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

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
  const newBadge = isNew(bill.intro_date)
  const hearingLabel = agendaLabel(bill.agenda_date, bill.body_name)

  const isCharter = bill.matter_type === 'Charter Ordinance'
  const isImmediate = bill.matter_type === 'Resolution-Immediate Adoption'
  const committeeTooltip = bill.body_name
    ? COMMITTEE_TOOLTIPS[bill.body_name.toUpperCase()] ?? null
    : null

  return (
    <div className={`bill-row${selected ? ' bill-row--selected' : ''}`} onClick={onClick}>
      <div className="bill-row-top">
        <div className="bill-badges">
          {newBadge && <span className="badge-new">New</span>}
          {hearingLabel && <span className="badge-hearing">{hearingLabel}</span>}
          {isCharter && (
            <span className="badge-charter">
              Charter Ordinance
              <Tooltip text="Changes Milwaukee's City Charter — requires a 2/3 council vote (10 of 15 alders) and takes effect 60 days after publication, not the next day like a regular ordinance." />
            </span>
          )}
          {isImmediate && (
            <span className="badge-immediate">
              Immediate Adoption
              <Tooltip text="Fast-track resolution adopted by the council without going through a standard committee hearing first." />
            </span>
          )}
          {!isCharter && !isImmediate && (
            <span className="bill-type">
              {bill.matter_type}
              {TYPE_TOOLTIPS[bill.matter_type] && <Tooltip text={TYPE_TOOLTIPS[bill.matter_type]} />}
            </span>
          )}
        </div>
        <div className="bill-row-date">
          {formatDate(bill.intro_date)}
          {showFileNumbers && bill.file_number && (
            <span className="bill-file-num"> · #{bill.file_number} <CopyFileNumber fileNumber={bill.file_number} /></span>
          )}
        </div>
      </div>
      <div className="bill-title">{bill.title}</div>
      {showSummaries && !compact && summary && <div className="bill-summary">{summary}</div>}
      {bill.tags?.length > 0 && (
        <div className="bill-tags">
          {bill.tags.map(t => <span key={t} className="tag-chip">{t}</span>)}
        </div>
      )}
      <div className="bill-footer">
        <span className="bill-meta-text">
          {sponsors}
          {bill.body_name && (
            <> · {bill.body_name}{committeeTooltip && <Tooltip text={committeeTooltip} />}</>
          )}
        </span>
        <span className="bill-view-btn">View →</span>
      </div>
    </div>
  )
}

function urgencyMessage(agendaDate: string, bodyName: string | null): string {
  const d = new Date(agendaDate)
  const today = new Date(); today.setHours(0,0,0,0)
  const diff = Math.round((d.setHours(0,0,0,0) - today.getTime()) / 86400000)
  const isCouncil = (bodyName ?? '').toUpperCase().includes('COMMON COUNCIL')
  if (diff === 0) return isCouncil ? 'Vote today — call your alder' : 'Last chance to testify today'
  if (diff === 1) return isCouncil ? 'Vote tomorrow — call your alder' : 'Testify at tomorrow\'s hearing'
  if (diff <= 3) return isCouncil ? `Full council vote in ${diff} days` : `Hearing in ${diff} days — public testimony accepted`
  return isCouncil ? 'Upcoming full council vote' : 'Committee hearing scheduled'
}

function UpcomingSection({ bills }: { bills: Bill[] }) {
  if (bills.length === 0) return null
  return (
    <div className="upcoming-section">
      <div className="upcoming-label">Upcoming Hearings &amp; Votes</div>
      <div className="upcoming-cards">
        {bills.slice(0, 3).map(bill => {
          const d = new Date(bill.agenda_date!)
          const today = new Date(); today.setHours(0,0,0,0)
          const isToday = d.setHours(0,0,0,0) === today.getTime()
          const dateStr = isToday
            ? `TODAY · ${new Date(bill.agenda_date!).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
            : new Date(bill.agenda_date!).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          return (
            <div key={bill.id} className={`upcoming-card${isToday ? ' upcoming-card--today' : ''}`}>
              <div className="upcoming-date">{dateStr}</div>
              <div className="upcoming-title">{bill.title}</div>
              <div className="upcoming-body">{bill.body_name ?? 'Common Council'}</div>
              <div className="upcoming-urgency">{urgencyMessage(bill.agenda_date!, bill.body_name)}</div>
              <div className="upcoming-legistar-row">
                <a
                  className="upcoming-legistar-link"
                  href={legistarUrl(bill)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                >
                  {bill.file_number ? `File #${bill.file_number}` : 'View on Legistar'} ↗
                </a>
                {bill.file_number && <CopyFileNumber fileNumber={bill.file_number} />}
              </div>
            </div>
          )
        })}
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

  const sponsorLinks = bill.sponsors.length > 0
    ? bill.sponsors.map((s, i) => (
        <span key={s.id}>
          {i > 0 && ', '}
          <Link to={`/alders/${s.id}`} style={{ color: '#12284B', fontWeight: 600 }}>
            {s.name.replace('ALD. ', 'Ald. ')}{s.district ? ` (Dist. ${s.district})` : ''}
          </Link>
        </span>
      ))
    : '—'

  return (
    <div className="detail-panel" role="complementary" aria-label="Bill details">
      <button className="close-btn" onClick={onClose} aria-label="Close bill details">✕ Close</button>
      <div className="detail-type-row">
        <span className="bill-type">
          {bill.matter_type}
          {TYPE_TOOLTIPS[bill.matter_type] && <Tooltip text={TYPE_TOOLTIPS[bill.matter_type]} />}
        </span>
        <span className="bill-status" style={{ background: statusColor(bill.matter_status) }}>
          {bill.matter_status}
          {STATUS_TOOLTIPS[bill.matter_status] && <Tooltip text={STATUS_TOOLTIPS[bill.matter_status]} />}
        </span>
        {bill.tags?.map(t => <span key={t} className="tag-chip">{t}</span>)}
      </div>
      <h2>{bill.title}</h2>
      <div className="detail-meta">
        <div>
          <strong>File</strong> {bill.file_number ?? `#${bill.legistar_matter_id}`}
          {bill.file_number && <CopyFileNumber fileNumber={bill.file_number} />}
        </div>
        <div><strong>Sponsor{bill.sponsors.length !== 1 ? 's' : ''}</strong> {sponsorLinks}</div>
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
              <span className="timeline-action" style={{ textTransform: 'capitalize' }}>
                {a.action_type}
                {MAYOR_ACTION_TOOLTIPS[a.action_type] && <Tooltip text={MAYOR_ACTION_TOOLTIPS[a.action_type]} />}
              </span>
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
        Open Legistar search ↗{bill.file_number ? ` (copy File #${bill.file_number} first)` : ''}
      </a>
    </div>
  )
}

function Docket() {
  const { settings } = useSettings()
  const [searchParams] = useSearchParams()
  const [bills, setBills] = useState<Bill[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [alders, setAlders] = useState<Alder[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState(() => searchParams.get('tag') ?? '')
  const [sponsorFilter, setSponsorFilter] = useState(() => searchParams.get('sponsored_by') ?? '')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [upcoming, setUpcoming] = useState<Bill[]>([])
  const LIMIT = 25

  useEffect(() => { fetchMeta().then(setMeta) }, [])
  useEffect(() => { fetchUpcoming().then(setUpcoming).catch(() => {}) }, [])
  useEffect(() => { fetchAlders().then(data => setAlders(data.sort((a, b) => (parseInt(a.district ?? '99') - parseInt(b.district ?? '99'))))) }, [])

  useEffect(() => {
    setLoading(true)
    fetchBills({ skip, limit: LIMIT, matter_type: typeFilter || undefined, status: statusFilter || undefined, tag: tagFilter || undefined, sponsored_by: sponsorFilter ? parseInt(sponsorFilter) : undefined })
      .then(res => { setBills(res.items); setTotal(res.total) })
      .finally(() => setLoading(false))
  }, [skip, typeFilter, statusFilter, tagFilter, sponsorFilter])

  function handleFilterChange() {
    setSkip(0)
    setSelectedId(null)
  }

  return (
    <div>
      <UpcomingSection bills={upcoming} />
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
              {meta?.tags?.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            Sponsored By
            <select value={sponsorFilter} onChange={e => { setSponsorFilter(e.target.value); handleFilterChange() }}>
              <option value="">All alders</option>
              {alders.map(a => (
                <option key={a.id} value={a.id}>
                  {`D${a.district} — ${a.name.replace('ALD. ', '').split(' ').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}`}
                </option>
              ))}
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
    </div>
  )
}

function BodyClasses() {
  const { settings } = useSettings()
  useEffect(() => {
    const el = document.documentElement
    el.classList.toggle('dyslexia-font', settings.dyslexiaFont)
    el.classList.toggle('large-text', settings.largeText)
    el.classList.toggle('high-contrast', settings.highContrast)
    el.classList.toggle('reduce-motion', settings.reduceMotion)
  }, [settings.dyslexiaFont, settings.largeText, settings.highContrast, settings.reduceMotion])
  return null
}

export default function App() {
  return (
    <div className="app">
      <BodyClasses />
      <Nav />
      <Routes>
        <Route path="/" element={<Docket />} />
        <Route path="/alders" element={<Alders />} />
        <Route path="/alders/:id" element={<AlderDetail />} />
        <Route path="/manage/:token" element={<ManageSubscription />} />
        <Route path="/about" element={<About />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/subscribe" element={<Subscribe />} />
      </Routes>
    </div>
  )
}
