import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Alert from '../components/Alert'
import EmptyState from '../components/EmptyState'
import HomeAssistant from '../components/HomeAssistant'
import Spinner from '../components/Spinner'
import VacancyCard from '../components/VacancyCard'
import { api, errorMessage } from '../services/api'

const STEPS = [
  ['1', 'Find a role', 'Search open vacancies by title, company, skill or location. No account needed to browse.'],
  ['2', 'Apply in minutes', 'Create a profile, upload your CV and send your application with one form.'],
  ['3', 'Interview anywhere', 'Selected candidates complete a short AI-assisted video interview and a quick MCQ round from home.'],
]

export default function Home() {
  const [q, setQ] = useState('')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    api.public
      .get('/api/vacancies', { params: { page_size: 6 } })
      .then((r) => alive && setJobs(r.data.items))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const search = (e) => {
    e.preventDefault()
    navigate(q.trim() ? `/jobs?q=${encodeURIComponent(q.trim())}` : '/jobs')
  }

  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="eyebrow">AI-assisted hiring</span>
          <h1><span className="gradient-text">Find your next role.</span><br />Interview from anywhere.</h1>
          <p className="muted hero-sub">
            Browse open positions, apply in minutes, and complete a short AI-assisted interview.
            Fair, transparent, and decided by people.
          </p>
          <form className="searchbar" onSubmit={search} role="search">
            <label htmlFor="hero-q" className="sr-only">Search jobs</label>
            <input
              id="hero-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100}
              placeholder="Job title, company, skill or location"
            />
            <button className="btn btn-primary" type="submit">Search</button>
          </form>
        </div>
      </section>

      <HomeAssistant />

      <section className="container section">
        <div className="section-head">
          <h2>Latest vacancies</h2>
          <Link to="/jobs">View all</Link>
        </div>
        {loading && <Spinner />}
        <Alert>{error}</Alert>
        {!loading && !error && jobs.length === 0 && (
          <EmptyState title="No open vacancies yet" text="Please check back soon." />
        )}
        <div className="grid">
          {jobs.map((v) => <VacancyCard key={v.id} v={v} />)}
        </div>
      </section>

      <section className="container section">
        <h2>How it works</h2>
        <div className="steps">
          {STEPS.map(([n, t, d]) => (
            <div className="card" key={n}>
              <div className="step-num">{n}</div>
              <h3>{t}</h3>
              <p className="muted" style={{ margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="cta-band">
          <div>
            <h2 style={{ marginBottom: 4 }}>Hiring for your company?</h2>
            <p className="muted" style={{ margin: 0 }}>Post vacancies, review applicants and see structured interview reports in one place.</p>
          </div>
          <Link to="/company/register" className="btn btn-primary">Register your company</Link>
        </div>
      </section>
    </>
  )
}
