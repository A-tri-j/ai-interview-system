import { useEffect, useState } from 'react'
import Alert from '../../components/Alert'
import EmptyState from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'
import { formatDate } from '../../services/format'

const PAGE_SIZE = 20
const TONE = { published: 'badge-ok', closed: 'badge-bad', draft: '' }

export default function AdminVacancies() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.admin.get('/api/admin/vacancies', { params: { page, page_size: PAGE_SIZE, ...(status ? { status } : {}) } })
      .then((r) => alive && setData(r.data))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [page, status])

  return (
    <div className="stack">
      <div className="section-head">
        <h1>Vacancies</h1>
        <select aria-label="Filter by status" value={status} style={{ width: 'auto' }}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <Alert>{error}</Alert>
      {loading ? <Spinner /> : data.items.length === 0 ? <EmptyState title="No vacancies" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Title</th><th>Company</th><th>Status</th><th>Deadline</th><th>Created</th></tr></thead>
            <tbody>
              {data.items.map((v) => (
                <tr key={v.id}>
                  <td>{v.title}</td><td>{v.company}</td>
                  <td><span className={`badge ${TONE[v.status] || ''}`}>{v.status}</span></td>
                  <td>{v.deadline ? formatDate(v.deadline) : '-'}</td>
                  <td>{formatDate(v.created_at)}</td>
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
