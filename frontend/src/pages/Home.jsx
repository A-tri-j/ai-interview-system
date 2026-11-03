import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Alert from '../components/Alert'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import VacancyCard from '../components/VacancyCard'
import { api, errorMessage } from '../services/api'

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
          <h1>Find your next role. Interview from anywhere.</h1>
          <p className="muted hero-sub">
            Browse open positions, apply in minutes, and complete a short AI-assisted video interview.
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
    </>
  )
}
