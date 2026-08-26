import { useState } from 'react'
import type { BillDetail, VoteRecord } from '../../api'
import { STATUS_COLORS, formatDate, isNayValue, isYeaValue, voteCardClass, voteChipClass } from './helpers'
import { VoteDetailPanel } from './VoteDetailPanel'

type VoteFilter = 'all' | 'yea' | 'nay' | 'other'

export function VoteHistory({ votes, selectedId, onSelect, detail, detailLoading, onClose }: {
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
