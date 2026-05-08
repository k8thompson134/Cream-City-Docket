import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { fetchSubscription, updateSubscription, deleteSubscription } from '../api'
import type { Subscription } from '../api'
import './Subscribe.css'

const ISSUE_TAGS = [
  'Housing', 'Food Access', 'Policing and Public Safety', 'Labor',
  'Immigration', 'Transportation', 'Environment', 'Education',
  'Healthcare', 'Small Business', 'Budget and Finance', 'Land Use and Zoning',
]

const DISTRICTS = Array.from({ length: 15 }, (_, i) => `District ${i + 1}`)

type Screen = 'loading' | 'error' | 'form' | 'saved' | 'unsubscribed'

export default function ManageSubscription() {
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const [screen, setScreen] = useState<Screen>('loading')
  const [sub, setSub] = useState<Subscription | null>(null)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [district, setDistrict] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setScreen('error'); return }
    fetchSubscription(token)
      .then(data => {
        setSub(data)
        setSelectedTags(new Set(data.tags))
        setDistrict(data.district ?? '')
        // Auto-unsubscribe if ?action=unsubscribe in URL
        if (searchParams.get('action') === 'unsubscribe') {
          handleUnsubscribe(token)
        } else {
          setScreen('form')
        }
      })
      .catch(() => setScreen('error'))
  }, [token])

  async function handleUnsubscribe(t: string) {
    setSubmitting(true)
    try {
      await deleteSubscription(t)
      setScreen('unsubscribed')
    } catch {
      setError('Something went wrong. Please try again.')
      setScreen('form')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (selectedTags.size === 0 && !district) {
      setError('Select at least one issue area or district.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await updateSubscription(token!, { tags: Array.from(selectedTags), district: district || null })
      setScreen('saved')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
    setError('')
  }

  if (screen === 'loading') {
    return (
      <div className="page-wrap">
        <div className="page-hero"><h1>Manage Alerts</h1></div>
        <div className="subscribe-body"><div className="loading">Loading your preferences…</div></div>
      </div>
    )
  }

  if (screen === 'error') {
    return (
      <div className="page-wrap">
        <div className="page-hero"><h1>Link not found</h1><p>This link may have expired or already been used.</p></div>
        <div className="subscribe-body">
          <div>
            <p style={{ marginBottom: '1rem' }}>If you'd like to update your alerts, subscribe again with your email address.</p>
            <a href="/subscribe" className="subscribe-btn" style={{ display: 'inline-block' }}>Subscribe →</a>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'unsubscribed') {
    return (
      <div className="page-wrap">
        <div className="page-hero"><h1>You've been unsubscribed.</h1><p>You won't receive any more alerts from Cream City Docket.</p></div>
        <div className="subscribe-body">
          <div>
            <p style={{ marginBottom: '1rem', color: '#555' }}>Changed your mind? Subscribe again any time.</p>
            <a href="/subscribe" className="subscribe-btn" style={{ display: 'inline-block' }}>Subscribe →</a>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'saved') {
    return (
      <div className="page-wrap">
        <div className="page-hero"><h1>Preferences saved.</h1><p>Your alert preferences have been updated.</p></div>
        <div className="subscribe-body">
          <div>
            <a href="/" className="subscribe-btn" style={{ display: 'inline-block' }}>Back to The Docket →</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <div className="page-hero">
        <h1>Manage your alerts.</h1>
        <p>Alerts for {sub?.email}</p>
      </div>

      <div className="subscribe-body">
        <form className="subscribe-form" onSubmit={handleSave} noValidate>

          <div className="subscribe-step">
            <div className="step-label">Issue areas</div>
            <div className="field-hint" style={{ marginBottom: '0.75rem' }}>Select all that apply.</div>
            {error && <div className="field-error">{error}</div>}
            <div className="tag-grid">
              {ISSUE_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-toggle${selectedTags.has(tag) ? ' tag-toggle--on' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="subscribe-step">
            <div className="step-label">Aldermanic district <span className="step-optional">(optional)</span></div>
            <select
              className="subscribe-select"
              value={district}
              onChange={e => { setDistrict(e.target.value); setError('') }}
            >
              <option value="">No district</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" className="subscribe-btn" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save preferences →'}
            </button>
            <button
              type="button"
              className="subscribe-btn"
              style={{ background: 'transparent', color: '#888', border: '1px solid #ccc' }}
              disabled={submitting}
              onClick={() => token && handleUnsubscribe(token)}
            >
              Unsubscribe
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
