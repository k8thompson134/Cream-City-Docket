import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAlders } from '../api'
import type { Alder } from '../api'
import { usePageTitle } from '../usePageTitle'
import { AlderGridSkeleton } from '../Skeletons'
import './Alders.css'

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
  return `${n}${suffix} District`
}

export default function Alders() {
  usePageTitle('Council Members')
  const [alders, setAlders] = useState<Alder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchAlders()
      .then(data => {
        data.sort((a, b) => {
          const da = a.district && /^\d+$/.test(a.district) ? parseInt(a.district) : 999
          const db = b.district && /^\d+$/.test(b.district) ? parseInt(b.district) : 999
          return da - db
        })
        setAlders(data)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-wrap">
      <div className="page-hero">
        <h1>Milwaukee Common Council</h1>
      </div>

      <div className="alders-grid-wrap">
        {loading && <AlderGridSkeleton />}
        {!loading && error && (
          <div className="loading">Could not load alders — the API may be unavailable.</div>
        )}
        {!loading && !error && alders.length === 0 && (
          <div className="loading">No alders found.</div>
        )}
        {!loading && !error && alders.length > 0 && (
          <div className="alders-grid">
            {alders.map(a => {
              const district = districtLabel(a.district)
              return (
                <Link key={a.id} to={`/alders/${a.id}`} className="alder-card">
                  {district && (
                    <div className="alder-card-district">{district}</div>
                  )}
                  <div className="alder-card-name">{formatName(a.name)}</div>
                  {(a.email || a.phone) && (
                    <div className="alder-card-contact">
                      {a.email && <span>✉ {a.email}</span>}
                      {a.phone && <span>✆ {a.phone}</span>}
                    </div>
                  )}
                  <div className="alder-card-cta">View profile →</div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
