import { useCallback, useEffect, useRef, useState } from 'react'
import Alert from '../../components/Alert'
import Field from '../../components/Field'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'
import { checkCv } from '../Apply'
import CvTopics from './CvTopics'
import MatchCard from './MatchCard'

function Upload({ onDone, title, text }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!file) return setError('Choose a PDF or DOCX file first')
    const msg = checkCv(file)
    if (msg) return setError(msg)
    const body = new FormData()
    body.append('cv', file)
    setBusy(true)
    try {
      await api.candidate.post('/api/candidates/me/cv', body)
      setFile(null)
      e.target.reset()
      await onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>{title}</h2>
      <p className="muted">{text}</p>
      <Alert>{error}</Alert>
      <Field id="rec-cv" label="CV (PDF or DOCX, max 5 MB)">
        <input id="rec-cv" type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </Field>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Uploading and analysing...' : 'Upload and analyse'}</button>
    </form>
  )
}

export default function CvMatch() {
  const [d, setD] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [target, setTarget] = useState(null)   // { id, title } ba { id: null }
  const topicsRef = useRef(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const { data } = await api.candidate.get('/api/recommend/matches', { timeout: 120000 })
      setD(data)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (target) topicsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [target])

  if (loading) {
    return <><Spinner label="Analysing your CV" /><p className="muted center">Analysing your CV. The first time can take a minute.</p></>
  }
  if (error && !d) return <Alert>{error}</Alert>
  if (!d.has_cv) {
    return <Upload onDone={load} title="Upload your CV"
      text="We compare your CV with every open vacancy, show a match %, and suggest topics an interviewer might ask. Only you can see this." />
  }
  if (!d.readable) {
    return <div className="stack"><Alert>{d.message}</Alert>
      <Upload onDone={load} title="Upload a different CV" text="Use a text-based PDF or DOCX." /></div>
  }

  const top = d.items[0]
  return (
    <div className="stack">
      <Alert>{error}</Alert>
      <section className="card">
        <div className="app-top">
          <div>
            <h2 style={{ margin: 0 }}>Your CV: {d.cv_filename}</h2>
            <p className="muted" style={{ margin: 0 }}>Only you can see this analysis. Companies and admins cannot.</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setTarget({ id: null, title: null })}>
            What could be asked from my CV?
          </button>
        </div>
        <h3>Skills found in your CV</h3>
        {d.skills_found.length ? (
          <div className="tags">{d.skills_found.map((s) => <span className="tag" key={s}>{s}</span>)}</div>
        ) : <p className="muted">No known skills were detected. Add a skills section to your CV.</p>}
        {d.skill_gaps.length > 0 && (
          <>
            <h3>Skills that would unlock more jobs</h3>
            <div className="tags">
              {d.skill_gaps.map((g) => <span className="tag tag-miss" key={g.skill}>{g.skill} · {g.jobs} job{g.jobs > 1 ? 's' : ''}</span>)}
            </div>
          </>
        )}
        <Alert type="info">{d.note}</Alert>
      </section>

      <div ref={topicsRef}>
        {target && <CvTopics key={String(target.id ?? 'general')} target={target} onClose={() => setTarget(null)} />}
      </div>

      <section>
        <h2>Jobs that fit your CV</h2>
        {d.items.length === 0 ? <p className="muted">There are no open vacancies right now.</p> : (
          <div className="grid">
            {d.items.map((v) => <MatchCard key={v.id} v={v} onPrep={(x) => setTarget({ id: x.id, title: x.title })} />)}
          </div>
        )}
        {top && top.match.percent < 35 && <p className="muted">No strong matches yet. Check the skills above to see what to add.</p>}
      </section>

      <details>
        <summary>Replace my CV</summary>
        <Upload onDone={load} title="Upload a new CV" text="Your newest CV is used for matching and for new applications." />
      </details>
    </div>
  )
}
