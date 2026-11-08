import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '../../components/Alert'
import Field from '../../components/Field'
import Spinner from '../../components/Spinner'
import StatusBadge from '../../components/StatusBadge'
import RetakePanel from './RetakePanel'
import { api, errorMessage } from '../../services/api'
import { formatDate } from '../../services/format'

// Backend-er ALLOWED_TRANSITIONS-er moto
const NEXT = {
  submitted: ['under_review', 'approved_for_interview', 'rejected'],
  under_review: ['approved_for_interview', 'rejected'],
}
const LABEL = {
  under_review: 'Mark under review',
  approved_for_interview: 'Approve for interview',
  rejected: 'Reject',
}
const HAS_INTERVIEW = ['interview_completed', 'shortlisted', 'accepted', 'on_hold', 'final_rejected']

function InterviewProgress({ appId }) {
  const [s, setS] = useState(null)
  useEffect(() => {
    api.company.get(`/api/company/applications/${appId}/interview-status`)
      .then((r) => setS(r.data)).catch(() => {})
  }, [appId])
  let text = 'Interview invitation sent. The candidate has not opened the interview yet.'
  if (s?.consent_declined) text = 'The candidate declined recording. Contact them to arrange an alternative way to complete this step.'
  else if (s?.session_status === 'in_progress') text = 'The candidate is taking the interview now.'
  else if (s?.session_status === 'consented') text = 'The candidate accepted the recording consent and has not started yet.'
  return <Alert type="info">{text}</Alert>
}

export default function CompanyApplicationDetail() {
  const { id } = useParams()
  const [a, setA] = useState(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data } = await api.company.get(`/api/company/applications/${id}`)
      setA(data)
      setNotes(data.company_notes || '')
    } catch (e) {
      setError(e.response?.status === 404 ? 'Application not found.' : errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const setStatus = async (status) => {
    if (status === 'rejected' && !window.confirm('Reject this application?')) return
    if (status === 'approved_for_interview' && !window.confirm('Approve and email an interview invitation to the candidate?')) return
    setError('')
    setInfo('')
    setBusy(true)
    try {
      await api.company.patch(`/api/company/applications/${id}/status`, { status })
      setInfo(status === 'approved_for_interview' ? 'Approved. An interview invitation was emailed.' : 'Status updated.')
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const saveNotes = async () => {
    setError('')
    setInfo('')
    try {
      await api.company.put(`/api/company/applications/${id}/notes`, { note: notes })
      setInfo('Notes saved.')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  // Fetch CV with Authorization header as blob
  const downloadCv = async () => {
    setError('')
    try {
      const res = await api.company.get(`/api/company/applications/${id}/cv`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = a.cv_filename || 'cv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) {
      setError(e.response?.status === 404 ? 'The CV file is not available.' : 'Could not download the CV.')
    }
  }

  if (loading) return <Spinner />
  if (!a) return <div className="stack"><Alert>{error}</Alert><Link to="/company/applications">Back to applicants</Link></div>

  const actions = NEXT[a.status] || []
  const p = a.profile
  return (
    <div className="stack">
      <p><Link to="/company/applications">&larr; Back to applicants</Link></p>
      <Alert>{error}</Alert>
      <Alert type="success">{info}</Alert>

      <section className="card">
        <div className="app-top">
          <div>
            <h2 style={{ margin: 0 }}>{a.applicant_name}</h2>
            <p className="muted" style={{ margin: 0 }}>Applied for {a.vacancy_title} on {formatDate(a.applied_at)}</p>
          </div>
          <StatusBadge status={a.status} />
        </div>
        <hr className="rule" />
        <dl className="kv">
          <dt>Email</dt><dd>{a.applicant_email}</dd>
          <dt>Phone</dt><dd>{a.applicant_phone}</dd>
          <dt>Education</dt><dd className="prewrap">{a.education}</dd>
          {a.message && (<><dt>Message</dt><dd className="prewrap">{a.message}</dd></>)}
          {p.skills.length > 0 && (<><dt>Skills</dt><dd><div className="tags">{p.skills.map((s) => <span className="tag" key={s}>{s}</span>)}</div></dd></>)}
          {p.experience && (<><dt>Experience</dt><dd className="prewrap">{p.experience}</dd></>)}
          {p.projects && (<><dt>Projects</dt><dd className="prewrap">{p.projects}</dd></>)}
          {p.portfolio_url && /^https?:\/\//.test(p.portfolio_url) && (
            <><dt>Portfolio</dt><dd><a href={p.portfolio_url} target="_blank" rel="noopener noreferrer nofollow">{p.portfolio_url}</a></dd></>
          )}
        </dl>
        {a.cv_filename && <button className="btn btn-ghost" onClick={downloadCv}>Download CV ({a.cv_filename})</button>}
      </section>

      {actions.length > 0 && (
        <section className="card">
          <h2>Review</h2>
          <div className="row-actions">
            {actions.map((s) => (
              <button key={s} disabled={busy}
                className={`btn ${s === 'approved_for_interview' ? 'btn-primary' : s === 'rejected' ? 'btn-danger' : 'btn-ghost'}`}
                onClick={() => setStatus(s)}>
                {LABEL[s]}
              </button>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            Approving emails the candidate an interview invitation. Rejecting does not email them unless that is turned on in settings.
          </p>
        </section>
      )}

      {a.status === 'approved_for_interview' && <InterviewProgress appId={a.id} />}
      {HAS_INTERVIEW.includes(a.status) && (
        <section className="card">
          <h2>Interview</h2>
          <Link className="btn btn-primary" to={`/company/applications/${a.id}/report`}>View interview report</Link>
        </section>
      )}

      {['approved_for_interview', 'interview_completed', 'shortlisted', 'on_hold'].includes(a.status) && (
        <RetakePanel appId={a.id} onChanged={load} />
      )}

      <section className="card">
        <h2>Internal notes</h2>
        <Field id="notes" label="Only your company can see these notes" >
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} />
        </Field>
        <button className="btn btn-ghost" onClick={saveNotes}>Save notes</button>
      </section>
    </div>
  )
}

