import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '../../components/Alert'
import EmptyState from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'
import { formatDate, pretty } from '../../services/format'

const PAGE_SIZE = 20
const TONE = { published: 'badge-ok', draft: '', closed: 'badge-bad' }

export default function CompanyVacancies() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.company.get('/api/company/vacancies', {
        params: { page, page_size: PAGE_SIZE, ...(status ? { status } : {}) },
      })
      setData(data)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { load() }, [load])

  const act = async (v, action) => {
    if (action === 'close' && !window.confirm(`Close "${v.title}"? It will disappear from the public site.`)) return
    setError('')
    setInfo('')
    setBusyId(v.id)
    try {
      await api.company.post(`/api/company/vacancies/${v.id}/${action}`)
      setInfo(action === 'publish' ? 'Vacancy published.' : 'Vacancy closed.')
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="stack">
      <div className="section-head">
        <h2>Vacancies</h2>
        <div className="row-actions">
          <select aria-label="Filter by status" value={status} style={{ width: 'auto' }}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>
          <Link to="/company/vacancies/new" className="btn btn-primary">New vacancy</Link>
        </div>
      </div>
      <Alert>{error}</Alert>
      <Alert type="success">{info}</Alert>

      {loading ? <Spinner /> : data.items.length === 0 ? (
        <EmptyState title="No vacancies" text="Create a vacancy and publish it when you are ready." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Title</th><th>Status</th><th>Location</th><th>Deadline</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.items.map((v) => {
                const expired = v.deadline && new Date(v.deadline + 'T23:59:59') < new Date()
                return (
                  <tr key={v.id}>
                    <td>{v.title}</td>
                    <td>
                      <span className={`badge ${TONE[v.status] || ''}`}>{v.status}</span>
                      {v.status === 'published' && expired && <span className="badge badge-warn" style={{ marginLeft: 6 }}>expired</span>}
                    </td>
                    <td>{v.location} · {pretty(v.work_mode)}</td>
                    <td>{v.deadline ? formatDate(v.deadline) : '-'}</td>
                    <td>
                      <div className="row-actions">
                        {v.status !== 'closed' && <Link className="btn btn-ghost btn-sm" to={`/company/vacancies/${v.id}/edit`}>Edit</Link>}
                        {v.status !== 'published' && (
                          <button className="btn btn-primary btn-sm" disabled={busyId === v.id} onClick={() => act(v, 'publish')}>
                            {v.status === 'closed' ? 'Reopen' : 'Publish'}
                          </button>
                        )}
                        {v.status === 'published' && (
                          <button className="btn btn-danger btn-sm" disabled={busyId === v.id} onClick={() => act(v, 'close')}>Close</button>
                        )}
                        <Link className="btn btn-ghost btn-sm" to={`/company/applications?vacancy_id=${v.id}`}>Applicants</Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
    </div>
  )
}
