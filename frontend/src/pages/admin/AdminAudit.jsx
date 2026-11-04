import { useEffect, useState } from 'react'
import Alert from '../../components/Alert'
import EmptyState from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'
import { formatDateTime, pretty } from '../../services/format'

const PAGE_SIZE = 50

export default function AdminAudit() {
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.admin.get('/api/admin/audit-logs', { params: { page, page_size: PAGE_SIZE, ...(action ? { action } : {}) } })
      .then((r) => alive && setData(r.data))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [page, action])

  return (
    <div className="stack">
      <div className="section-head">
        <h1>Audit log</h1>
        <select aria-label="Filter by action" value={action} style={{ width: 'auto' }}
          onChange={(e) => { setAction(e.target.value); setPage(1) }}>
          <option value="">All actions</option>
          <option value="company_status_changed">Company status changed</option>
          <option value="vacancy_published">Vacancy published</option>
          <option value="vacancy_closed">Vacancy closed</option>
          <option value="application_status_changed">Application status changed</option>
          <option value="hiring_decision">Hiring decision</option>
          <option value="interview_submitted">Interview submitted</option>
          <option value="interview_consent_declined">Consent declined</option>
          <option value="recording_viewed">Recording viewed</option>
          <option value="recordings_deleted_by_user">Recordings deleted</option>
          <option value="account_deleted">Account deleted</option>
        </select>
      </div>
      <Alert>{error}</Alert>
      {loading ? <Spinner /> : data.items.length === 0 ? <EmptyState title="No log entries" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.created_at)}</td>
                  <td>{r.actor_role}{r.actor_id != null ? ` #${r.actor_id}` : ''}</td>
                  <td>{pretty(r.action)}</td>
                  <td>{r.entity_type ? `${r.entity_type} #${r.entity_id}` : '-'}</td>
                  <td className="muted">{r.details ? JSON.stringify(r.details) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
    </div>
  )
}
