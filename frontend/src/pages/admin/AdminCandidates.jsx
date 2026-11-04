import { useEffect, useState } from 'react'
import Alert from '../../components/Alert'
import EmptyState from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'
import { formatDate, formatDateTime } from '../../services/format'

const PAGE_SIZE = 20

export default function AdminCandidates() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.admin.get('/api/admin/candidates', { params: { page, page_size: PAGE_SIZE } })
      .then((r) => alive && setData(r.data))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [page])

  return (
    <div className="stack">
      <h1>Candidates</h1>
      <p className="muted">{data.total} registered. Private details such as CVs and recordings are not shown here.</p>
      <Alert>{error}</Alert>
      {loading ? <Spinner /> : data.items.length === 0 ? <EmptyState title="No candidates yet" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Verified</th><th>Joined</th><th>Last login</th></tr></thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td>{c.full_name}</td><td>{c.email}</td><td>{c.phone}</td>
                  <td>{c.is_email_verified ? 'Yes' : 'No'}</td>
                  <td>{formatDate(c.created_at)}</td>
                  <td>{c.last_login_at ? formatDateTime(c.last_login_at) : 'Never'}</td>
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
