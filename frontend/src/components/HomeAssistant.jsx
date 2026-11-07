// Home page-er AI chat: CV upload -> CV % -> job suggestion -> filter -> search.
// Backend: /api/recommend/* (ager job finder). Candidate login lagbe.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from './Alert'
import Spinner from './Spinner'
import { useAuth } from '../hooks/useAuth'
import { checkCv } from '../pages/Apply'
import MatchCard from '../pages/recommend/MatchCard'
import { api, errorMessage } from '../services/api'
import { pretty } from '../services/format'

const EMPTY = { keywords: [], location: null, work_mode: null, employment_type: null, experience: null }
const TYPES = [['full_time', 'Full time'], ['part_time', 'Part time'], ['internship', 'Internship'], ['contract', 'Contract'], ['freelance', 'Freelance']]
const MODES = [['remote', 'Remote'], ['hybrid', 'Hybrid'], ['onsite', 'On-site']]
const EXPS = ['Fresher', '1-3 years', '3-5 years', '5+ years']

const Bot = ({ children }) => <div className="bubble bot wide">{children}</div>
const Me = ({ children }) => <div className="bubble user">{children}</div>

function Chip({ active, onClick, children }) {
  return (
    <button type="button" className={`chip ${active ? 'on' : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  )
}

export default function HomeAssistant() {
  const { users, loading: authLoading } = useAuth()
  const candidate = users.candidate

  const [saved, setSaved] = useState(undefined)   // undefined = jani na, null = CV nei, object = CV ache
  const [analysis, setAnalysis] = useState(null)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState('')            // '' | upload | analyse | search
  const [error, setError] = useState('')
  const [want, setWant] = useState(null)          // null = jiggesh kora hoy ni, true / false
  const [filters, setFilters] = useState(EMPTY)
  const [results, setResults] = useState(null)
  const [input, setInput] = useState('')
  const [loc, setLoc] = useState('')

  // Login thakle: age CV upload kora ache kina (halka call, AI na)
  useEffect(() => {
    if (!candidate) { setSaved(undefined); setAnalysis(null); setResults(null); setWant(null); return }
    let alive = true
    api.candidate.get('/api/candidates/me/profile')
      .then((r) => alive && setSaved(r.data.documents?.[0] || null))
      .catch(() => alive && setSaved(null))
    return () => { alive = false }
  }, [candidate])

  const analyse = async () => {
    setBusy('analyse')
    setError('')
    try {
      const { data } = await api.candidate.get('/api/recommend/matches', { timeout: 120000 })
      if (!data.has_cv) { setSaved(null); setError('Please upload your CV first.') }
      else if (!data.readable) setError(data.message)
      else { setAnalysis(data); setWant(null); setResults(null); setFilters(EMPTY) }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy('')
    }
  }

  const upload = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    setError('')
    if (!file) return setError('Choose a PDF or DOCX file first.')
    const msg = checkCv(file)
    if (msg) return setError(msg)
    const body = new FormData()
    body.append('cv', file)
    setBusy('upload')
    try {
      await api.candidate.post('/api/candidates/me/cv', body)
      setSaved({ filename: file.name })
      setFile(null)
      form.reset()
      await analyse()
    } catch (err) {
      setError(errorMessage(err))
      setBusy('')
    }
  }

  const search = async (message, f) => {
    setBusy('search')
    setError('')
    try {
      const { data } = await api.candidate.post(
        '/api/recommend/search', { message: message || null, filters: f }, { timeout: 90000 },
      )
      setFilters(data.understood)
      setResults(data)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy('')
    }
  }

  const send = (e) => {
    e.preventDefault()
    const t = input.trim()
    if (!t || busy) return
    setInput('')
    search(t, filters)
  }
  const toggle = (key, value) => search(null, { ...filters, [key]: filters[key] === value ? null : value })
  const pickKeyword = (k) => search(null, { ...filters, keywords: [k] })
  const setLocation = (e) => { e.preventDefault(); search(null, { ...filters, location: loc.trim() || null }) }
  const clear = () => { setFilters(EMPTY); setResults(null); setLoc('') }

  // ---------- CV theke suggestion ----------
  const skillChips = (analysis?.skills_found || []).slice(0, 6)
  const roleChips = [...new Set((analysis?.items || []).slice(0, 3).map((v) => v.title))]
  const q = analysis?.cv_quality
  const tone = q ? (q.percent >= 75 ? 'high' : q.percent >= 50 ? 'mid' : 'low') : 'low'
  const noJobs = results && results.total === 0
  const wanted = results ? (results.understood.keywords || []).join(', ') : ''

  return (
    <section className="container section assistant">
      <div className="assistant-head">
        <span className="eyebrow">AI career assistant</span>
        <h2 style={{ marginTop: 10 }}>Find your dream company / work using AI</h2>
        <p className="muted">Upload your CV and I will check it, show which jobs fit you, and help you search. Private to you: companies and admins cannot see this.</p>
      </div>

      <div className="card assist-log" aria-live="polite">
        <Bot>
          Hi! To start, please <strong>upload your CV</strong> (PDF or DOCX). I will tell you how complete it is and which open jobs match it.
        </Bot>

        {/* ---- Login ---- */}
        {!authLoading && !candidate && (
          <Bot>
            <p style={{ marginTop: 0 }}>Please sign in so I can read and save your CV safely.</p>
            <div className="row-actions">
              <Link to="/login" state={{ from: '/' }} className="btn btn-primary btn-sm">Sign in</Link>
              <Link to="/register" className="btn btn-ghost btn-sm">Create account</Link>
            </div>
          </Bot>
        )}

        {/* ---- Upload ---- */}
        {candidate && !analysis && busy !== 'analyse' && (
          <Bot>
            {saved && (
              <>
                <p style={{ marginTop: 0 }}>I found your CV: <strong>{saved.filename}</strong>.</p>
                <div className="row-actions" style={{ marginBottom: 12 }}>
                  <button className="btn btn-primary btn-sm" onClick={analyse} disabled={Boolean(busy)}>Analyse this CV</button>
                </div>
                <p className="muted" style={{ marginBottom: 6 }}>Or upload a different one:</p>
              </>
            )}
            <form onSubmit={upload} className="assist-upload">
              <label htmlFor="home-cv" className="sr-only">CV file</label>
              <input id="home-cv" type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <button className="btn btn-primary btn-sm" disabled={busy === 'upload' || !file}>
                {busy === 'upload' ? 'Uploading...' : 'Upload and analyse'}
              </button>
            </form>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>PDF or DOCX, max 5 MB. Text-based files work best. Scanned images cannot be read.</p>
          </Bot>
        )}

        {busy === 'analyse' && <Bot><Spinner label="Analysing your CV" /><p className="muted center" style={{ margin: 0 }}>Reading your CV and matching it with open jobs. The first time can take a minute.</p></Bot>}
        <Alert>{error}</Alert>

        {/* ---- CV analysis ---- */}
        {analysis && (
          <>
            <Me>{saved?.filename || analysis.cv_filename}</Me>
            <Bot>
              <div className="cv-score-row">
                <div className={`ring ring-${tone} ring-lg`}><span>{q.percent}%</span></div>
                <div>
                  <strong>CV readiness: {q.label}</strong>
                  <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>{q.note}</p>
                </div>
              </div>
              <ul className="check-list">
                {q.checks.map((c) => (
                  <li key={c.label} className={c.ok ? 'ok' : 'miss'}>
                    <span aria-hidden="true">{c.ok ? '✓' : '•'}</span>
                    <span>{c.label}{!c.ok && c.tip ? <span className="muted"> — {c.tip}</span> : null}</span>
                  </li>
                ))}
              </ul>
              {analysis.skills_found.length > 0 && (
                <>
                  <p style={{ margin: '12px 0 6px' }}><strong>Skills I found in your CV</strong></p>
                  <div className="tags">{analysis.skills_found.map((s) => <span className="tag" key={s}>{s}</span>)}</div>
                </>
              )}
              {analysis.skill_gaps.length > 0 && (
                <>
                  <p style={{ margin: '12px 0 6px' }}><strong>Skills that would unlock more jobs</strong></p>
                  <div className="tags">{analysis.skill_gaps.slice(0, 5).map((g) => <span className="tag tag-miss" key={g.skill}>{g.skill} · {g.jobs} job{g.jobs > 1 ? 's' : ''}</span>)}</div>
                </>
              )}
            </Bot>

            <Bot>
              <p style={{ marginTop: 0 }}><strong>Jobs your CV fits best</strong></p>
              {analysis.items.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>There are no open vacancies on this site right now. Please check back soon.</p>
              ) : (
                <div className="grid assist-grid">
                  {analysis.items.slice(0, 3).map((v) => <MatchCard key={v.id} v={v} />)}
                </div>
              )}
              <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.85rem' }}>
                Match % compares your CV with each job. It is an estimate, not a hiring prediction.{' '}
                <Link to="/recommend">See all matches and interview prep</Link>
              </p>
            </Bot>

            {/* ---- Search chao kina ---- */}
            <Bot>
              Do you want me to <strong>find a job</strong> for you?
              {want === null && (
                <div className="row-actions" style={{ marginTop: 10 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setWant(true)}>Yes, find a job</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setWant(false)}>Not now</button>
                </div>
              )}
            </Bot>
            {want === true && <Me>Yes, find a job</Me>}
            {want === false && (
              <>
                <Me>Not now</Me>
                <Bot>
                  No problem. You can{' '}
                  <button className="link-btn" onClick={() => setWant(true)}>search jobs</button> anytime,{' '}
                  or <button className="link-btn" onClick={() => { setAnalysis(null); setWant(null) }}>upload another CV</button>.
                </Bot>
              </>
            )}

            {/* ---- Filter + search ---- */}
            {want === true && (
              <Bot>
                <p style={{ marginTop: 0 }}>Great! Type the job you want (English or Bengali), or choose from the suggestions and filters.</p>

                <form className="chat-input assist-input" onSubmit={send}>
                  <label htmlFor="home-q" className="sr-only">Describe the job you want</label>
                  <input id="home-q" value={input} onChange={(e) => setInput(e.target.value)} maxLength={300}
                    placeholder="e.g. backend developer, remote React job, fresher internship" />
                  <button className="btn btn-primary btn-sm" disabled={Boolean(busy) || !input.trim()}>Search</button>
                </form>

                {(roleChips.length > 0 || skillChips.length > 0) && (
                  <div className="chip-group" role="group" aria-label="Suggestions from your CV">
                    <span className="muted chip-label">From your CV</span>
                    {roleChips.map((r) => <Chip key={r} active={filters.keywords.includes(r)} onClick={() => pickKeyword(r)}>{r}</Chip>)}
                    {skillChips.map((s) => <Chip key={s} active={filters.keywords.includes(s)} onClick={() => pickKeyword(s)}>{s}</Chip>)}
                  </div>
                )}
                <div className="chip-group" role="group" aria-label="Job type">
                  <span className="muted chip-label">Job type</span>
                  {TYPES.map(([v, l]) => <Chip key={v} active={filters.employment_type === v} onClick={() => toggle('employment_type', v)}>{l}</Chip>)}
                </div>
                <div className="chip-group" role="group" aria-label="Work mode">
                  <span className="muted chip-label">Work mode</span>
                  {MODES.map(([v, l]) => <Chip key={v} active={filters.work_mode === v} onClick={() => toggle('work_mode', v)}>{l}</Chip>)}
                </div>
                <div className="chip-group" role="group" aria-label="Experience">
                  <span className="muted chip-label">Experience</span>
                  {EXPS.map((l) => <Chip key={l} active={filters.experience === l} onClick={() => toggle('experience', l)}>{l}</Chip>)}
                </div>
                <form className="chip-group" onSubmit={setLocation}>
                  <label htmlFor="home-loc" className="muted chip-label">Location</label>
                  <input id="home-loc" value={loc} onChange={(e) => setLoc(e.target.value)} maxLength={100}
                    placeholder="City or country" style={{ maxWidth: 200 }} />
                  <button className="btn btn-ghost btn-sm" disabled={Boolean(busy)}>Set</button>
                </form>
                {(filters.keywords.length > 0 || filters.location || filters.work_mode || filters.employment_type || filters.experience) && (
                  <div className="chip-group">
                    <span className="muted chip-label">Searching for</span>
                    {[...filters.keywords, ...['location', 'work_mode', 'employment_type', 'experience'].map((k) => filters[k]).filter(Boolean)]
                      .map((x) => <span key={x} className="chip on">{pretty(x)}</span>)}
                    <button type="button" className="link-btn" onClick={clear}>Clear all</button>
                  </div>
                )}
              </Bot>
            )}

            {busy === 'search' && <Bot><span className="typing" aria-label="Searching">...</span></Bot>}

            {/* ---- Result ---- */}
            {results && want === true && busy !== 'search' && (
              <Bot>
                {results.total > 0 ? (
                  <>
                    <p style={{ marginTop: 0 }}>
                      I found <strong>{results.total}</strong> open job{results.total > 1 ? 's' : ''}, sorted for your CV.
                      {results.relaxed.length > 0 && <> Nothing matched every filter, so I ignored: {results.relaxed.map(pretty).join(', ')}.</>}
                      {!results.used_ai && <span className="muted"> (AI understanding is busy, so I used simple matching.)</span>}
                    </p>
                    <div className="grid assist-grid">{results.items.map((v) => <MatchCard key={v.id} v={v} />)}</div>
                  </>
                ) : (
                  <>
                    <p style={{ marginTop: 0 }}>
                      <strong>No {wanted || 'matching'} jobs are open on this site right now.</strong>{' '}
                      Companies have not posted this kind of role yet. Try different words, or look at these
                      {results.alternatives_personalized ? ' jobs that are closest to your CV:' : ' latest jobs:'}
                    </p>
                    {results.alternatives.length === 0
                      ? <p className="muted" style={{ margin: 0 }}>There are no open vacancies at all right now.</p>
                      : <div className="grid assist-grid">{results.alternatives.map((v) => <MatchCard key={v.id} v={v} />)}</div>}
                  </>
                )}
              </Bot>
            )}
          </>
        )}
      </div>
    </section>
  )
}
