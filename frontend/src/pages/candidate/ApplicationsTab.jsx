import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '../../components/Alert'
import EmptyState from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import Spinner from '../../components/Spinner'
import StatusBadge from '../../components/StatusBadge'
import { api, errorMessage } from '../../services/api'
import { formatDate } from '../../services/format'

const PAGE_SIZE = 10

const HINT = {
  submitted: 'Your application was received. The company will review it soon.',
  under_review: 'The company is reviewing your application.',
  approved_for_interview: 'You are invited to a short AI video interview (about 5-7 minutes).',
  rejected: 'The company decided not to move forward with this application.',
  interview_completed: 'Your interview was submitted. The company will review it and decide.',
  shortlisted: 'Good news: the company shortlisted you.',
  accepted: 'Congratulations! The company accepted you. Check your email for next steps.',
  on_hold: 'The company has put your application on hold.',
  final_rejected: 'The company decided not to move forward after your interview.',
}
// Ei status-gulo-te interview session thake, tai result dekhano jay
const HAS_INTERVIEW = ['interview_completed', 'shortlisted', 'accepted', 'on_hold', 'final_rejected']

function InterviewResult({ applicationId }) {
  const [r, setR] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.candidate.get(`/api/interviews/${applicationId}/result`)
      setR(data)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const deleteRecordings = async () => {
    if (!window.confirm('Delete your interview video/audio recordings? This cannot be undone. Your written transcript and report stay with the company.')) return
    setError('')
    try {
      const { data } = await api.candidate.post(`/api/candidates/me/interviews/${applicationId}/delete-recordings`)
      setInfo(`${data.deleted} recording(s) deleted.`)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  if (!r) {
    return (
      <>
        <Alert>{error}</Alert>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'View interview result'}
        </button>
      </>
    )
  }

  return (
    <div className="result-box">
      <Alert>{error}</Alert>
      <Alert type="success">{info}</Alert>
      {r.report_available ? (
        <>
          <div className="score">{Math.round(r.overall_score)}<span className="muted"> / 100</span></div>
          <p className="prewrap">{r.summary}</p>
          {r.strengths?.length > 0 && (<><h3>Strengths</h3><ul>{r.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></>)}
          {r.improvements?.length > 0 && (<><h3>Areas to improve</h3><ul>{r.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul></>)}
          <p className="muted">{r.limitations}</p>
        </>
      ) : (
        <p className="muted">
          {r.interview_status === 'evaluating' && 'Your interview is being evaluated. Please check again in a few minutes.'}
          {r.interview_status === 'failed' && 'Automatic evaluation is delayed. The company can still review your interview.'}
          {!['evaluating', 'failed'].includes(r.interview_status) && 'A detailed result is not available for this interview.'}
        </p>
      )}
      <button className="btn btn-danger btn-sm" onClick={deleteRecordings}>Delete my recordings</button>
    </div>
  )
}

export default function ApplicationsTab() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    api.candidate
      .get('/api/applications/mine', { params: { page, page_size: PAGE_SIZE } })
      .then((r) => alive && setData(r.data))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [page])

  if (loading) return <Spinner />
  if (error) return <Alert>{error}</Alert>
  if (data.items.length === 0) {
    return (
      <EmptyState title="No applications yet" text="Find a vacancy and apply in a few minutes.">
        <Link to="/jobs" className="btn btn-primary">Browse vacancies</Link>
      </EmptyState>
    )
  }

  return (
    <>
      <div className="stack">
        {data.items.map((a) => (
          <article key={a.id} className="card app-card">
            <div className="app-top">
              <div>
                <h3 style={{ margin: 0 }}><Link to={`/jobs/${a.vacancy_id}`}>{a.job_title}</Link></h3>
                <p className="muted" style={{ margin: 0 }}>
                  {a.company_name} · Applied {formatDate(a.applied_at)}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <p className="muted" style={{ margin: 0 }}>{HINT[a.status]}</p>

            {a.status === 'approved_for_interview' && (
              <div className="row-actions">
                <Link to={`/interview/start/${a.id}`} className="btn btn-primary btn-sm">Start interview</Link>
              </div>
            )}
            {HAS_INTERVIEW.includes(a.status) && <InterviewResult applicationId={a.id} />}
          </article>
        ))}
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
    </>
  )
}

