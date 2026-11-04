import { useEffect, useState } from 'react'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'

const LETTERS = ['A', 'B', 'C', 'D']
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function McqReport({ appId }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    api.company.get(`/api/company/applications/${appId}/mcq`)
      .then((r) => alive && setD(r.data))
      .catch((e) => alive && setErr(errorMessage(e)))
    return () => { alive = false }
  }, [appId])

  if (err) return <Alert>{err}</Alert>
  if (!d) return <Spinner />

  const wait = {
    not_taken: 'The candidate has not started Round 2 (MCQ test) yet.',
    ready: 'The candidate has opened Round 2 but has not started the timer.',
    in_progress: 'The candidate is taking Round 2 now.',
  }[d.status]

  return (
    <section className="card">
      <h2>Round 2: MCQ test</h2>
      {wait && <p className="muted">{wait}</p>}
      {d.status === 'submitted' && (
        <>
          <div className="score">{d.correct}<span className="muted"> / {d.total} correct ({d.score}%)</span></div>
          <p className="muted">
            Time taken {d.time_taken_seconds != null ? mmss(d.time_taken_seconds) : '-'} of {mmss(d.duration_seconds)}
            {d.auto_submitted ? ' · auto-submitted when time ran out' : ''}
          </p>
          <Alert type="info">{d.note}</Alert>

          <h3>By skill</h3>
          <ul className="doc-list">
            {Object.entries(d.breakdown).map(([k, v]) => (
              <li key={k}><span>{k}</span><strong>{v.correct} / {v.total}</strong></li>
            ))}
          </ul>

          <details>
            <summary>Show all questions and answers</summary>
            {d.questions.map((q) => (
              <div key={q.order} className="mcq-item">
                <p><strong>Q{q.order}.</strong> {q.text}
                  <span className="badge" style={{ marginLeft: 8 }}>{q.source === 'cv' ? 'from CV' : 'role'}</span>
                </p>
                <ul className="mcq-opts">
                  {q.options.map((o, i) => (
                    <li key={i}>
                      {LETTERS[i]}. {o}
                      {i === q.correct_index && <strong> (correct answer)</strong>}
                      {i === q.selected_index && <strong> (candidate chose this)</strong>}
                    </li>
                  ))}
                </ul>
                <p className={q.is_correct ? '' : 'muted'}>
                  {q.selected_index == null ? 'Not answered.' : q.is_correct ? 'Correct.' : 'Wrong.'} {q.explanation}
                </p>
              </div>
            ))}
          </details>
        </>
      )}
    </section>
  )
}
