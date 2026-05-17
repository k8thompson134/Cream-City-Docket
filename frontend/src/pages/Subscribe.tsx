import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchMeta, fetchAlders } from '../api'
import type { Meta, Alder } from '../api'
import { usePageTitle } from '../usePageTitle'
import './Subscribe.css'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

const DIGEST_OPTIONS = [
  { value: 'daily', label: 'Daily Digest', desc: 'One email per day with all matching updates' },
  { value: 'weekly', label: 'Weekly Digest', desc: 'One email on Mondays with the week\'s updates' },
  { value: 'immediate', label: 'Immediate', desc: 'Individual email for every matching update (can be noisy)' },
]

const ALERT_TYPES = [
  'New bill introduced',
  'Committee hearing scheduled',
  'Full council vote upcoming',
  'Mayor signed or vetoed',
  'Veto override vote scheduled',
  'Bill amended — new substitute filed',
]

export default function Subscribe() {
  usePageTitle('Get Alerts', 'Subscribe to free email alerts for Milwaukee Common Council legislation. Choose issue areas, your aldermanic district, and how often you want to hear from us.')
  const [searchParams] = useSearchParams()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [alders, setAlders] = useState<Alder[]>([])

  // Form state
  const [email, setEmail] = useState('')
  const DEFAULT_TAGS = new Set(['Housing', 'Labor', 'Food Access'])
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(DEFAULT_TAGS))
  const [district, setDistrict] = useState(() => {
    const d = searchParams.get('district')
    if (d && /^\d+$/.test(d)) return d
    return ''
  })
  const [digestMode, setDigestMode] = useState('daily')
  const [priorityTags, setPriorityTags] = useState<Set<string>>(new Set())
  const [priorityDistrict, setPriorityDistrict] = useState(false)

  // UI state
  const [step, setStep] = useState<'form' | 'done' | 'manage'>('form')
  const [token, setToken] = useState<string | null>(null)
  const [emailError, setEmailError] = useState('')
  const [tagsError, setTagsError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Check for manage token in URL
  useEffect(() => {
    const t = searchParams.get('token')
    if (t) {
      setToken(t)
      loadExisting(t)
    }
    if (searchParams.get('action') === 'unsub' && t) {
      handleUnsubscribe(t)
    }
  }, [])

  useEffect(() => { fetchMeta().then(setMeta).catch(() => {}) }, [])
  useEffect(() => { fetchAlders().then(setAlders).catch(() => {}) }, [])

  async function loadExisting(t: string) {
    try {
      const res = await fetch(`${API_BASE}/api/subscribe/${t}`)
      if (!res.ok) throw new Error('Subscription not found')
      const data = await res.json()
      setEmail(data.email)
      setSelectedTags(new Set(data.tags))
      setDistrict(data.districts?.[0] ?? '')
      setDigestMode(data.digest_mode)
      setPriorityTags(new Set(data.priority_tags))
      setPriorityDistrict(data.priority_district)
      setStep('manage')
    } catch {
      setSubmitError('Could not load subscription. The link may be expired.')
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) {
        next.delete(tag)
        setPriorityTags(p => { const n = new Set(p); n.delete(tag); return n })
      } else {
        next.add(tag)
      }
      return next
    })
    setTagsError('')
  }

  function togglePriorityTag(tag: string) {
    setPriorityTags(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  function validate() {
    let ok = true
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address.')
      ok = false
    } else {
      setEmailError('')
    }
    if (selectedTags.size === 0 && !district) {
      setTagsError('Select at least one issue area or a district.')
      ok = false
    } else {
      setTagsError('')
    }
    return ok
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const body = {
        email,
        tags: Array.from(selectedTags),
        districts: district ? [district] : [],
        digest_mode: digestMode,
        priority_tags: Array.from(priorityTags),
        priority_district: priorityDistrict,
      }

      const url = token
        ? `${API_BASE}/api/subscribe/${token}`
        : `${API_BASE}/api/subscribe`
      const method = token ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Subscription failed')
      }
      const data = await res.json()
      if (data.token) setToken(data.token)
      setStep('done')
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUnsubscribe(t: string) {
    try {
      await fetch(`${API_BASE}/api/subscribe/${t}`, { method: 'DELETE' })
      setStep('form')
      setEmail('')
      setSelectedTags(new Set())
      setDistrict('')
      setPriorityTags(new Set())
      setToken(null)
      setSubmitError('')
      alert('You have been unsubscribed.')
    } catch {
      setSubmitError('Failed to unsubscribe')
    }
  }

  // Unique sorted districts from alders
  const districts = [...new Set(
    alders.filter(a => a.district).map(a => a.district!)
  )].sort((a, b) => parseInt(a) - parseInt(b))

  const issueTags = meta?.tags ?? [
    'Housing', 'Food Access', 'Policing and Public Safety', 'Labor',
    'Immigration', 'Transportation', 'Environment', 'Education',
    'Healthcare', 'Small Business', 'Budget and Finance', 'Land Use and Zoning',
  ]

  if (step === 'done') {
    return (
      <div className="page-wrap">
        <div className="page-hero">
          <h1>You're subscribed.</h1>
          <p>Check your inbox for a confirmation email.</p>
        </div>
        <div className="subscribe-done">
          <p>
            <strong>Delivery:</strong> {DIGEST_OPTIONS.find(o => o.value === digestMode)?.label}<br />
            <strong>Topics:</strong> {selectedTags.size > 0 ? Array.from(selectedTags).join(', ') : 'None'}<br />
            {district && <><strong>District:</strong> {district}<br /></>}
            {priorityTags.size > 0 && (
              <><strong>Priority alerts:</strong> {Array.from(priorityTags).join(', ')}<br /></>
            )}
          </p>
          <p>Update your preferences or unsubscribe any time using the link in any alert email.</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <a href="/" className="done-btn">Back to The Docket →</a>
            <button className="done-btn done-btn--edit" onClick={() => setStep(token ? 'manage' : 'form')}>Edit preferences</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <div className="page-hero">
        <h1>{step === 'manage' ? 'Manage your alerts.' : 'Get alerts before the vote.'}</h1>
        <p>Free email alerts. No account. No spam. Unsubscribe any time.</p>
      </div>

      <div className="subscribe-body">
        <form className="subscribe-form" onSubmit={handleSubmit} noValidate>

          {/* Step 1: Email */}
          <div className="subscribe-step">
            <div className="step-num">1</div>
            <div className="step-content">
              <label className="step-label" htmlFor="email-input">Your email address</label>
              <input
                id="email-input"
                className={`subscribe-input${emailError ? ' subscribe-input--error' : ''}`}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError('') }}
                disabled={step === 'manage'}
                autoComplete="email"
                aria-describedby={emailError ? 'email-error' : undefined}
                aria-invalid={!!emailError}
              />
              {emailError && <div className="field-error" id="email-error" role="alert">{emailError}</div>}
              <div className="field-hint">Only used to send alerts. Never shared.</div>
            </div>
          </div>

          {/* Step 2: Delivery frequency */}
          <div className="subscribe-step">
            <div className="step-num">2</div>
            <div className="step-content">
              <div className="step-label">Delivery frequency</div>
              <div className="field-hint" style={{ marginBottom: '0.85rem' }}>
                Control how often you receive emails. Daily digest is recommended to avoid inbox overload.
              </div>
              <div className="digest-options">
                {DIGEST_OPTIONS.map(opt => (
                  <label key={opt.value} className={`digest-option${digestMode === opt.value ? ' digest-option--active' : ''}`}>
                    <input
                      type="radio"
                      name="digest_mode"
                      value={opt.value}
                      checked={digestMode === opt.value}
                      onChange={() => setDigestMode(opt.value)}
                    />
                    <div>
                      <div className="digest-label">{opt.label}</div>
                      <div className="digest-desc">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3: Issue areas */}
          <div className="subscribe-step">
            <div className="step-num">3</div>
            <div className="step-content">
              <div className="step-label">Alert me about these issue areas</div>
              <div className="field-hint" style={{ marginBottom: '0.5rem' }}>Select all that apply. Bills are auto-tagged using AI.</div>
              <div className="tag-grid-header">
                <span className="field-hint">Housing, Labor, and Food Access selected by default.</span>
                <button type="button" className="deselect-all-btn" onClick={() => { setSelectedTags(new Set()); setPriorityTags(new Set()) }}>Deselect all</button>
              </div>
              {tagsError && <div className="field-error" role="alert">{tagsError}</div>}
              <div className="tag-grid">
                {issueTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag-toggle${selectedTags.has(tag) ? ' tag-toggle--on' : ''}`}
                    aria-pressed={selectedTags.has(tag)}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 4: District */}
          <div className="subscribe-step">
            <div className="step-num">4</div>
            <div className="step-content">
              <label className="step-label" htmlFor="district-select">
                Alert me about my aldermanic district
                <span className="step-optional">optional</span>
              </label>
              <div className="field-hint" style={{ marginBottom: '0.85rem' }}>Receive alerts for all legislation affecting your district, regardless of issue area.</div>
              <select
                id="district-select"
                className="subscribe-select"
                value={district}
                onChange={e => { setDistrict(e.target.value); setTagsError('') }}
              >
                <option value="">Select your district</option>
                {districts.map(d => <option key={d} value={d}>District {d}</option>)}
              </select>
              <div className="field-hint" style={{ marginTop: '0.6rem' }}>
                Not sure which district you're in?{' '}
                <a href="https://city.milwaukee.gov/der/residents/Aldermanic-District-Map.htm" target="_blank" rel="noreferrer">Find it on the city website ↗</a>
              </div>
            </div>
          </div>

          {/* Step 5: Priority alerts */}
          <div className="subscribe-step subscribe-step--priority">
            <div className="step-num step-num--priority">⚡</div>
            <div className="step-content">
              <div className="priority-header">
                <div className="step-label">Priority alerts</div>
                <span className="priority-badge">Bypasses digest</span>
              </div>
              <div className="field-hint" style={{ marginBottom: '0.85rem' }}>
                Get an <strong>instant individual email</strong> for these topics — even on daily or weekly digest.
                Perfect for issues you can't afford to miss.
              </div>

              {selectedTags.size === 0 && !district ? (
                <div className="priority-empty">
                  Select topics or a district above to enable priority alerts.
                </div>
              ) : (
                <>
                  {selectedTags.size > 0 && (
                    <div className="tag-grid" style={{ marginBottom: district ? '0.75rem' : 0 }}>
                      {Array.from(selectedTags).sort().map(tag => (
                        <button
                          key={tag}
                          type="button"
                          className={`tag-toggle tag-toggle--priority${priorityTags.has(tag) ? ' tag-toggle--priority-on' : ''}`}
                          aria-pressed={priorityTags.has(tag)}
                          onClick={() => togglePriorityTag(tag)}
                        >
                          {priorityTags.has(tag) && <span className="tag-bolt">⚡</span>}
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}

                  {district && (
                    <label className={`priority-district-toggle${!district ? ' priority-district-toggle--disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={priorityDistrict}
                        disabled={!district}
                        onChange={e => setPriorityDistrict(e.target.checked)}
                      />
                      <span>
                        Send priority alerts for bills in District {district}
                      </span>
                    </label>
                  )}
                </>
              )}
            </div>
          </div>

          {(selectedTags.size > 0 || district) && (
            <div className="subscribe-summary">
              <strong>You'll receive alerts for: </strong>
              {[...Array.from(selectedTags).sort(), district ? `District ${district}` : ''].filter(Boolean).join(', ')}
              {priorityTags.size > 0 && (
                <span> — immediate alerts for {Array.from(priorityTags).sort().join(', ')}</span>
              )}
              {' '}via {DIGEST_OPTIONS.find(o => o.value === digestMode)?.label.toLowerCase()}.
            </div>
          )}

          <div className="subscribe-submit-row">
            <button type="submit" className="subscribe-btn" disabled={submitting}>
              {submitting ? 'Saving…' : step === 'manage' ? 'Update Preferences' : 'Subscribe →'}
            </button>
            {step === 'manage' && token && (
              <button
                type="button"
                className="unsubscribe-btn"
                onClick={() => { if (confirm('Are you sure you want to unsubscribe?')) handleUnsubscribe(token) }}
              >
                Unsubscribe
              </button>
            )}
            {submitError && <div className="field-error">{submitError}</div>}
            <div className="field-hint">
              You'll receive a confirmation email. Update preferences any time via the link in every alert.
            </div>
          </div>

        </form>

        <aside className="subscribe-sidebar">
          <div className="sidebar-card">
            <h3>What kinds of alerts will I get?</h3>
            <ul className="alert-types">
              {ALERT_TYPES.map(a => <li key={a}>{a}</li>)}
            </ul>
          </div>
          <div className="sidebar-card sidebar-card--digest">
            <h3>About digest mode</h3>
            <p>Instead of getting one email per bill, your updates are batched into a single email — sent daily at 7 AM CT or weekly on Mondays.</p>
            <p style={{ marginTop: '0.5rem' }}><strong>Priority tags</strong> bypass the digest and send immediately, so you never miss urgent legislation.</p>
          </div>
          <div className="sidebar-card">
            <h3>Milwaukee's 15 districts</h3>
            <p>Each district elects one alder to a 4-year term. Selecting your district means you'll hear about legislation your alder sponsors or that directly affects your area.</p>
            <a
              href="https://city.milwaukee.gov/der/residents/Aldermanic-District-Map.htm"
              target="_blank"
              rel="noreferrer"
              className="sidebar-link"
            >
              City district map ↗
            </a>
          </div>
        </aside>
      </div>
    </div>
  )
}
