import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ActivityFeed from '../components/ActivityFeed'
import Alert from '../components/Alert'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { api, errorMessage } from '../services/api'

const THEMES = [['dark', 'Dark', 'Black and gold'], ['light', 'Light', 'Warm and bright'], ['aurora', 'Aurora', 'Animated glow']]

const FEATURES = [
  ['✦', 'AI career assistant', 'Upload your CV on the home page for a readiness score, job fit and a guided search.', '/#assistant'],
  ['🔎', 'Job finder', 'Describe the job you want in English or Bengali, or use quick filters.', '/recommend'],
  ['📊', 'CV match and interview prep', 'See match % and missing skills per job, plus topics an interviewer might ask from your CV.', '/recommend'],
  ['💼', 'Browse and apply', 'Search every open vacancy and apply with one form.', '/jobs'],
  ['♥', 'Saved jobs', 'Save jobs and come back to them later.', '/dashboard?tab=saved'],
  ['📨', 'Application tracking', 'Follow every application from submitted to final decision.', '/dashboard'],
  ['🎥', 'Round 1: AI video interview', 'About 5 to 7 minutes, answer by answer. Starts from your invitation.', '/dashboard'],
  ['📝', 'Round 2: MCQ test', '10 questions in 3 minutes with an automatic submit when time ends.', '/dashboard'],
  ['🛡', 'Privacy controls', 'Delete interview recordings or your whole account any time.', '/dashboard?tab=settings'],
]

const EMAILS = [
  ['Email verification code', 'Always sent'],
  ['Application received', 'Always sent'],
  ['Interview invitation and Round 2 ready', 'Always sent'],
  ['Acceptance confirmation', 'Always sent'],
  ['Rejection emails', 'Sent only if the company turns this on in platform settings'],
]

export default function Settings() {
  const { users, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const c = users.candidate
  const [remind, setRemind] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    api.candidate.get('/api/candidates/me/preferences')
      .then((r) => alive && setRemind(r.data.reminder_emails))
      .catch((e) => alive && setErr(errorMessage(e)))
    return () => { alive = false }
  }, [])

  const toggleRemind = async () => {
    const next = !remind
    setRemind(next)
    setErr('')
    try {
      await api.candidate.put('/api/candidates/me/preferences', { reminder_emails: next })
    } catch (e) {
      setRemind(!next)
      setErr(errorMessage(e))
    }
  }

  const initials = (c.full_name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const out = () => { logout('candidate'); navigate('/') }

  return (
    <div className="container section stack settings">
      <div>
        <h1 style={{ marginBottom: 4 }}>Settings</h1>
        <p className="muted" style={{ margin: 0 }}>Your account, preferences and everything you can do on this site.</p>
      </div>

      <section className="card">
        <div className="profile-row">
          <div className="avatar-lg" aria-hidden="true">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>{c.full_name}</h2>
            <p className="muted" style={{ margin: 0, overflowWrap: 'anywhere' }}>{c.email} · {c.phone}</p>
            {c.is_email_verified && <span className="badge badge-ok" style={{ marginTop: 6 }}>Email verified</span>}
          </div>
          <div className="row-actions profile-actions">
            <Link to="/dashboard?tab=profile" className="btn btn-ghost btn-sm">Edit profile and CV</Link>
            <button className="btn btn-danger btn-sm" onClick={out}>Log out</button>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Appearance</h2>
        <div className="theme-opts" role="radiogroup" aria-label="Theme">
          {THEMES.map(([k, name, sub]) => (
            <button key={k} role="radio" aria-checked={theme === k} className={`theme-opt t-${k} ${theme === k ? 'on' : ''}`} onClick={() => setTheme(k)}>
              <span className="swatch" aria-hidden="true" />
              <strong>{name}</strong><span className="muted">{sub}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Email notifications</h2>
        <Alert>{err}</Alert>
        <label className="switch-row">
          <span>
            <strong>Reminder emails</strong>
            <span className="muted" style={{ display: 'block' }}>A nudge if you have an unfinished interview or Round 2 test.</span>
          </span>
          <input type="checkbox" role="switch" className="switch" checked={Boolean(remind)} disabled={remind === null} onChange={toggleRemind} />
        </label>
        <ul className="doc-list" style={{ marginTop: 14 }}>
          {EMAILS.map(([a, b]) => <li key={a}><span>{a}</span><span className="muted">{b}</span></li>)}
        </ul>
      </section>

      <section className="card">
        <div className="section-head"><h2>Recent activity</h2></div>
        <ActivityFeed limit={10} />
      </section>

      <section>
        <h2>What you can do here</h2>
        <div className="feature-grid">
          {FEATURES.map(([icon, title, text, to]) => (
            <Link key={title} to={to} className="card feature-tile">
              <span className="ft-icon" aria-hidden="true">{icon}</span>
              <strong>{title}</strong>
              <span className="muted">{text}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Privacy and security</h2>
        <p className="muted">Your CV, recordings and reports are visible only to the company you applied to. Your CV analysis and saved jobs are visible only to you.</p>
        <div className="row-actions">
          <Link to="/dashboard?tab=settings" className="btn btn-ghost btn-sm">Change password</Link>
          <Link to="/dashboard?tab=settings" className="btn btn-danger btn-sm">Delete account</Link>
        </div>
      </section>
    </div>
  )
}

