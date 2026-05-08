import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { subscribeToAlerts } from '../api'
import { usePageTitle } from '../usePageTitle'
import './Subscribe.css'

const ISSUE_TAGS = [
  'Housing', 'Food Access', 'Policing and Public Safety', 'Labor',
  'Immigration', 'Transportation', 'Environment', 'Education',
  'Healthcare', 'Small Business', 'Budget and Finance', 'Land Use and Zoning',
]

const DISTRICTS = Array.from({ length: 15 }, (_, i) => `District ${i + 1}`)

const ALERT_TYPES = [
  'New bill introduced',
  'Committee hearing scheduled',
  'Full council vote upcoming',
  'Mayor signed or vetoed',
  'Veto override vote scheduled',
  'Bill amended — new substitute filed',
]

type Step = 'form' | 'done'

export default function Subscribe() {
  usePageTitle('Get Alerts')
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [district, setDistrict] = useState(() => {
    const d = searchParams.get('district')
    if (d && /^\d+$/.test(d)) {
      const candidate = `District ${d}`
      return DISTRICTS.includes(candidate) ? candidate : ''
    }
    return ''
  })
  const [emailError, setEmailError] = useState('')
  const [tagsError, setTagsError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function toggleTag(tag: string) {
    setSelectedTags(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
    setTagsError('')
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
      await subscribeToAlerts({ email, tags: Array.from(selectedTags), district: district || null })
      setStep('done')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="page-wrap">
        <div className="page-hero">
          <h1>You're subscribed.</h1>
          <p>Check your inbox for a confirmation email.</p>
        </div>
        <div className="subscribe-done">
          <p>You'll get alerts when Milwaukee legislation matching your preferences is introduced, scheduled for a hearing, or voted on.</p>
          <p>Update your preferences or unsubscribe any time using the link in any alert email.</p>
          <a href="/" className="done-btn">Back to The Docket →</a>
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <div className="page-hero">
        <h1>Get alerts before the vote.</h1>
        <p>Free email alerts. No account. No spam. Unsubscribe any time.</p>
      </div>

      <div className="subscribe-body">
        <form className="subscribe-form" onSubmit={handleSubmit} noValidate>

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
                autoComplete="email"
                aria-describedby={emailError ? 'email-error' : undefined}
                aria-invalid={!!emailError}
              />
              {emailError && <div className="field-error" id="email-error" role="alert">{emailError}</div>}
              <div className="field-hint">Only used to send alerts. Never shared.</div>
            </div>
          </div>

          <div className="subscribe-step">
            <div className="step-num">2</div>
            <div className="step-content">
              <div className="step-label">Alert me about these issue areas</div>
              <div className="field-hint" style={{ marginBottom: '0.85rem' }}>Select all that apply. Bills are auto-tagged using AI.</div>
              {tagsError && <div className="field-error" role="alert">{tagsError}</div>}
              <div className="tag-grid">
                {ISSUE_TAGS.map(tag => (
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

          <div className="subscribe-step">
            <div className="step-num">3</div>
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
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="field-hint" style={{ marginTop: '0.6rem' }}>
                Not sure which district you're in?{' '}
                <a href="https://city.milwaukee.gov/der/residents/Aldermanic-District-Map.htm" target="_blank" rel="noreferrer">Find it on the city website ↗</a>
              </div>
            </div>
          </div>

          <div className="subscribe-submit-row">
            <button type="submit" className="subscribe-btn" disabled={submitting}>
              {submitting ? 'Subscribing…' : 'Subscribe →'}
            </button>
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
