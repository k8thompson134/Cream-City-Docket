import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { fetchAlder, fetchBill, legistarUrl } from '../api'
import type { AlderDetail as AlderDetailType, Bill, BillDetail, OfficeRecord, VoteRecord } from '../api'
import { usePageTitle } from '../usePageTitle'
import { AlderHeroSkeleton } from '../Skeletons'
import './Alders.css'

type Tab = 'bills' | 'votes' | 'issues' | 'history'

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

function formatName(raw: string) {
  return raw
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function districtLabel(d: string | null): string | null {
  if (!d || !/^\d+$/.test(d)) return null
  const n = parseInt(d)
  const suffix =
    n % 100 >= 11 && n % 100 <= 13 ? 'th'
    : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix} Aldermanic District`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function cleanSummary(text: string | null) {
  if (!text) return null
  const cleaned = text
    .split('\n')
    .filter(line => !line.trimStart().startsWith('#'))
    .join(' ')
    .trim()
  return cleaned || null
}

function BillCard({ bill, isSelected, onClick, detail, detailLoading, onClose }: {
  bill: Bill
  isSelected: boolean
  onClick: () => void
  detail: BillDetail | null
  detailLoading: boolean
  onClose: () => void
}) {
  const summary = cleanSummary(bill.summary)
  return (
    <div>
      <button
        className={`alder-bill-card${isSelected ? ' alder-bill-card--selected' : ''}`}
        onClick={onClick}
      >
        <div className="alder-bill-header">
          <span className="bill-type">{bill.matter_type}</span>
          <span
            className="bill-status"
            style={{ background: STATUS_COLORS[bill.matter_status] ?? '#444' }}
          >
            {bill.matter_status}
          </span>
          {bill.tags?.map(t => <span key={t} className="tag-chip">{t}</span>)}
        </div>
        <div className="alder-bill-title">{bill.title}</div>
        {summary && (
          <div className="alder-bill-summary">{summary}</div>
        )}
        <div className="alder-bill-meta">
          <span>{formatDate(bill.intro_date)}</span>
          {bill.file_number && <span>File #{bill.file_number}</span>}
          <span>{bill.body_name ?? '—'}</span>
          <a href={legistarUrl(bill)} target="_blank" rel="noreferrer" className="alder-legistar-link" onClick={e => e.stopPropagation()}>Legistar ↗</a>
        </div>
      </button>
      {isSelected && (
        <VoteDetailPanel detail={detail} voteValue={null} loading={detailLoading} onClose={onClose} />
      )}
    </div>
  )
}

const YEA_VALUES = new Set(['yea', 'aye', 'yes'])
const NAY_VALUES = new Set(['nay', 'no'])

function voteChipClass(value: string | null) {
  const v = (value ?? '').toLowerCase()
  if (YEA_VALUES.has(v)) return 'vote-chip vote-chip--yea'
  if (NAY_VALUES.has(v)) return 'vote-chip vote-chip--nay'
  return 'vote-chip vote-chip--abstain'
}

function voteCardClass(value: string | null) {
  const v = (value ?? '').toLowerCase()
  if (YEA_VALUES.has(v)) return 'alder-vote-card alder-vote-card--yea'
  if (NAY_VALUES.has(v)) return 'alder-vote-card alder-vote-card--nay'
  return 'alder-vote-card alder-vote-card--abstain'
}



const isYeaValue = (v: string | null) => ['yea', 'aye', 'yes'].includes((v ?? '').toLowerCase())
const isNayValue = (v: string | null) => ['nay', 'no'].includes((v ?? '').toLowerCase())

type VoteFilter = 'all' | 'yea' | 'nay' | 'other'

function VoteHistory({ votes, selectedId, onSelect, detail, detailLoading, onClose }: {
  votes: VoteRecord[]
  selectedId: number | null
  onSelect: (matterId: number, voteValue: string | null) => void
  detail: BillDetail | null
  detailLoading: boolean
  onClose: () => void
}) {
  const [filter, setFilter] = useState<VoteFilter>('all')

  if (votes.length === 0) {
    return (
      <div className="alder-empty">
        No vote history on record yet. Vote data is populated as new council meetings are polled.
      </div>
    )
  }

  const filtered = votes.filter(v => {
    if (filter === 'yea') return isYeaValue(v.vote_value)
    if (filter === 'nay') return isNayValue(v.vote_value)
    if (filter === 'other') return !isYeaValue(v.vote_value) && !isNayValue(v.vote_value)
    return true
  })

  const counts = {
    yea: votes.filter(v => isYeaValue(v.vote_value)).length,
    nay: votes.filter(v => isNayValue(v.vote_value)).length,
    other: votes.filter(v => !isYeaValue(v.vote_value) && !isNayValue(v.vote_value)).length,
  }

  return (
    <>
      <div className="vote-filter-bar">
        {(['all', 'yea', 'nay', 'other'] as VoteFilter[]).map(f => {
          const label = f === 'all' ? `All (${votes.length})` : f === 'yea' ? `Yea (${counts.yea})` : f === 'nay' ? `Nay (${counts.nay})` : `Other (${counts.other})`
          return (
            <button
              key={f}
              className={`vote-filter-btn vote-filter-btn--${f}${filter === f ? ' vote-filter-btn--active' : ''}`}
              onClick={() => { setFilter(f); onClose() }}
            >
              {label}
            </button>
          )
        })}
      </div>
      {filtered.length === 0 && (
        <div className="alder-empty">No {filter} votes on record.</div>
      )}
      {filtered.map((v, i) => {
        const summary = v.matter.summary
          ? v.matter.summary.split('\n').filter((l: string) => !l.trimStart().startsWith('#')).join(' ').trim()
          : null
        const isSelected = selectedId === v.matter.id
        return (
          <div key={i}>
            <button
              className={`${voteCardClass(v.vote_value)}${isSelected ? ' alder-vote-card--selected' : ''}`}
              onClick={() => onSelect(v.matter.id, v.vote_value)}
            >
              <div className="alder-vote-header">
                <span className={voteChipClass(v.vote_value)}>{v.vote_value ?? 'Unknown'}</span>
                <span className="alder-vote-date">{formatDate(v.voted_at)}</span>
              </div>
              <div className="alder-bill-title">{v.matter.title}</div>
              {summary && (
                <div className="alder-bill-summary">{summary}</div>
              )}
              <div className="alder-bill-header" style={{ marginTop: '0.5rem' }}>
                <span className="bill-type">{v.matter.matter_type}</span>
                <span
                  className="bill-status"
                  style={{ background: STATUS_COLORS[v.matter.matter_status] ?? '#444' }}
                >
                  {v.matter.matter_status}
                </span>
                {v.matter.tags?.map((t: string) => <span key={t} className="tag-chip">{t}</span>)}
              </div>
            </button>
            {isSelected && (
              <VoteDetailPanel
                detail={detail}
                voteValue={v.vote_value}
                loading={detailLoading}
                onClose={onClose}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

function VoteDetailPanel({ detail, voteValue, loading, onClose }: {
  detail: BillDetail | null
  voteValue: string | null
  loading: boolean
  onClose: () => void
}) {
  if (loading) return (
    <div className="vote-detail-panel">
      <div className="vd-skel vd-skel--chip" />
      <div className="vd-skel vd-skel--title" />
      <div className="vd-skel vd-skel--title-short" />
      <div style={{ display: 'flex', gap: '0.4rem', margin: '0.75rem 0 0.5rem' }}>
        <div className="vd-skel vd-skel--pill" />
        <div className="vd-skel vd-skel--pill" />
      </div>
      <div className="vd-skel vd-skel--line" />
      <div className="vd-skel vd-skel--line" />
      <div className="vd-skel vd-skel--line vd-skel--short" />
    </div>
  )
  if (!detail) return (
    <div className="vote-detail-panel">
      <div style={{ color: '#888', fontSize: '0.85rem' }}>Could not load bill detail.</div>
    </div>
  )

  const summary = detail.summary
    ? detail.summary.split('\n').filter(l => !l.trimStart().startsWith('#')).join(' ').trim()
    : null

  return (
    <div className="vote-detail-panel">
      <div className="vote-detail-header">
        <span className={voteChipClass(voteValue)}>{voteValue ?? 'Unknown'}</span>
        <button className="vote-detail-close" onClick={onClose} aria-label="Close detail">✕</button>
      </div>
      <div className="vote-detail-title">{detail.title}</div>
      <div className="vote-detail-badges">
        <span className="bill-type">{detail.matter_type}</span>
        <span className="bill-status" style={{ background: STATUS_COLORS[detail.matter_status] ?? '#444' }}>
          {detail.matter_status}
        </span>
      </div>
      {detail.tags.length > 0 && (
        <div className="vote-detail-tags">
          {detail.tags.map(t => <span key={t} className="tag-chip">{t}</span>)}
        </div>
      )}
      {summary && <div className="vote-detail-summary">{summary}</div>}
      {detail.history.length > 0 && (
        <div className="vote-detail-section">
          <div className="vote-detail-label">Timeline</div>
          {detail.history.map((h, i) => (
            <div key={i} className="vote-detail-row">
              <span>{h.action_name}</span>
              <span>{formatDate(h.action_date)}</span>
            </div>
          ))}
        </div>
      )}
      {detail.mayor_actions.length > 0 && (
        <div className="vote-detail-section">
          <div className="vote-detail-label">Mayor Action</div>
          {detail.mayor_actions.map((a, i) => (
            <div key={i} className="vote-detail-row">
              <span style={{ textTransform: 'capitalize' }}>{a.action_type}</span>
              <span>{formatDate(a.action_date)}</span>
            </div>
          ))}
        </div>
      )}
      <a href={legistarUrl(detail)} target="_blank" rel="noreferrer" className="vote-detail-legistar">
        View on Legistar ↗
      </a>
    </div>
  )
}

function rankLabel(rank: number, total: number): string {
  if (rank === 1) return total > 1 ? 'Most of any alder' : ''
  const suffix = rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'
  return `${rank}${suffix} of ${total}`
}

function IssueAreas({ bills, alderId, tagRanks }: {
  bills: Bill[]
  alderId: number
  tagRanks: Record<string, { rank: number; total: number }>
}) {
  const navigate = useNavigate()

  const tagCounts: Record<string, number> = {}
  for (const bill of bills) {
    for (const tag of bill.tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
    }
  }

  const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])
  const max = sorted[0]?.[1] ?? 1

  if (sorted.length === 0) {
    return (
      <div className="alder-empty">
        No issue areas tagged on sponsored bills yet.
      </div>
    )
  }

  return (
    <div className="issue-areas">
      {sorted.map(([tag, count]) => {
        const rankInfo = tagRanks[tag]
        const label = rankInfo ? rankLabel(rankInfo.rank, rankInfo.total) : ''
        return (
          <button
            key={tag}
            className="issue-area-row"
            onClick={() => navigate(`/?tag=${encodeURIComponent(tag)}&sponsored_by=${alderId}`)}
            aria-label={`View ${tag} bills sponsored by this alder`}
          >
            <div className="issue-area-tag-col">
              <span className="issue-area-tag">{tag}</span>
              {label && <span className="issue-area-rank">{label}</span>}
            </div>
            <div className="issue-area-bar-wrap">
              <div
                className="issue-area-bar"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="issue-area-count">{count} bill{count !== 1 ? 's' : ''}</span>
          </button>
        )
      })}
      <div className="issue-area-note">
        Click any issue area to see this alder's bills in that category on The Docket.
      </div>
    </div>
  )
}


function formatRoleDate(start: string | null, end: string | null, isCurrent: boolean) {
  const s = start ? new Date(start).getFullYear() : '?'
  if (isCurrent) return `${s} – present`
  const e = end ? new Date(end).getFullYear() : '?'
  return `${s} – ${e}`
}

function PoliticalHistory({ councilTerms, committeeRoles }: {
  councilTerms: OfficeRecord[]
  committeeRoles: OfficeRecord[]
}) {
  const oldest = councilTerms.at(-1)
  const firstYear = oldest?.start_date ? new Date(oldest.start_date).getFullYear() : null
  const yearsInOffice = firstYear ? new Date().getFullYear() - firstYear : null
  const currentTerm = councilTerms.find(t => t.is_current)
  const termExpiry = currentTerm?.end_date ? new Date(currentTerm.end_date).getFullYear() : null

  const currentRoles = committeeRoles.filter(r => r.is_current)
  const pastRoles = committeeRoles.filter(r => !r.is_current)

  return (
    <div className="political-history">
      {councilTerms.length > 0 && (
        <div className="ph-section">
          <div className="ph-section-label">Service Summary</div>
          <div className="ph-stats">
            {firstYear && (
              <div className="ph-stat">
                <div className="ph-stat-value">{firstYear}</div>
                <div className="ph-stat-label">First elected</div>
              </div>
            )}
            <div className="ph-stat">
              <div className="ph-stat-value">{councilTerms.length}</div>
              <div className="ph-stat-label">Term{councilTerms.length !== 1 ? 's' : ''} served</div>
            </div>
            {yearsInOffice !== null && (
              <div className="ph-stat">
                <div className="ph-stat-value">{yearsInOffice}</div>
                <div className="ph-stat-label">Years in office</div>
              </div>
            )}
            {termExpiry && (
              <div className="ph-stat">
                <div className="ph-stat-value">{termExpiry}</div>
                <div className="ph-stat-label">Term expires</div>
              </div>
            )}
          </div>
        </div>
      )}

      {committeeRoles.length > 0 && (
        <div className="ph-section">
          <div className="ph-section-label">Council Roles &amp; Committee Memberships</div>
          <div className="ph-roles">
            {currentRoles.map((r, i) => (
              <div key={i} className="ph-role ph-role--current">
                <span className="ph-role-dates">{formatRoleDate(r.start_date, r.end_date, true)}</span>
                <span className="ph-role-body">{r.body_name}</span>
                {r.title && r.title.toLowerCase() !== 'member' && (
                  <span className="ph-role-title">{r.title}</span>
                )}
              </div>
            ))}
            {pastRoles.map((r, i) => (
              <div key={i} className="ph-role">
                <span className="ph-role-dates">{formatRoleDate(r.start_date, r.end_date, false)}</span>
                <span className="ph-role-body">{r.body_name}</span>
                {r.title && r.title.toLowerCase() !== 'member' && (
                  <span className="ph-role-title">{r.title}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ph-section">
        <div className="ph-section-label">Election History</div>
        <div className="ph-election-placeholder">
          <p>Election results are not available through the Legistar API.</p>
          <a
            href="https://city.milwaukee.gov/election/ElectionResults"
            target="_blank"
            rel="noreferrer"
            className="ph-election-link"
          >
            View results on Milwaukee Elections Commission ↗
          </a>
        </div>
      </div>
    </div>
  )
}

export default function AlderDetail() {
  const { id } = useParams<{ id: string }>()
  const [alder, setAlder] = useState<AlderDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<Tab>('bills')
  const [selected, setSelected] = useState<{ matterId: number; voteValue: string | null } | null>(null)
  const [billDetail, setBillDetail] = useState<BillDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  function selectMatter(matterId: number, voteValue: string | null) {
    setSelected(prev => prev?.matterId === matterId ? null : { matterId, voteValue })
  }
  function switchTab(t: Tab) { setTab(t); setSelected(null); setBillDetail(null) }
  usePageTitle(alder ? formatName(alder.name) : undefined)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    fetchAlder(parseInt(id))
      .then(setAlder)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!selected) { setBillDetail(null); return }
    setDetailLoading(true)
    fetchBill(selected.matterId)
      .then(setBillDetail)
      .catch(err => {
        console.error('fetchBill failed:', selected.matterId, err)
        setBillDetail(null)
      })
      .finally(() => setDetailLoading(false))
  }, [selected])

  if (loading) return <AlderHeroSkeleton />
  if (error) return <div className="empty" style={{ padding: '4rem' }}>Could not load this alder — the API may be unavailable. Try refreshing.</div>
  if (!alder) return <div className="empty" style={{ padding: '4rem' }}>Alder not found.</div>

  const displayName = formatName(alder.name)
  const district = districtLabel(alder.district)
  const billCount = alder.sponsored_bills.length

  return (
    <div className="page-wrap">
      <div className="alder-hero">
        <div className="alder-breadcrumb">
          <Link to="/alders">Alders</Link>
          {district && <><span>›</span>{district}</>}
          <span>›</span>{displayName}
        </div>

        <div className="alder-hero-inner">
          {alder.photo_url
          ? <img src={alder.photo_url} alt={`${displayName}, ${district ?? 'Milwaukee Common Council'}`} className="alder-photo" />
          : <div className="alder-photo-placeholder" aria-hidden="true">Photo<br />N/A</div>
        }

          <div className="alder-hero-info">
            <div className="alder-hero-name">{displayName}</div>
            <div className="alder-hero-district">{district ?? 'Milwaukee Common Council'}</div>
            <div className="alder-hero-contact">
              {alder.email && (
                <span>✉ <a href={`mailto:${alder.email}`}>{alder.email}</a></span>
              )}
              {alder.phone && <span>✆ {alder.phone}</span>}
            </div>
            {(alder.website || alder.twitter || alder.facebook) && (
              <div className="alder-hero-links">
                {alder.website && <a href={alder.website} target="_blank" rel="noreferrer">🌐 Website ↗</a>}
                {alder.twitter && <a href={`https://twitter.com/${alder.twitter.replace('@','')}`} target="_blank" rel="noreferrer">𝕏 {alder.twitter}</a>}
                {alder.facebook && <a href={alder.facebook} target="_blank" rel="noreferrer">📘 Facebook ↗</a>}
              </div>
            )}
          </div>

          <div className="alder-hero-actions">
            <Link
              to={`/subscribe${alder.district ? `?district=${alder.district}` : ''}`}
              className="subscribe-district-btn"
            >
              Subscribe to {district ? `District ${alder.district}` : 'alerts'} →
            </Link>
          </div>
        </div>
      </div>

      <div className="alder-tabs" role="tablist" aria-label="Alder profile sections">
        <button role="tab" aria-selected={tab === 'bills'} aria-controls="tab-bills"
          className={`alder-tab${tab === 'bills' ? ' alder-tab--active' : ''}`}
          onClick={() => switchTab('bills')}
        >Sponsored Bills ({billCount})</button>
        <button role="tab" aria-selected={tab === 'votes'} aria-controls="tab-votes"
          className={`alder-tab${tab === 'votes' ? ' alder-tab--active' : ''}`}
          onClick={() => switchTab('votes')}
        >Vote History ({alder.vote_history.length})</button>
        <button role="tab" aria-selected={tab === 'issues'} aria-controls="tab-issues"
          className={`alder-tab${tab === 'issues' ? ' alder-tab--active' : ''}`}
          onClick={() => switchTab('issues')}
        >Issue Areas</button>
        <button role="tab" aria-selected={tab === 'history'} aria-controls="tab-history"
          className={`alder-tab${tab === 'history' ? ' alder-tab--active' : ''}`}
          onClick={() => switchTab('history')}
        >Political History</button>
      </div>

      <div className="alder-body">
        <div className="alder-main" role="tabpanel" id={`tab-${tab}`}>
          {tab === 'bills' && (
            <>
              {billCount === 0 && (
                <div className="alder-empty">No sponsored bills on record.</div>
              )}
              {alder.sponsored_bills.map(bill => (
                <BillCard
                  key={bill.id}
                  bill={bill}
                  isSelected={selected?.matterId === bill.id}
                  onClick={() => selectMatter(bill.id, null)}
                  detail={billDetail}
                  detailLoading={detailLoading}
                  onClose={() => setSelected(null)}
                />
              ))}
            </>
          )}


          {tab === 'votes' && (
            <VoteHistory
              votes={alder.vote_history}
              selectedId={selected?.matterId ?? null}
              onSelect={(matterId, voteValue) => selectMatter(matterId, voteValue)}
              detail={billDetail}
              detailLoading={detailLoading}
              onClose={() => setSelected(null)}
            />
          )}
          {tab === 'issues' && (
            <IssueAreas bills={alder.sponsored_bills} alderId={alder.id} tagRanks={alder.tag_ranks ?? {}} />
          )}
          {tab === 'history' && (
            <PoliticalHistory
              councilTerms={alder.council_terms ?? []}
              committeeRoles={alder.committee_roles ?? []}
            />
          )}
        </div>

        <aside className="alder-sidebar">
          <div className="alder-quick-facts">
            <h3>Quick Facts</h3>
            {(() => {
              const vh = alder.vote_history
              if (vh.length === 0) return null
              const nays = vh.filter(v => isNayValue(v.vote_value))
              const pct = Math.round(vh.filter(v => isYeaValue(v.vote_value)).length * 100 / vh.length)
              const sentence = nays.length === 0
                ? `Voted with the majority on all ${vh.length} recorded votes.`
                : `Voted with the majority on ${pct}% of ${vh.length} recorded votes, with ${nays.length} dissenting vote${nays.length === 1 ? '' : 's'}.`
              return (
                <div className="alder-fact-row alder-fact-row--full">
                  <span className="alder-vote-pattern">{sentence}</span>
                </div>
              )
            })()}
            {district && (
              <div className="alder-fact-row">
                <span className="alder-fact-label">District</span>
                <span className="alder-fact-value">{district}</span>
              </div>
            )}
            {alder.email && (
              <div className="alder-fact-row">
                <span className="alder-fact-label">Email</span>
                <span className="alder-fact-value">
                  <a href={`mailto:${alder.email}`}>{alder.email}</a>
                </span>
              </div>
            )}
            {alder.phone && (
              <div className="alder-fact-row">
                <span className="alder-fact-label">Phone</span>
                <span className="alder-fact-value">{alder.phone}</span>
              </div>
            )}
            {(() => {
              const terms = alder.council_terms ?? []
              if (terms.length === 0) return null
              const oldest = terms.at(-1)
              const firstYear = oldest?.start_date ? new Date(oldest.start_date).getFullYear() : null
              const years = firstYear ? new Date().getFullYear() - firstYear : null
              return (
                <>
                  {firstYear && (
                    <div className="alder-fact-row">
                      <span className="alder-fact-label">In office since</span>
                      <span className="alder-fact-value">{firstYear}</span>
                    </div>
                  )}
                  <div className="alder-fact-row">
                    <span className="alder-fact-label">Terms served</span>
                    <span className="alder-fact-value">{terms.length}{years ? ` · ${years} yrs` : ''}</span>
                  </div>
                </>
              )
            })()}
            <div className="alder-fact-row">
              <span className="alder-fact-label">Bills Sponsored</span>
              <span className="alder-fact-value">{billCount}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
