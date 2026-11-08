import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '../../components/Alert'
import EmptyState from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import Spinner from '../../components/Spinner'
import StatusBadge from '../../components/StatusBadge'
import { api, errorMessage } from '../../services/api'

const PAGE_SIZE = 20
const score = (v) => (v == null ? '-' : Number(v).toFixed(1))

// Explains why score is unavailable if test is pending or incomplete
function pending(status, kind) {
  if (kind === 'r1') {
    if (['submitted', 'evaluating'].includes(status)) return 'Evaluating'
    if (status === 'failed') return 'Failed'
    if (status === 'in_progress') return 'In progress'
  }
  return 'Not done'
}

export default function CompanyRanking() {
  const { id } = useParams()
  const [sort, setSort] = useState('combined')
  const [page, setPage] = useState(1)
  const [d, setD] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    api.company
      .get(`/api/company/vacancies/${id}/ranking`, { params: { sort, page, page_size: PAGE_SIZE } })
      .then((r) => alive && setD(r.data))
      .catch((e) => alive && setError(e.response?.status === 404 ? 'Vacancy not found.' : errorMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [id, sort, page])

  if (error && !d) return <div className="stack"><Alert>{error}</Alert><Link to="/company/vacancies">Back to vacancies</Link></div>
  if (!d) return <Spinner />

  const w = d.weights
  return (
    <div className="stack">
      <p><Link to="/company/vacancies">&larr; Back to vacancies</Link></p>
      <div className="section-head">
        <div>
          <h2 style={{ marginBottom: 4 }}>Ranking: {d.vacancy.title}</h2>
          <p className="muted" style={{ margin: 0 }}>
            Combined = Round 1 AI ({Math.round(w.round1 * 100)}%) + Round 2 MCQ ({Math.round(w.round2 * 100)}%).
            {' '}{d.complete_count} candidate(s) completed both rounds.
          </p>
        </div>
        <select aria-label="Sort by" value={sort} style={{ width: 'auto' }}
          onChange={(e) => { setSort(e.target.value); setPage(1) }}>
          <option value="combined">Combined score</option>
          <option value="round1">Round 1 (AI interview)</option>
          <option value="round2">Round 2 (MCQ)</option>
        </select>
      </div>

      <Alert type="info">{d.notice}</Alert>
      <Alert>{error}</Alert>

      {loading ? <Spinner /> : d.items.length === 0 ? (
        <EmptyState title="No scored candidates yet" text="Candidates appear here after they finish a round and it is scored." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Rank</th><th>Candidate</th><th>Round 1</th><th>Round 2</th><th>Combined</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {d.items.map((c) => (
                <tr key={c.application_id}>
                  <td>{c.rank ?? '-'}</td>
                  <td>{c.name}<div className="muted" style={{ fontSize: '0.85rem' }}>{c.email}</div></td>
                  <td>{c.round1 != null ? score(c.round1) : <span className="muted">{pending(c.round1_status, 'r1')}</span>}</td>
                  <td>{c.round2 != null ? score(c.round2) : <span className="muted">{pending(c.round2_status, 'r2')}</span>}</td>
                  <td>
                    {c.complete ? <strong>{score(c.combined)}</strong> : <span className="badge badge-warn">Partial</span>}
                  </td>
                  <td><StatusBadge status={c.application_status} /></td>
                  <td>
                    <Link className="btn btn-ghost btn-sm"
                      to={c.round1 != null ? `/company/applications/${c.application_id}/report` : `/company/applications/${c.application_id}`}>
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={d.total} onChange={setPage} />
    </div>
  )
}

