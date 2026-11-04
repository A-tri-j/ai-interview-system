import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '../../components/Alert'
import Field from '../../components/Field'
import Spinner from '../../components/Spinner'
import StatusBadge from '../../components/StatusBadge'
import { api, errorMessage } from '../../services/api'
import { formatDate } from '../../services/format'

const DECIDABLE = ['interview_completed', 'shortlisted', 'on_hold']
const CRITERIA = [['technical', 'Technical'], ['relevance', 'Relevance'], ['problem_solving', 'Problem solving'], ['clarity', 'Clarity']]
const DECISIONS = [
  ['shortlisted', 'Shortlist', 'btn-ghost'],
  ['on_hold', 'Put on hold', 'btn-ghost'],
  ['accepted', 'Accept', 'btn-primary'],
  ['rejected', 'Reject', 'btn-danger'],
]

// Recording: R2 hole signed URL, local hole Authorization diye blob
function RecordingPlayer({ recId }) {
  const [src, setSrc] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const blobUrl = useRef('')
  useEffect(() => () => { if (blobUrl.current) URL.revokeObjectURL(blobUrl.current) }, [])

  const load = async () => {
    setBusy(true)
    setErr('')
    try {
      const { data } = await api.company.get(`/api/company/recordings/${recId}/url`)
      if (data.signed) {
        setSrc(data.url)
      } else {
        const res = await api.company.get(data.url, { responseType: 'blob' })
        if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
        blobUrl.current = URL.createObjectURL(res.data)
        setSrc(blobUrl.current)
      }
    } catch (e) {
      setErr(e.response?.status === 404 ? 'The recording is no longer available.' : errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {!src && <button className="btn btn-ghost btn-sm" onClick={load} disabled={busy}>{busy ? 'Loading...' : 'Play recording'}</button>}
      {src && <video src={src} controls playsInline className="report-video" />}
      <Alert>{err}</Alert>
    </div>
  )
}

export default function CompanyReport() {
  const { id } = useParams()
  const [d, setD] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async (quiet = false) => {
    try {
      const { data } = await api.company.get(`/api/company/applications/${id}/report`)
      setD(data)
      if (!quiet) setNote(data.company_notes || '')
    } catch (e) {
      if (!quiet) setError(e.response?.status === 404 ? 'No submitted interview for this application yet.' : errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Evaluation cholar somoy 8 second por por refresh
  const sstatus = d?.session?.status
  useEffect(() => {
    if (!['submitted', 'evaluating'].includes(sstatus)) return
    const t = setInterval(() => load(true), 8000)
    return () => clearInterval(t)
  }, [sstatus, load])

  const retry = async () => {
    setError('')
    setInfo('')
    try {
      await api.company.post(`/api/company/applications/${id}/report/retry`)
      setInfo('Evaluation restarted. This page refreshes automatically.')
      setTimeout(() => load(true), 1500)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const saveNote = async () => {
    setError('')
    setInfo('')
    try {
      await api.company.put(`/api/company/applications/${id}/notes`, { note })
      setInfo('Note saved.')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const decide = async (decision, label) => {
    if (!window.confirm(`${label} this candidate?${decision === 'accepted' ? ' A confirmation email will be sent.' : ''}`)) return
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const { data } = await api.company.patch(`/api/company/applications/${id}/decision`, {
        decision, note: note.trim() || null,
        message: decision === 'accepted' && msg.trim() ? msg.trim() : null,
      })
      setInfo(!data.changed ? 'No change: that decision was already recorded.'
        : decision === 'accepted' ? 'Accepted. A confirmation email was sent to the candidate.' : 'Decision saved.')
      await load(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  if (!d) return <div className="stack"><Alert>{error}</Alert><Link to={`/company/applications/${id}`}>Back to application</Link></div>

  const r = d.report
  const canDecide = DECIDABLE.includes(d.application_status)
  return (
    <div className="stack">
      <p><Link to={`/company/applications/${id}`}>&larr; Back to application</Link></p>
      <Alert type="info">{d.advisory_notice}</Alert>
      <Alert>{error}</Alert>
      <Alert type="success">{info}</Alert>

      <section className="card">
        <div className="app-top">
          <div>
            <h2 style={{ margin: 0 }}>{d.candidate.name}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {d.vacancy.title} · {d.candidate.email} · {d.candidate.phone}
              {d.session.submitted_at ? ` · Submitted ${formatDate(d.session.submitted_at)}` : ''}
            </p>
          </div>
          <StatusBadge status={d.application_status} />
        </div>
      </section>

      {!r && (
        <section className="card">
          <h2>AI evaluation</h2>
          {['submitted', 'evaluating'].includes(d.session.status) && <p className="muted">Evaluation is in progress. This page refreshes automatically.</p>}
          {d.session.status === 'failed' && <Alert>{d.session.error || 'Evaluation failed.'}</Alert>}
          {d.session.status !== 'completed' && (
            <button className="btn btn-ghost btn-sm" onClick={retry}>Retry evaluation</button>
          )}
          <p className="muted" style={{ marginTop: 10 }}>You can still read the transcripts and play the recordings below.</p>
        </section>
      )}

      {r && (
        <section className="card">
          <h2>AI summary (advisory)</h2>
          <div className="score">{Math.round(r.overall_score)}<span className="muted"> / 100</span></div>
          <p className="prewrap">{r.summary}</p>
          <div className="form-grid">
            <div>
              <h3>Strengths</h3>
              {r.strengths.length ? <ul>{r.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted">None listed.</p>}
            </div>
            <div>
              <h3>Areas for improvement</h3>
              {r.improvements.length ? <ul>{r.improvements.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted">None listed.</p>}
            </div>
          </div>
          <p className="muted">{r.limitations}</p>
          <p className="muted" style={{ fontSize: '0.8rem' }}>Rubric {r.rubric_version} · {r.model}</p>
          <button className="btn btn-ghost btn-sm" onClick={retry}>Re-run evaluation</button>
        </section>
      )}

      <section className="stack">
        <h2 style={{ marginBottom: 0 }}>Questions and answers</h2>
        {d.questions.map((q) => (
          <article key={q.order} className="card">
            <div className="badges" style={{ marginBottom: 8 }}>
              <span className="badge">Q{q.order}</span>
              <span className="badge">{q.category}</span>
              {q.kind === 'followup' && <span className="badge badge-warn">Follow-up</span>}
            </div>
            <h3>{q.question}</h3>
            <p className="prewrap">{q.transcript || <span className="muted">No transcribed answer.</span>}</p>

            {q.scores && (
              <div className="score-grid">
                {CRITERIA.map(([k, label]) => (
                  <div key={k} className="score-cell"><div className="muted">{label}</div><strong>{Number(q.scores[k]).toFixed(1)}</strong></div>
                ))}
                <div className="score-cell score-total"><div className="muted">Overall /10</div><strong>{Number(q.scores.overall).toFixed(1)}</strong></div>
              </div>
            )}
            {q.feedback && <p style={{ marginTop: 12 }}>{q.feedback}</p>}
            {q.evidence.length > 0 && q.evidence.map((e, i) => <blockquote className="quote" key={i}>{e}</blockquote>)}
            {q.expected_points.length > 0 && (
              <details>
                <summary>Expected points (hidden from candidate)</summary>
                <ul>{q.expected_points.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </details>
            )}
            {q.recording_id && <RecordingPlayer recId={q.recording_id} />}
          </article>
        ))}
      </section>

      <section className="card">
        <h2>Your decision</h2>
        {canDecide ? (
          <>
            <p className="muted">AI scores are advisory. Please review the answers yourself before deciding. Rejecting does not email the candidate unless that is turned on in settings.</p>
            <Field id="d-note" label="Internal note (only your company sees this)">
              <textarea id="d-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            </Field>
            <Field id="d-msg" label="Message to candidate (optional, included only in the acceptance email)">
              <textarea id="d-msg" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} style={{ minHeight: 70 }} />
            </Field>
            <div className="row-actions">
              {DECISIONS.map(([v, label, cls]) => (
                <button key={v} className={`btn ${cls}`} disabled={busy} onClick={() => decide(v, label)}>{label}</button>
              ))}
              <button className="btn btn-ghost" onClick={saveNote}>Save note only</button>
            </div>
          </>
        ) : d.application_status === 'accepted' || d.application_status === 'final_rejected' ? (
          <p>Final decision recorded: <StatusBadge status={d.application_status} /></p>
        ) : (
          <p className="muted">You can record a decision after the candidate completes the interview.</p>
        )}
      </section>
    </div>
  )
}
