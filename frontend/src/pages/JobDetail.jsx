import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '../components/Alert'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import { useAuth } from '../hooks/useAuth'
import { api, errorMessage } from '../services/api'
import { formatDate, pretty } from '../services/format'

function Block({ title, children }) {
  return (
    <section className="detail-block">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export default function JobDetail() {
  const { id } = useParams()
  const { users } = useAuth()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setNotFound(false)
    setError('')
    api.public
      .get(`/api/vacancies/${id}`)
      .then((r) => alive && setJob(r.data))
      .catch((e) => {
        if (!alive) return
        const s = e.response?.status
        if (s === 404 || s === 422) setNotFound(true)
        else setError(errorMessage(e))
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [id])

  if (loading) return <Spinner />
  if (notFound) {
    return (
      <div className="container section">
        <EmptyState title="Vacancy not available" text="It may be closed or the deadline has passed.">
          <Link to="/jobs" className="btn btn-primary">Browse other vacancies</Link>
        </EmptyState>
      </div>
    )
  }
  if (error) return <div className="container section"><Alert>{error}</Alert></div>
  if (!job) return null

  const skills = [...(job.required_skills || []), ...(job.required_technologies || [])]
  const site = job.company.website && /^https?:\/\//.test(job.company.website) ? job.company.website : null

  return (
    <div className="container section">
      <div className="detail-layout">
        <div>
          <h1>{job.title}</h1>
          <p className="muted">{job.company.company_name}{job.department ? ` · ${job.department}` : ''}</p>
          <div className="badges" style={{ marginBottom: 20 }}>
            <span className="badge">{pretty(job.work_mode)}</span>
            <span className="badge">{pretty(job.employment_type)}</span>
            <span className="badge">{job.location}</span>
            <span className="badge">{job.openings} opening{job.openings > 1 ? 's' : ''}</span>
          </div>

          <Block title="About the role"><p className="prewrap">{job.description}</p></Block>
          {job.responsibilities && <Block title="Responsibilities"><p className="prewrap">{job.responsibilities}</p></Block>}
          {skills.length > 0 && (
            <Block title="Required skills and technologies">
              <div className="tags">{skills.map((s) => <span className="tag" key={s}>{s}</span>)}</div>
            </Block>
          )}
          {job.education_requirements && <Block title="Education"><p className="prewrap">{job.education_requirements}</p></Block>}
          {job.experience_requirements && <Block title="Experience"><p>{job.experience_requirements}</p></Block>}
        </div>

        <aside className="card sticky-card">
          {job.salary_range && <p><strong>Salary:</strong> {job.salary_range}</p>}
          <p className="muted">
            {job.deadline ? `Apply by ${formatDate(job.deadline)}` : 'Open until filled'}
          </p>
          <Link to={`/jobs/${job.id}/apply`} className="btn btn-primary" style={{ width: '100%' }}>
            {users.candidate ? 'Apply now' : 'Sign in to apply'}
          </Link>
          <hr className="rule" />
          <h3>{job.company.company_name}</h3>
          <p className="muted">{job.company.industry} · {job.company.company_size} employees</p>
          {job.company.description && <p className="prewrap">{job.company.description}</p>}
          {site && <a href={site} target="_blank" rel="noopener noreferrer nofollow">Company website</a>}
        </aside>
      </div>
    </div>
  )
}

