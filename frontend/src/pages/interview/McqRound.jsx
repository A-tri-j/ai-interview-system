// Round 2: 10 MCQs, 3-minute limit. Tracks server deadline to prevent resets on page reload.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '../../components/Alert'
import ConfirmDialog from '../../components/ConfirmDialog'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'

const LONG = { timeout: 180000 } // Extended timeout for MCQ generation
const base = (id) => `/api/mcq/${id}`
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const LETTERS = ['A', 'B', 'C', 'D']

export default function McqRound() {
  const { applicationId } = useParams()
  const [s, setS] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fatal, setFatal] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [answers, setAnswers] = useState({})
  const [cur, setCur] = useState(0)
  const [left, setLeft] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const endAt = useRef(0)           // Monotonic performance.now() deadline (immune to clock changes)
  const answersRef = useRef({})
  const submitting = useRef(false)
  const autoTried = useRef(false)
  const loaded = useRef(null)
  answersRef.current = answers

  const apply = useCallback((data) => {
    setS(data)
    if (data.status === 'in_progress') {
      endAt.current = performance.now() + data.remaining_seconds * 1000
      setLeft(data.remaining_seconds)
      setAnswers(Object.fromEntries(
        data.questions.filter((q) => q.selected_index != null).map((q) => [q.id, q.selected_index]),
      ))
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setFatal('')
    try {
      const { data } = await api.candidate.get(`${base(applicationId)}/state`)
      apply(data)
    } catch (e) {
      setFatal(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [applicationId, apply])

  useEffect(() => {
    if (loaded.current === applicationId) return
    loaded.current = applicationId
    load()
  }, [applicationId, load])

  const doSubmit = useCallback(async (auto = false) => {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    setConfirm(false)
    try {
      const list = Object.entries(answersRef.current).map(([q, i]) => ({ question_id: Number(q), selected_index: i }))
      const { data } = await api.candidate.post(`${base(applicationId)}/submit`, { answers: list, auto }, LONG)
      setS(data)
    } catch (e) {
      if ([409, 410].includes(e.response?.status)) await load() // server age-i submit kore dise
      else setError(`${errorMessage(e)} Your saved answers are kept. Press "Submit test" to try again.`)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }, [applicationId, load])

  // Countdown computed every 250ms against server deadline. Auto-submits once remaining hits 0.
  useEffect(() => {
    if (s?.status !== 'in_progress') return
    const t = setInterval(() => {
      const l = Math.max(0, Math.ceil((endAt.current - performance.now()) / 1000))
      setLeft(l)
      if (l === 0 && !autoTried.current) {
        autoTried.current = true
        doSubmit(true)
      }
    }, 250)
    return () => clearInterval(t)
  }, [s?.status, doSubmit])

  // Warn candidate if attempting to close or navigate away from active test
  useEffect(() => {
    if (s?.status !== 'in_progress') return
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [s?.status])

  const startTest = async () => {
    setBusy(true)
    setError('')
    try {
      if (s.status === 'not_prepared') {
        await api.candidate.post(`${base(applicationId)}/prepare`, null, LONG)
      }
      const { data } = await api.candidate.post(`${base(applicationId)}/start`)
      autoTried.current = false
      setCur(0)
      apply(data)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const choose = (q, idx) => {
    setAnswers((p) => ({ ...p, [q.id]: idx }))
    // Background save. In case of network drops, answers are resubmitted on finalize.
    api.candidate.put(`${base(applicationId)}/answer`, { question_id: q.id, selected_index: idx }).catch(() => {})
  }

  const wrap = (c) => <div className="container section">{c}</div>
  if (loading) return wrap(<Spinner />)
  if (fatal) {
    return wrap(
      <div className="card narrow">
        <h1>Round 2 not available</h1>
        <Alert>{fatal}</Alert>
        <Link to="/dashboard" className="btn btn-primary">Back to dashboard</Link>
      </div>,
    )
  }
  if (!s) return null

  // ---------- Intro ----------
  if (['not_prepared', 'ready'].includes(s.status)) {
    if (s.status === 'not_prepared' && !s.eligible) {
      return wrap(
        <div className="card narrow">
          <h1>Round 2 is not open yet</h1>
          <p className="muted">Round 2 opens after you complete the Round 1 video interview.</p>
          <Link to="/dashboard" className="btn btn-primary">Back to dashboard</Link>
        </div>,
      )
    }
    return wrap(
      <div className="card narrow">
        <h1>Round 2: MCQ test</h1>
        <ul>
          <li>{s.total} multiple-choice questions, one correct answer each.</li>
          <li>You have <strong>{fmt(s.duration_seconds)} minutes</strong> in total. The timer starts when you press Start and cannot be paused.</li>
          <li>When time runs out, your saved answers are <strong>submitted automatically</strong>. Unanswered questions count as wrong.</li>
          <li>If you refresh the page, the timer keeps running.</li>
          <li>Questions are based on the role and your CV. Use a stable internet connection.</li>
        </ul>
        <Alert>{error}</Alert>
        <button className="btn btn-primary" onClick={startTest} disabled={busy}>
          {busy ? (s.status === 'not_prepared' ? 'Preparing your questions...' : 'Starting...') : 'Start test'}
        </button>
        {busy && s.status === 'not_prepared' && (
          <p className="muted">Preparing questions can take up to a minute. The timer has not started.</p>
        )}
      </div>,
    )
  }

  // ---------- Submitted ----------
  if (s.status === 'submitted') {
    return wrap(
      <div className="card narrow center">
        <h1>Round 2 submitted</h1>
        {s.auto_submitted && <Alert type="info">Time ran out, so your saved answers were submitted automatically.</Alert>}
        {s.result ? (
          <>
            <div className="score">{s.result.correct}<span className="muted"> / {s.result.total} correct</span></div>
            <p className="muted">Score: {s.result.score}%. The company will review your result.</p>
          </>
        ) : (
          <p>Thank you. The company will review your result.</p>
        )}
        <Link to="/dashboard" className="btn btn-primary">Go to dashboard</Link>
      </div>,
    )
  }

  // ---------- In progress ----------
  const qs = s.questions
  const q = qs[cur]
  const unanswered = qs.filter((x) => answers[x.id] == null).length
  return wrap(
    <div className="narrow stack">
      <div className="timer-bar">
        <span className="muted">Question {cur + 1} of {qs.length}</span>
        <div className={`timer ${left <= 30 ? 'low' : ''}`} role="timer" aria-label="Time left">
          {left <= 30 && <span className="sr-only">Hurry. </span>}
          {fmt(left)}
        </div>
      </div>

      <Alert>{error}</Alert>

      <fieldset className="card plain-fieldset" key={q.id}>
        <legend className="q-text">{q.text}</legend>
        {q.options.map((opt, i) => (
          <label key={i} className="choice">
            <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === i} onChange={() => choose(q, i)} />
            <span><strong>{LETTERS[i]}.</strong> {opt}</span>
          </label>
        ))}
      </fieldset>

      <div className="row-actions">
        <button className="btn btn-ghost" disabled={cur === 0} onClick={() => setCur(cur - 1)}>Previous</button>
        <button className="btn btn-ghost" disabled={cur === qs.length - 1} onClick={() => setCur(cur + 1)}>Next</button>
        <div className="spacer" />
        <button className="btn btn-primary" disabled={busy} onClick={() => setConfirm(true)}>
          {busy ? 'Submitting...' : 'Submit test'}
        </button>
      </div>

      <div className="palette" role="group" aria-label="Question navigator">
        {qs.map((x, i) => (
          <button key={x.id} type="button"
            className={`pal ${answers[x.id] != null ? 'done' : ''} ${i === cur ? 'now' : ''}`}
            aria-label={`Question ${i + 1}, ${answers[x.id] != null ? 'answered' : 'not answered'}`}
            aria-current={i === cur || undefined} onClick={() => setCur(i)}>
            {i + 1}
          </button>
        ))}
      </div>

      <ConfirmDialog
        open={confirm} title="Submit your test?" confirmLabel="Submit"
        message={unanswered ? `${unanswered} question(s) are not answered and will count as wrong. You cannot change answers after submitting.` : 'You cannot change answers after submitting.'}
        onConfirm={() => doSubmit(false)} onCancel={() => setConfirm(false)}
      />
    </div>,
  )
}

