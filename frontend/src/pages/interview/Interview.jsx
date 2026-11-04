import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'
import AnswerRecorder from './AnswerRecorder'
import { LiveVideo, MicMeter, useMedia } from './media'

const LONG = { timeout: 180000 } // AI/Whisper call-e somoy lage
const DONE = ['submitted', 'evaluating', 'completed', 'failed']
const base = (id) => `/api/interviews/${id}`

function ConsentView({ s, onConsent, busy, error }) {
  const [mode, setMode] = useState('video')
  const n = s.consent_notice
  return (
    <div className="card narrow">
      <h1>Before you start</h1>
      <p className="muted">{s.job_title} at {s.company_name}</p>
      <dl className="kv">
        <dt>Purpose</dt><dd>{n.purpose}</dd>
        <dt>Who can see it</dt><dd>{n.access}</dd>
        <dt>What is evaluated</dt><dd>{n.evaluation}</dd>
        <dt>Retention</dt><dd>{n.retention}</dd>
        <dt>Deletion</dt><dd>{n.deletion}</dd>
      </dl>
      <p>The interview has about 5 questions, then a few follow-up questions based on your answers. Plan for 5 to 7 minutes in a quiet place.</p>
      <Alert>{error}</Alert>
      <fieldset className="plain-fieldset">
        <legend className="sr-only">Recording choice</legend>
        {[
          ['video', 'Record video and audio', 'Recommended.'],
          ['audio', 'Record audio only', 'Your camera stays off.'],
          ['decline', 'I do not want to be recorded', 'Nothing is recorded. You will need to contact the company about an alternative.'],
        ].map(([v, t, d]) => (
          <label key={v} className="choice">
            <input type="radio" name="mode" value={v} checked={mode === v} onChange={() => setMode(v)} />
            <span><strong>{t}</strong><br /><span className="muted">{d}</span></span>
          </label>
        ))}
      </fieldset>
      <button className={`btn ${mode === 'decline' ? 'btn-ghost' : 'btn-primary'}`} disabled={busy} onClick={() => onConsent(mode)}>
        {mode === 'decline' ? 'Decline recording' : 'I agree and continue'}
      </button>
    </div>
  )
}

export default function Interview() {
  const { applicationId } = useParams()
  const [s, setS] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fatal, setFatal] = useState(null)
  const [declined, setDeclined] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fu, setFu] = useState({ status: 'idle', error: '' }) // idle | loading | failed | skipped
  const started = useRef(null)
  const fuRun = useRef(false)
  const media = useMedia(s?.recording_mode === 'audio' ? 'audio' : 'video')
  const { stop: stopMedia } = media

  const init = useCallback(async () => {
    setLoading(true)
    setFatal(null)
    let prepErr = null
    try {
      await api.candidate.post(`${base(applicationId)}/prepare`, null, LONG)
    } catch (e) {
      prepErr = e
      // 403 hole hoyto interview age-i shesh: state dekhar chesta kori
      if (e.response?.status !== 403) {
        setFatal({ msg: errorMessage(e), retry: !e.response || [502, 503].includes(e.response.status) })
        setLoading(false)
        return
      }
    }
    try {
      const { data } = await api.candidate.get(`${base(applicationId)}/state`)
      setS(data)
    } catch (e) {
      setFatal({ msg: prepErr ? errorMessage(prepErr) : errorMessage(e), retry: false })
    } finally {
      setLoading(false)
    }
  }, [applicationId])

  // started ref: React StrictMode-e duibar AI call na hoy
  useEffect(() => {
    if (started.current === applicationId) return
    started.current = applicationId
    init()
  }, [applicationId, init])

  useEffect(() => { if (s && DONE.includes(s.status)) stopMedia() }, [s, stopMedia])

  const qs = s?.questions || []
  const initialDone = qs.length > 0 && qs.filter((q) => q.kind === 'initial').every((q) => q.answered)
  const hasFU = qs.some((q) => q.kind === 'followup')

  const runFollowups = useCallback(async () => {
    fuRun.current = true
    setFu({ status: 'loading', error: '' })
    try {
      const { data } = await api.candidate.post(`${base(applicationId)}/followups`, null, LONG)
      setS(data)
      setFu({ status: 'idle', error: '' })
    } catch (e) {
      setFu({ status: 'failed', error: errorMessage(e) })
    } finally {
      fuRun.current = false
    }
  }, [applicationId])

  useEffect(() => {
    if (s?.status === 'in_progress' && initialDone && !hasFU && fu.status === 'idle' && !fuRun.current) runFollowups()
  }, [s?.status, initialDone, hasFU, fu.status, runFollowups])

  const consent = async (mode) => {
    setBusy(true)
    setError('')
    try {
      const { data } = await api.candidate.post(`${base(applicationId)}/consent`, { mode })
      if (data.declined) setDeclined(data.message)
      else setS((p) => ({ ...p, recording_mode: data.recording_mode, consent_given: true, status: p.status === 'invited' ? 'consented' : p.status }))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const start = async () => {
    setBusy(true)
    setError('')
    try {
      const { data } = await api.candidate.post(`${base(applicationId)}/start`)
      setS(data)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const markDone = (qid) => setS((p) => ({ ...p, questions: p.questions.map((q) => (q.id === qid ? { ...q, answered: true } : q)) }))

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const { data } = await api.candidate.post(`${base(applicationId)}/submit`, null, LONG)
      setS((p) => ({ ...p, status: data.status }))
      media.stop()
    } catch (e) {
      setError(errorMessage(e))
      if (e.response?.status === 409) {
        // Notun follow-up toiri hoye thakte pare: state abar nei
        try { setS((await api.candidate.get(`${base(applicationId)}/state`)).data) } catch { /* ignore */ }
      }
    } finally {
      setBusy(false)
    }
  }

  // ---------- Render ----------
  const wrap = (children) => <div className="container section">{children}</div>

  if (loading) {
    return wrap(<><Spinner label="Preparing interview" /><p className="muted center">Preparing your interview questions. The first time can take up to a minute.</p></>)
  }
  if (fatal) {
    return wrap(
      <div className="card narrow">
        <h1>Interview not available</h1>
        <Alert>{fatal.msg}</Alert>
        <div className="row-actions">
          {fatal.retry && <button className="btn btn-primary" onClick={init}>Try again</button>}
          <Link to="/dashboard" className="btn btn-ghost">Back to dashboard</Link>
        </div>
      </div>,
    )
  }
  if (!s) return null

  if (declined) {
    return wrap(
      <div className="card narrow">
        <h1>Recording declined</h1>
        <Alert type="info">{declined}</Alert>
        <div className="row-actions">
          <button className="btn btn-ghost" onClick={() => setDeclined('')}>I changed my mind</button>
          <Link to="/dashboard" className="btn btn-primary">Back to dashboard</Link>
        </div>
      </div>,
    )
  }

  if (DONE.includes(s.status)) {
    return wrap(
      <div className="card narrow center">
        <h1>Interview submitted</h1>
        <p>Thank you. {s.company_name} will review your interview for {s.job_title}. Your result appears in your dashboard when it is ready.</p>
        <Link to="/dashboard" className="btn btn-primary">Go to dashboard</Link>
      </div>,
    )
  }
  if (s.status === 'expired') {
    return wrap(<div className="card narrow"><h1>Interview expired</h1><p>This interview link has expired. Please contact the company.</p></div>)
  }

  if (!s.consent_given) return wrap(<ConsentView s={s} onConsent={consent} busy={busy} error={error} />)

  const mode = s.recording_mode === 'audio' ? 'audio' : 'video'

  // Consent dewa hoyeche kintu shuru hoy ni: device check
  if (s.status !== 'in_progress') {
    return wrap(
      <div className="card narrow">
        <h1>Check your {mode === 'video' ? 'camera and microphone' : 'microphone'}</h1>
        <Alert>{media.error}</Alert>
        <Alert>{error}</Alert>
        {media.stream ? (
          <>
            {mode === 'video' ? <div className="video-box"><LiveVideo stream={media.stream} /></div> : null}
            <MicMeter stream={media.stream} />
            <p className="muted">Say something. The microphone bar should move. Use a quiet place and keep your answers focused.</p>
            <button className="btn btn-primary" onClick={start} disabled={busy}>{busy ? 'Starting...' : 'Start interview'}</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={media.request} disabled={media.asking}>
            {media.asking ? 'Waiting for permission...' : `Allow ${mode === 'video' ? 'camera and microphone' : 'microphone'}`}
          </button>
        )}
      </div>,
    )
  }

  // ---------- in_progress ----------
  const answered = qs.filter((q) => q.answered).length
  const current = qs.find((q) => !q.answered)
  const pct = qs.length ? Math.round((answered / qs.length) * 100) : 0

  let body
  if (current && !media.stream) {
    body = (
      <div className="card">
        <h2>Turn on your {mode === 'video' ? 'camera and microphone' : 'microphone'} to continue</h2>
        <Alert>{media.error}</Alert>
        <button className="btn btn-primary" onClick={media.request} disabled={media.asking}>
          {media.asking ? 'Waiting for permission...' : 'Enable'}
        </button>
      </div>
    )
  } else if (current) {
    body = (
      <AnswerRecorder
        key={current.id} applicationId={applicationId} question={current}
        index={qs.indexOf(current)} total={qs.length} mode={mode}
        stream={media.stream} maxSec={s.max_answer_seconds} onDone={markDone}
      />
    )
  } else if (!hasFU && fu.status !== 'skipped') {
    body = fu.status === 'failed' ? (
      <div className="card">
        <h2>Follow-up questions</h2>
        <Alert>{fu.error}</Alert>
        <div className="row-actions">
          <button className="btn btn-primary" onClick={() => setFu({ status: 'idle', error: '' })}>Try again</button>
          <button className="btn btn-ghost" onClick={() => setFu({ status: 'skipped', error: '' })}>Skip follow-ups and submit</button>
        </div>
      </div>
    ) : (
      <div className="card center">
        <Spinner label="Preparing follow-up questions" />
        <p className="muted">Preparing follow-up questions based on your answers...</p>
      </div>
    )
  } else {
    body = (
      <div className="card center">
        <h2>All questions answered</h2>
        <p className="muted">Submit your interview when you are ready. You cannot change answers after submitting.</p>
        <Alert>{error}</Alert>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Submitting...' : 'Submit interview'}</button>
      </div>
    )
  }

  return wrap(
    <div className="narrow stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>{s.job_title}</h1>
        <p className="muted" style={{ margin: 0 }}>{s.company_name} · {answered} of {qs.length} answered</p>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Interview progress">
        <span style={{ width: `${pct}%` }} />
      </div>
      {body}
    </div>,
  )
}

