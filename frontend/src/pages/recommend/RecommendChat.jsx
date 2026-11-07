import { useEffect, useRef, useState } from 'react'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'
import { pretty } from '../../services/format'
import MatchCard from './MatchCard'

const EMPTY = { keywords: [], location: null, work_mode: null, employment_type: null, experience: null }
const TYPES = [['full_time', 'Full time'], ['part_time', 'Part time'], ['internship', 'Internship'], ['contract', 'Contract'], ['freelance', 'Freelance']]
const MODES = [['remote', 'Remote'], ['hybrid', 'Hybrid'], ['onsite', 'On-site']]
const EXPS = ['Fresher', '1-3 years', '3-5 years', '5+ years']
const HELLO = 'Hi! Tell me what kind of job you want, for example “remote React developer” or “internship in Kolkata”. You can write in English or Bengali. You can also use the quick filters below.'

function Chip({ active, onClick, children }) {
  return (
    <button type="button" className={`chip ${active ? 'on' : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  )
}

export default function RecommendChat() {
  const [filters, setFilters] = useState(EMPTY)
  const [messages, setMessages] = useState([{ role: 'bot', text: HELLO }])
  const [input, setInput] = useState('')
  const [loc, setLoc] = useState('')
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const logRef = useRef(null)

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const run = async (message, f) => {
    setBusy(true)
    setError('')
    try {
      const { data } = await api.candidate.post(
        '/api/recommend/search', { message: message || null, filters: f }, { timeout: 90000 },
      )
      setFilters(data.understood)
      setResults(data)
      return data
    } catch (e) {
      setError(errorMessage(e))
      return null
    } finally {
      setBusy(false)
    }
  }

  const send = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    const data = await run(text, filters)
    if (!data) {
      setMessages((m) => [...m, { role: 'bot', text: 'Sorry, I could not search right now. Please try again.' }])
      return
    }
    let reply = data.total
      ? `I found ${data.total} vacanc${data.total > 1 ? 'ies' : 'y'}.`
      : 'I could not find a matching open vacancy. Try different words or remove a filter.'
    if (data.relaxed.length) reply += ` Nothing matched every filter, so I ignored: ${data.relaxed.map(pretty).join(', ')}.`
    if (!data.used_ai) reply += ' (AI understanding is unavailable, so I used simple matching.)'
    setMessages((m) => [...m, { role: 'bot', text: reply }])
  }

  const toggle = (key, value) => run(null, { ...filters, [key]: filters[key] === value ? null : value })
  const setLocation = (e) => {
    e.preventDefault()
    run(null, { ...filters, location: loc.trim() || null })
  }
  const removeKeyword = (k) => run(null, { ...filters, keywords: filters.keywords.filter((x) => x !== k) })
  const clear = () => {
    setFilters(EMPTY)
    setResults(null)
    setLoc('')
    setError('')
  }

  const active = [
    ...filters.keywords.map((k) => ({ label: k, remove: () => removeKeyword(k) })),
    ...['location', 'work_mode', 'employment_type', 'experience']
      .filter((k) => filters[k])
      .map((k) => ({ label: pretty(filters[k]), remove: () => run(null, { ...filters, [k]: null }) })),
  ]

  return (
    <div className="stack">
      <section className="card chat">
        <div className="chat-log" ref={logRef} role="log" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>{m.text}</div>
          ))}
          {busy && <div className="bubble bot"><span className="typing" aria-label="Searching">...</span></div>}
        </div>
        <form className="chat-input" onSubmit={send}>
          <label htmlFor="chat-q" className="sr-only">Describe the job you want</label>
          <input id="chat-q" value={input} onChange={(e) => setInput(e.target.value)} maxLength={300}
            placeholder="e.g. remote React developer, or amar fresher er jonno internship chai" />
          <button className="btn btn-primary" disabled={busy || !input.trim()}>Send</button>
        </form>
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1.05rem' }}>Quick filters</h2>
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
          <label htmlFor="chip-loc" className="muted chip-label">Location</label>
          <input id="chip-loc" value={loc} onChange={(e) => setLoc(e.target.value)} maxLength={100}
            placeholder="City or country" style={{ maxWidth: 220 }} />
          <button className="btn btn-ghost btn-sm" disabled={busy}>Set</button>
        </form>
        {active.length > 0 && (
          <div className="chip-group" aria-label="Active filters">
            <span className="muted chip-label">Searching for</span>
            {active.map((a) => (
              <span className="chip on" key={a.label}>
                {a.label}
                <button type="button" className="chip-x" aria-label={`Remove ${a.label}`} onClick={a.remove}>×</button>
              </span>
            ))}
            <button type="button" className="link-btn" onClick={clear}>Clear all</button>
          </div>
        )}
      </section>

      <Alert>{error}</Alert>
      {busy && !results && <Spinner />}
      {results && (
        <section>
          <h2>{results.total} vacanc{results.total === 1 ? 'y' : 'ies'}</h2>
          {!results.personalized && results.total > 0 && (
            <Alert type="info">Upload your CV in the “My CV match” tab to see a match % on every job.</Alert>
          )}
          <div className="grid">
            {results.items.map((v) => <MatchCard key={v.id} v={v} />)}
          </div>
        </section>
      )}
    </div>
  )
}

