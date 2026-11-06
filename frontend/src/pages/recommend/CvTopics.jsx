import { useEffect, useRef, useState } from 'react'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'

export default function CvTopics({ target, onClose }) {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const ran = useRef(false)   // StrictMode-e duibar AI call na hoy

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.candidate.post(
        '/api/recommend/cv-topics', { vacancy_id: target.id ?? null }, { timeout: 120000 },
      )
      setD(data)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="card topics">
      <div className="app-top">
        <h2 style={{ margin: 0 }}>{target.title ? `Interview prep: ${target.title}` : 'What could be asked from my CV'}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
      </div>
      {loading && <><Spinner label="Reading your CV" /><p className="muted center">Reading your CV and preparing topics. This can take up to a minute.</p></>}
      <Alert>{error}</Alert>
      {error && !loading && <button className="btn btn-ghost btn-sm" onClick={load}>Try again</button>}

      {d && (
        <>
          <Alert type="info">{d.note}</Alert>
          <div className="stack">
            {d.topics.map((t, i) => (
              <article key={i} className="topic">
                <div className="badges" style={{ marginBottom: 6 }}>
                  <strong>{t.topic}</strong>
                  <span className="badge">{t.difficulty}</span>
                </div>
                <p className="muted" style={{ margin: '0 0 6px' }}>{t.why}</p>
                <blockquote className="quote">From your CV: {t.evidence}</blockquote>
                <ul>{t.sample_questions.map((q, j) => <li key={j}>{q}</li>)}</ul>
              </article>
            ))}
          </div>
          {d.gaps.length > 0 && (
            <>
              <h3>Skills to prepare for this job</h3>
              <p className="muted">These are required by the job but were not found in your CV.</p>
              <ul>{d.gaps.map((g, i) => <li key={i}><strong>{g.skill}:</strong> {g.tip}</li>)}</ul>
            </>
          )}
        </>
      )}
    </section>
  )
}
