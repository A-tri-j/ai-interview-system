// Home page AI chat assistant: CV upload -> Match % -> Job suggestions -> Filtering -> Search.
// Powered by /api/recommend/*. Requires candidate authentication.
import { useEffect, useRef, useState } from 'react'
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

  const [saved, setSaved] = useState(undefined)   // undefined = unknown, null = no CV, object = CV exists
  const [analysis, setAnalysis] = useState(null)
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState('')            // '' | upload | analyse | search
  const [error, setError] = useState('')
  const [want, setWant] = useState(null)          // null = unprompted, true / false
  const [filters, setFilters] = useState(EMPTY)
  const [results, setResults] = useState(null)
  const [input, setInput] = useState('')
  const [loc, setLoc] = useState('')
  const fileInputRef = useRef(null)

  // Check if candidate has an existing CV on file (lightweight profile call, no AI)
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

  const handleFileSelect = (selectedFile) => {
    setError('')
    const msg = checkCv(selectedFile)
    if (msg) return setError(msg)
    setFile(selectedFile)
  }

  const upload = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
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
      if (fileInputRef.current) fileInputRef.current.value = ''
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

  // ---------- CV Suggestions ----------
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
          <div className="bot-greeting">
            <div className="bot-avatar-pill" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
              </svg>
            </div>
            <div className="bot-greeting-text">
              Hi! To get started, please <strong>upload or select your CV</strong> (PDF or DOCX). I will analyze its completeness, highlight your key skills, and find the highest-matching open jobs for you.
            </div>
          </div>
        </Bot>

        {/* ---- Login ---- */}
        {!authLoading && !candidate && (
          <Bot>
            <p style={{ marginTop: 0 }}>Please sign in so I can safely read and store your CV.</p>
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
              <div className="existing-cv-card">
                <div className="cv-card-left">
                  <div className="cv-icon-badge" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <span className="ext">{saved.filename.split('.').pop()?.toUpperCase() || 'CV'}</span>
                  </div>
                  <div className="cv-meta">
                    <div className="cv-title-row">
                      <span className="cv-filename" title={saved.filename}>{saved.filename}</span>
                      <span className="cv-status-tag">
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                        Saved on profile
                      </span>
                    </div>
                    <span className="cv-subtitle">Ready to match with open vacancies</span>
                  </div>
                </div>

                <button 
                  type="button" 
                  className="btn btn-primary btn-sm btn-analyse-cta" 
                  onClick={analyse} 
                  disabled={Boolean(busy)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Analyse this CV
                </button>
              </div>
            )}

            {saved && (
              <div className="cv-divider">
                <span>OR UPLOAD A DIFFERENT CV</span>
              </div>
            )}

            <div
              className={`custom-dropzone ${dragOver ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const dropped = e.dataTransfer.files?.[0]
                if (dropped) handleFileSelect(dropped)
              }}
              onClick={() => !file && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                id="home-cv"
                type="file"
                accept=".pdf,.docx"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const selected = e.target.files?.[0]
                  if (selected) handleFileSelect(selected)
                }}
              />

              {!file ? (
                <div className="dropzone-empty">
                  <div className="dropzone-cloud-icon" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div className="dropzone-text">
                    <span className="dropzone-main-text">
                      <span className="dropzone-highlight">Click to browse</span> or drag and drop your file here
                    </span>
                    <span className="dropzone-sub-text">Supported formats: PDF or DOCX (Max 5 MB)</span>
                  </div>
                </div>
              ) : (
                <div className="file-selected-box">
                  <div className="file-selected-left">
                    <div className="cv-icon-badge" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span className="ext">{file.name.split('.').pop()?.toUpperCase() || 'CV'}</span>
                    </div>
                    <div className="cv-meta">
                      <span className="file-selected-name" title={file.name}>{file.name}</span>
                      <span className="file-selected-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                  </div>

                  <div className="file-selected-actions">
                    <button
                      type="button"
                      className="btn-discard-file"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      title="Remove file"
                      aria-label="Remove selected file"
                    >
                      ✕
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm btn-analyse-cta"
                      disabled={busy === 'upload'}
                      onClick={(e) => {
                        e.stopPropagation()
                        upload()
                      }}
                    >
                      {busy === 'upload' ? 'Uploading...' : 'Upload & Analyse ⚡'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="cv-privacy-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>100% Private to you. Companies cannot view your CV until you apply. Scanned images cannot be read.</span>
            </div>
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

