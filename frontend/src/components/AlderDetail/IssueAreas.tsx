import { useNavigate } from 'react-router-dom'
import type { Bill } from '../../api'
import { rankLabel } from './helpers'

export function IssueAreas({ bills, alderId, tagRanks }: {
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
