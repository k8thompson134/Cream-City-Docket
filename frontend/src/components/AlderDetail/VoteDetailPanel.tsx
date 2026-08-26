import type { BillDetail } from '../../api'
import { legistarUrl } from '../../api'
import { STATUS_COLORS, formatDate, voteChipClass } from './helpers'

export function VoteDetailPanel({ detail, voteValue, loading, onClose }: {
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
