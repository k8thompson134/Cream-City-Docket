import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchAlder, fetchBill } from '../api'
import type { AlderDetail as AlderDetailType, BillDetail } from '../api'
import { alderInitials, alderAvatarColor } from '../utils'
import { usePageTitle } from '../usePageTitle'
import { AlderHeroSkeleton } from '../Skeletons'
import { BillCard } from '../components/AlderDetail/BillCard'
import { VoteHistory } from '../components/AlderDetail/VoteHistory'
import { IssueAreas } from '../components/AlderDetail/IssueAreas'
import { PoliticalHistory } from '../components/AlderDetail/PoliticalHistory'
import { districtLabel, formatName, isNayValue, isYeaValue } from '../components/AlderDetail/helpers'
import './Alders.css'

type Tab = 'bills' | 'votes' | 'issues' | 'history'

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
    const controller = new AbortController()
    setDetailLoading(true)
    fetchBill(selected.matterId)
      .then(d => { if (!controller.signal.aborted) setBillDetail(d) })
      .catch(err => {
        if (!controller.signal.aborted) {
          console.error('fetchBill failed:', selected.matterId, err)
          setBillDetail(null)
        }
      })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
    return () => controller.abort()
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
          : <div className="alder-photo-placeholder" aria-hidden="true" style={{ background: alderAvatarColor(alder.name) }}>{alderInitials(alder.name)}</div>
        }

          <div className="alder-hero-info">
            <div className="alder-hero-name">{displayName}</div>
            <div className="alder-hero-district">{district ?? 'Milwaukee Common Council'}</div>
            {alder.focus_summary && (
              <p className="alder-hero-focus">{alder.focus_summary}</p>
            )}
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
              electionRecords={alder.election_records ?? []}
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
              const currentTerm = terms.find(t => t.is_current)
              const termStart = currentTerm?.start_date ? new Date(currentTerm.start_date).getFullYear() : null
              const termExpiry = currentTerm?.end_date ? new Date(currentTerm.end_date).getFullYear() : null
              return (
                <>
                  {firstYear && (
                    <div className="alder-fact-row">
                      <span className="alder-fact-label">In office since</span>
                      <span className="alder-fact-value">{firstYear}{years ? ` · ${years} yrs` : ''}</span>
                    </div>
                  )}
                  {termStart && (
                    <div className="alder-fact-row">
                      <span className="alder-fact-label">Current term</span>
                      <span className="alder-fact-value">
                        Since {termStart}{termExpiry ? ` · expires ${termExpiry}` : ''}
                      </span>
                    </div>
                  )}
                  <div className="alder-fact-row">
                    <span className="alder-fact-label">Terms served</span>
                    <span className="alder-fact-value">{terms.length}</span>
                  </div>
                </>
              )
            })()}
            {(() => {
              const current = (alder.committee_roles ?? []).filter(r => r.is_current)
              if (current.length === 0) return null
              return (
                <div className="alder-fact-row">
                  <span className="alder-fact-label">Committees</span>
                  <span className="alder-fact-value">
                    {current.map((r, i) => {
                      const isChair = r.title && !['member', 'alderman', 'alderwoman', 'alderperson'].includes(r.title.toLowerCase())
                      return (
                        <span key={i} className="alder-committee-row">
                          {r.body_name}
                          {isChair && <span className="alder-committee-role">{r.title}</span>}
                        </span>
                      )
                    })}
                  </span>
                </div>
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
