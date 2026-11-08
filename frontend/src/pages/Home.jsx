import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Alert from '../components/Alert'
import EmptyState from '../components/EmptyState'
import HomeAssistant from '../components/HomeAssistant'
import Spinner from '../components/Spinner'
import VacancyCard from '../components/VacancyCard'
import { useAuth } from '../hooks/useAuth'
import { api, errorMessage } from '../services/api'

// Scroll korle dhire dhire dekha dey
function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setOn(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect() } }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className={`reveal ${on ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>
}

const JOURNEY = [
  ['Upload your CV', 'Get a readiness score in seconds.'],
  ['See jobs that fit', 'A match % on every open role.'],
  ['Apply in minutes', 'One form, one CV.'],
  ['Interview from home', 'A short video interview and a quick MCQ.'],
]

const CATS = [
  ['Remote', 'remote', 'wm', '/jobs?work_mode=remote'],
  ['Hybrid', 'hybrid', 'wm', '/jobs?work_mode=hybrid'],
  ['On-site', 'onsite', 'wm', '/jobs?work_mode=onsite'],
  ['Internships', 'internship', 'et', '/jobs?employment_type=internship'],
  ['Full time', 'full_time', 'et', '/jobs?employment_type=full_time'],
  ['Part time', 'part_time', 'et', '/jobs?employment_type=part_time'],
]

const FEATURES = [
  ['b-lg', '✦', 'AI career assistant', 'Upload your CV and get a readiness score, matching jobs and a guided search, in English or Bengali.', '/#assistant', 'Try it'],
  ['b-lg', '🎥', 'Short video interview', 'Five to seven minutes, one answer at a time. Questions come from the role and your CV.', null],
  ['b-md', '📝', 'Round 2 MCQ', '10 questions, 3 minutes. The timer runs on the server and answers submit automatically.', null],
  ['b-md', '♥', 'Save for later', 'Tap the heart on any job and find it again in your dashboard.', '/jobs', 'Browse jobs'],
  ['b-md', '📊', 'CV match and prep', 'See match % and missing skills, plus topics an interviewer might ask from your CV.', '/recommend', 'Open job finder'],
  ['b-wide', '🛡', 'Privacy first', 'Clear consent before any recording. Only your words are evaluated. Delete recordings or your whole account any time.', null],
]

const FAIR = [
  'Only the words you say are evaluated.',
  'Your face, voice tone and accent are never scored.',
  'AI scores are advisory. People make the hiring decision.',
  'You give consent before any recording and can decline.',
  'Recordings are deleted automatically after the retention period, or earlier on request.',
]

const FAQ = [
  ['Do I need an account?', 'You can browse every vacancy without one. You need a free account to apply, save jobs and use the CV tools.'],
  ['Who can see my CV analysis?', 'Only you. A company sees your CV only for jobs you apply to.'],
  ['How is the AI interview scored?', 'The answers are turned into text and compared with a clear rubric. The score is advisory and the company decides.'],
  ['Can I say no to recording?', 'Yes. You can decline, and then contact the company about an alternative way to complete the step.'],
  ['What if my internet drops?', 'Tell the company. They can reopen your interview or test so you can try again.'],
  ['Which CV files work?', 'Text-based PDF or DOCX up to 5 MB. Scanned images cannot be read.'],
]

export default function Home() {
  const { users } = useAuth()
  const [q, setQ] = useState('')
  const [jobs, setJobs] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { hash } = useLocation()
  const first = users.candidate?.full_name?.split(' ')[0]

  useEffect(() => {
    let alive = true
    api.public.get('/api/vacancies', { params: { page_size: 6 } })
      .then((r) => alive && setJobs(r.data.items))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false))
    api.public.get('/api/public/stats').then((r) => alive && setStats(r.data)).catch(() => {})
    return () => { alive = false }
  }, [])

  // /#assistant link-e AI section-e scroll
  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 150)
    return () => clearTimeout(t)
  }, [hash])

  const search = (e) => {
    e.preventDefault()
    navigate(q.trim() ? `/jobs?q=${encodeURIComponent(q.trim())}` : '/jobs')
  }
  const count = (kind, key) => (stats ? (kind === 'wm' ? stats.by_work_mode : stats.by_employment_type)[key] || 0 : null)

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="hm-hero">
        <div className="hm-orb" aria-hidden="true" />
        <div className="container hm-hero-grid">
          <div>
            <span className="eyebrow">
              {first ? <>Welcome back, {first}</> : <><span className="live-dot" aria-hidden="true" /> AI-assisted hiring</>}
            </span>
            <h1 className="hm-title">Your next role, <span className="gradient-text">matched to you.</span></h1>
            <p className="muted hm-sub">
              Upload your CV, see which jobs fit, apply in minutes and interview from home.
              Fair, transparent and decided by people.
            </p>

            <form className="searchbar" onSubmit={search} role="search">
              <label htmlFor="hero-q" className="sr-only">Search jobs</label>
              <input id="hero-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100}
                placeholder="Job title, company, skill or location" />
              <button className="btn btn-primary" type="submit">Search</button>
            </form>

            {stats?.top_skills?.length > 0 && (
              <div className="hm-pop">
                <span className="muted">Popular:</span>
                {stats.top_skills.slice(0, 5).map((s) => (
                  <Link key={s.name} className="chip" to={`/jobs?q=${encodeURIComponent(s.name)}`}>{s.name}</Link>
                ))}
              </div>
            )}

            <div className="row-actions" style={{ marginTop: 22 }}>
              <a href="#assistant" className="btn btn-primary" onClick={(e) => { e.preventDefault(); document.getElementById('assistant')?.scrollIntoView({ behavior: 'smooth' }) }}>
                Check my CV with AI
              </a>
              {users.candidate
                ? <Link to="/dashboard" className="btn btn-ghost">My dashboard</Link>
                : <Link to="/register" className="btn btn-ghost">Create free account</Link>}
            </div>

            {stats && (
              <div className="hm-stats">
                <div className="hm-stat"><strong>{stats.open_jobs}</strong><span className="muted">Open jobs</span></div>
                <div className="hm-stat"><strong>{stats.companies_hiring}</strong><span className="muted">Companies hiring</span></div>
                <div className="hm-stat"><strong>{stats.by_work_mode?.remote || 0}</strong><span className="muted">Remote roles</span></div>
              </div>
            )}
          </div>

          <div className="hm-visual" aria-hidden="true">
            <div className="card journey float">
              <p className="journey-title">How it works for you</p>
              <div className="j-steps">
                {JOURNEY.map(([t, d], i) => (
                  <div className="j-step" key={t}>
                    <span className="j-num">{i + 1}</span>
                    <div><strong>{t}</strong><p className="muted" style={{ margin: 0 }}>{d}</p></div>
                  </div>
                ))}
              </div>
              <p className="journey-note muted">🔒 Your CV analysis is private to you.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Browse by ---------------- */}
      <section className="container section">
        <Reveal>
          <div className="section-head"><h2>Browse by type</h2><Link to="/jobs">All jobs</Link></div>
          <div className="hm-cats">
            {CATS.map(([name, key, kind, to]) => (
              <Link key={key} to={to} className="hm-cat">
                <strong>{name}</strong>
                <span className="muted">{count(kind, key) === null ? 'View jobs' : `${count(kind, key)} open`}</span>
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------------- AI assistant ---------------- */}
      <div id="assistant"><HomeAssistant /></div>

      {/* ---------------- Latest ---------------- */}
      <section className="container section">
        <div className="section-head"><h2>Latest vacancies</h2><Link to="/jobs">View all</Link></div>
        {loading && <Spinner />}
        <Alert>{error}</Alert>
        {!loading && !error && jobs.length === 0 && <EmptyState title="No open vacancies yet" text="Please check back soon." />}
        <div className="grid">{jobs.map((v) => <VacancyCard key={v.id} v={v} />)}</div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section className="container section">
        <Reveal><h2>Everything in one place</h2></Reveal>
        <div className="bento">
          {FEATURES.map(([size, icon, title, text, to, cta], i) => (
            <Reveal key={title} className={`bento-item ${size}`} delay={i * 60}>
              <div className="card bento-card">
                <span className="ft-icon" aria-hidden="true">{icon}</span>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
                {to && <Link to={to}>{cta} &rarr;</Link>}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- Fair by design ---------------- */}
      <section className="container section">
        <Reveal>
          <div className="hm-fair card">
            <div>
              <span className="eyebrow">Fair by design</span>
              <h2 style={{ marginTop: 12 }}>AI helps. People decide.</h2>
              <p className="muted">We use AI to organise and score answers consistently. We do not use it to judge who you are.</p>
            </div>
            <ul className="fair-list">
              {FAIR.map((t) => <li key={t}><span aria-hidden="true">✓</span>{t}</li>)}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* ---------------- Companies ---------------- */}
      <section className="container section">
        <Reveal>
          <div className="cta-band">
            <div>
              <h2 style={{ marginBottom: 6 }}>Hiring for your company?</h2>
              <p className="muted" style={{ margin: 0 }}>Post vacancies, review applicants, compare candidates with structured reports and export the list.</p>
            </div>
            <div className="row-actions">
              <Link to="/company/register" className="btn btn-primary">Register your company</Link>
              <Link to="/company/login" className="btn btn-ghost">Company sign in</Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="container section">
        <Reveal><h2>Questions</h2></Reveal>
        <div className="faq">
          {FAQ.map(([a, b]) => (
            <details key={a} className="card"><summary>{a}</summary><p className="muted">{b}</p></details>
          ))}
        </div>
      </section>

      {/* ---------------- Final CTA ---------------- */}
      <section className="container section">
        <Reveal>
          <div className="hm-final">
            <h2>Ready to find your next role?</h2>
            <div className="row-actions" style={{ justifyContent: 'center' }}>
              {users.candidate
                ? <Link to="/jobs" className="btn btn-primary">Browse jobs</Link>
                : <><Link to="/register" className="btn btn-primary">Create free account</Link><Link to="/jobs" className="btn btn-ghost">Browse jobs</Link></>}
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
