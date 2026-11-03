import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'
import { pretty } from '../../services/format'

function Stat({ label, value }) {
  return (
    <div className="card stat">
      <div className="stat-num">{value}</div>
      <div className="muted">{label}</div>
    </div>
  )
}

export default function CompanyOverview() {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api.company.get('/api/company/dashboard')
      .then((r) => alive && setD(r.data))
      .catch((e) => alive && setError(errorMessage(e)))
    return () => { alive = false }
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!d) return <Spinner />

  const v = d.vacancies_by_status || {}
  const a = d.applications_by_status || {}
  return (
    <div className="stack">
      <div className="grid" style={{ marginTop: 0 }}>
        <Stat label="Published vacancies" value={v.published || 0} />
        <Stat label="Draft vacancies" value={v.draft || 0} />
        <Stat label="Closed vacancies" value={v.closed || 0} />
        <Stat label="Total applications" value={d.applications_total} />
      </div>
      <section className="card">
        <h2>Hiring progress</h2>
        {d.applications_total === 0 ? (
          <p className="muted">No applications yet. <Link to="/company/vacancies/new">Post your first vacancy</Link>.</p>
        ) : (
          <ul className="doc-list">
            {Object.entries(a).map(([k, n]) => (
              <li key={k}><span style={{ textTransform: 'capitalize' }}>{pretty(k)}</span><strong>{n}</strong></li>
            ))}
          </ul>
        )}
        <Link to="/company/applications" className="btn btn-ghost btn-sm">View applicants</Link>
      </section>
    </div>
  )
}

