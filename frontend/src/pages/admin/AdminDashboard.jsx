import { useEffect, useState } from 'react'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'
import { pretty } from '../../services/format'

function Stat({ label, value }) {
  return (
    <div className="card stat">
      <div className="stat-num">{value ?? 0}</div>
      <div className="muted">{label}</div>
    </div>
  )
}

function Breakdown({ title, data }) {
  const rows = Object.entries(data || {})
  return (
    <section className="card">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="muted">No data yet.</p> : (
        <ul className="doc-list">
          {rows.map(([k, n]) => (
            <li key={k}><span style={{ textTransform: 'capitalize' }}>{pretty(k)}</span><strong>{n}</strong></li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([api.admin.get('/api/admin/stats'), api.admin.get('/api/admin/activity')])
      .then(([s, a]) => { if (alive) { setStats(s.data); setActivity(a.data) } })
      .catch((e) => alive && setError(errorMessage(e)))
    return () => { alive = false }
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!stats || !activity) return <Spinner />

  return (
    <div className="stack">
      <h1>Dashboard</h1>
      <div className="grid" style={{ marginTop: 0 }}>
        <Stat label="Candidates" value={stats.candidates} />
        <Stat label="Companies" value={stats.companies} />
        <Stat label="Vacancies" value={stats.vacancies} />
        <Stat label="Applications" value={stats.applications} />
      </div>
      {stats.companies_by_status?.pending_approval > 0 && (
        <Alert type="info">{stats.companies_by_status.pending_approval} company registration(s) are waiting for your approval.</Alert>
      )}
      <div className="form-grid">
        <Breakdown title="Companies by status" data={stats.companies_by_status} />
        <Breakdown title="Applications by status" data={activity.applications_by_status} />
        <Breakdown title="Interviews by status" data={activity.interviews_by_status} />
      </div>
    </div>
  )
}
