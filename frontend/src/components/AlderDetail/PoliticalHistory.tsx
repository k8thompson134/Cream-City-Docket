import type { ElectionRecord, OfficeRecord } from '../../api'
import { formatRoleDate } from './helpers'

export function PoliticalHistory({ councilTerms, committeeRoles, electionRecords }: {
  councilTerms: OfficeRecord[]
  committeeRoles: OfficeRecord[]
  electionRecords: ElectionRecord[]
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
        {electionRecords.length === 0 ? (
          <div className="ph-election-placeholder">
            <p>No election records on file yet.</p>
            <a href="https://city.milwaukee.gov/election/ElectionResults" target="_blank" rel="noreferrer" className="ph-election-link">
              Milwaukee Elections Commission ↗
            </a>
          </div>
        ) : (
          <div className="ph-election-table">
            <div className="ph-election-header">
              <span>Year</span>
              <span>Election</span>
              <span>Result</span>
              <span>Vote %</span>
              <span>Opponents</span>
            </div>
            {electionRecords.map((r, i) => (
              <div key={i} className={`ph-election-row${r.result === 'lost' ? ' ph-election-row--lost' : ''}`}>
                <span className="ph-election-year">{r.year}{r.notes ? <span className="ph-election-note" title={r.notes}>*</span> : null}</span>
                <span className="ph-election-type">{r.election_type === 'primary' ? 'Primary' : 'General'}</span>
                <span className={`ph-election-result ph-election-result--${r.result}`}>
                  {r.result === 'won' ? (r.was_uncontested ? 'Won (uncontested)' : 'Won') : 'Lost'}
                </span>
                <span className="ph-election-pct">{r.vote_pct !== null ? `${r.vote_pct}%` : '—'}</span>
                <span className="ph-election-opponents">{r.opponent_count}</span>
              </div>
            ))}
            <div className="ph-election-source">
              Source: Milwaukee City Elections Commission ·
              {electionRecords.some(r => r.notes) && ' * See notes ·'}
              {' '}<a href="https://city.milwaukee.gov/election/ElectionResults" target="_blank" rel="noreferrer">Full results ↗</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
