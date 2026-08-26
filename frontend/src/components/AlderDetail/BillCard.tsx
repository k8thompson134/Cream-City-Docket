import type { Bill, BillDetail } from '../../api'
import { legistarUrl } from '../../api'
import { STATUS_COLORS, cleanSummary, formatDate } from './helpers'
import { VoteDetailPanel } from './VoteDetailPanel'

export function BillCard({ bill, isSelected, onClick, detail, detailLoading, onClose }: {
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
