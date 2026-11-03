import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Alert from '../../components/Alert'
import EmptyState from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import Spinner from '../../components/Spinner'
import StatusBadge from '../../components/StatusBadge'
import { api, errorMessage } from '../../services/api'
import { formatDate } from '../../services/format'

const PAGE_SIZE = 20
const STATUSES = [
  ['', 'All statuses'], ['submitted', 'Submitted'], ['under_review', 'Under review'],
  ['approved_for_interview', 'Interview invited'], ['rejected', 'Rejected'],
  ['interview_completed', 'Interview completed'], ['shortlisted', 'Shortlisted'],
  ['accepted', 'Accepted'], ['on_hold', 'On hold'], ['final_rejected', 'Final rejected'],
]

export default function CompanyApplications() {
  const [params, setParams] = useSearchParams()
  const vacancyId = params.get('vacancy_id') || ''
  const status = params.get('status') || ''
  const [page, setPage] = useState(1)
  const [vacancies, setVacancies] = useState([])
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.company.get('/api/company/vacancies', { params: { page_size: 100 } })
      .then((r) => setVacancies(r.data.items))
      .catch(() => {}) // filter list na ashleo page kaj korbe
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    api.company
      .get('/api/company/applications', {
        params: { page, page_size: PAGE_SIZE, ...(vacancyId ? { vacancy_id: vacancyId } : {}), ...(status ? { status } : {}) },
      })
      .then((r) => alive && setData(r.data))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [page, vacancyId, status])

  const change = (key) => (e) => {
    const next = new URLSearchParams(params)
    if (e.target.value) next.set(key, e.target.value)
    else next.delete(key)
    setParams(next)
    setPage(1)
  }

  return (
    <div className="stack">
      <div className="section-head">
        <h2>Applicants</h2>
        <div className="row-actions">
          <select aria-label="Filter by vacancy" value={vacancyId} onChange={change('vacancy_id')} style={{ width: 'auto', maxWidth: 220 }}>
            <option value="">All vacancies</option>
            {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
          <select aria-label="Filter by status" value={status} onChange={change('status')} style={{ width: 'auto' }}>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <Alert>{error}</Alert>

      {loading ? <Spinner /> : data.items.length === 0 ? (
        <EmptyState title="No applicants found" text="Applications will appear here when candidates apply." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Candidate</th><th>Vacancy</th><th>Applied</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id}>
                  <td>{a.applicant_name}<div className="muted" style={{ fontSize: '0.85rem' }}>{a.applicant_email}</div></td>
                  <td>{a.vacancy_title}</td>
                  <td>{formatDate(a.applied_at)}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td><Link className="btn btn-ghost btn-sm" to={`/company/applications/${a.id}`}>Review</Link></td>
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

