import { useEffect, useState } from 'react'
import { fetchMayor, legistarUrl } from '../api'
import type { MayorProfile, MayorActionRecord } from '../api'
import { usePageTitle } from '../usePageTitle'
import './Mayor.css'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const ACTION_META: Record<string, { label: string; className: string }> = {
  signed:    { label: 'Signed',    className: 'mayor-badge--signed' },
  vetoed:    { label: 'Vetoed',    className: 'mayor-badge--vetoed' },
  lapsed:    { label: 'Lapsed',    className: 'mayor-badge--lapsed' },
  published: { label: 'Published', className: 'mayor-badge--published' },
}

function ActionBadge({ type }: { type: string }) {
  const meta = ACTION_META[type.toLowerCase()] ?? { label: type, className: 'mayor-badge--lapsed' }
  return <span className={`mayor-badge ${meta.className}`}>{meta.label}</span>
}

function ActionRow({ action }: { action: MayorActionRecord }) {
  return (
    <div className="mayor-action-row">
      <span className="mayor-action-date">{formatDate(action.action_date)}</span>
      <ActionBadge type={action.action_type} />
      <div className="mayor-action-info">
        <div className="mayor-action-title">{action.matter.title}</div>
        <div className="mayor-action-meta">
          {action.matter.file_number && <span>File #{action.matter.file_number}</span>}
          {action.matter.body_name && <span>{action.matter.body_name}</span>}
          <a
            href={legistarUrl(action.matter)}
            target="_blank"
            rel="noreferrer"
            className="mayor-action-legistar"
          >
            Legistar ↗
          </a>
        </div>
      </div>
    </div>
  )
}

export default function Mayor() {
  usePageTitle('Mayor', 'Cavalier Johnson\'s legislative action history — bills signed, vetoed, and lapsed. Milwaukee mayor actions from the Common Council.')
  const [mayor, setMayor] = useState<MayorProfile | null>(null)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchMayor()
      .then(setMayor)
      .catch(() => setError(true))
  }, [])

  if (error) return (
    <div className="page-wrap">
      <div className="loading">Could not load mayor data. The API may be unavailable.</div>
    </div>
  )

  if (!mayor) return (
    <div className="page-wrap">
      <div className="loading">Loading…</div>
    </div>
  )

  const filtered = filter === 'all'
    ? mayor.actions
    : mayor.actions.filter(a => a.action_type.toLowerCase() === filter)

  const totalActions = mayor.stats.signed + mayor.stats.vetoed + mayor.stats.lapsed + mayor.stats.published

  return (
    <div className="page-wrap">
      <div className="mayor-hero">
        <div className="mayor-hero-inner">
          {mayor.photo_url && (
            <img
              src={mayor.photo_url}
              alt={mayor.name}
              className="mayor-photo"
            />
          )}
          <div className="mayor-hero-info">
            <div className="mayor-hero-name">{mayor.name}</div>
            <div className="mayor-hero-title">{mayor.title}</div>
            <p className="mayor-hero-bio">{mayor.bio}</p>
            <div className="mayor-hero-contact">
              <span>📍 {mayor.address}</span>
              <span>📞 <a href={`tel:${mayor.phone}`}>{mayor.phone}</a></span>
              <span>🕐 {mayor.hours}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mayor-stats-bar">
        <button
          className={`mayor-stat${filter === 'all' ? ' mayor-stat--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          <span className="mayor-stat-count">{totalActions}</span>
          <span className="mayor-stat-label">Total Actions</span>
        </button>
        <button
          className={`mayor-stat mayor-stat--signed${filter === 'signed' ? ' mayor-stat--active' : ''}`}
          onClick={() => setFilter('signed')}
        >
          <span className="mayor-stat-count">{mayor.stats.signed}</span>
          <span className="mayor-stat-label">Signed</span>
        </button>
        <button
          className={`mayor-stat mayor-stat--vetoed${filter === 'vetoed' ? ' mayor-stat--active' : ''}`}
          onClick={() => setFilter('vetoed')}
        >
          <span className="mayor-stat-count">{mayor.stats.vetoed}</span>
          <span className="mayor-stat-label">Vetoed</span>
        </button>
        <button
          className={`mayor-stat mayor-stat--lapsed${filter === 'lapsed' ? ' mayor-stat--active' : ''}`}
          onClick={() => setFilter('lapsed')}
        >
          <span className="mayor-stat-count">{mayor.stats.lapsed}</span>
          <span className="mayor-stat-label">Lapsed</span>
        </button>
        {mayor.stats.published > 0 && (
          <button
            className={`mayor-stat mayor-stat--published${filter === 'published' ? ' mayor-stat--active' : ''}`}
            onClick={() => setFilter('published')}
          >
            <span className="mayor-stat-count">{mayor.stats.published}</span>
            <span className="mayor-stat-label">Published</span>
          </button>
        )}
      </div>

      <div className="mayor-body">
        <div className="mayor-main">
          {filtered.length === 0 ? (
            <div className="mayor-empty">No {filter} actions on record.</div>
          ) : (
            <div className="mayor-actions-list">
              {filtered.map((a, i) => (
                <ActionRow key={i} action={a} />
              ))}
            </div>
          )}
        </div>

        <aside className="mayor-sidebar">
          <div className="mayor-sidebar-card">
            <h3>How mayoral actions work</h3>
            <dl className="mayor-glossary">
              <dt>Signed</dt>
              <dd>The mayor signs the bill and it becomes law.</dd>
              <dt>Vetoed</dt>
              <dd>The mayor rejects the bill. The Common Council can override with 10 of 15 votes (⅔ majority).</dd>
              <dt>Lapsed</dt>
              <dd>The mayor takes no action within the required window. The bill becomes law without signature.</dd>
              <dt>Published</dt>
              <dd>The bill is published in the official city record, marking the start of its effective date window.</dd>
            </dl>
          </div>
          <div className="mayor-sidebar-card">
            <h3>Veto override</h3>
            <p>If the mayor vetoes a bill, the Common Council can override the veto with 10 votes — two-thirds of the 15 alders. Override votes are tracked in the bill's legislative timeline.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
