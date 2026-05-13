import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAlders } from '../api'
import type { Alder } from '../api'
import './Alders.css'

export default function Alders() {
  const [alders, setAlders] = useState<Alder[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAlders()
      .then(setAlders)
      .catch(err => setError(err.message))
  }, [])

  return (
    <div className="page-wrap">
      <div className="page-hero">
        <h1>Milwaukee Common Council</h1>
        <p>Alders representing all 15 districts</p>
      </div>

      <div className="page-container">
        <main className="page-body">
          {error && <div className="error">{error}</div>}
          {!alders && !error && <div className="loading">Loading alders…</div>}
          {alders && (
            <div className="alders-grid">
              {alders.map(alder => (
                <Link key={alder.id} to={`/alders/${alder.id}`} className="alder-card">
                  <div className="alder-card-district">District {alder.district}</div>
                  <div className="alder-card-name">{alder.name}</div>
                  {(alder.email || alder.phone) && (
                    <div className="alder-card-contact">
                      {alder.email && <div className="contact-item">{alder.email}</div>}
                      {alder.phone && <div className="contact-item">{alder.phone}</div>}
                    </div>
                  )}
                  <div className="alder-card-link">View profile →</div>
                </Link>
              ))}
            </div>
          )}
        </main>

        <aside className="page-sidebar">
          <div className="sidebar-card">
            <h3>What is the Common Council?</h3>
            <p>The Milwaukee Common Council is the legislative body of the City of Milwaukee. It consists of 15 aldermembers, one representing each district.</p>
            <p>The Council passes ordinances, approves the city budget, and oversees city operations.</p>
          </div>

          <div className="sidebar-card">
            <a href="#" className="sidebar-cta">Find your district →</a>
          </div>
        </aside>
      </div>
    </div>
  )
}
