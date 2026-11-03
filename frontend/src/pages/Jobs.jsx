import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Alert from '../components/Alert'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'
import Spinner from '../components/Spinner'
import VacancyCard from '../components/VacancyCard'
import { api, errorMessage } from '../services/api'

const PAGE_SIZE = 12
const FILTERS = ['q', 'location', 'employment_type', 'work_mode', 'experience']

const fromParams = (params) =>
  Object.fromEntries(FILTERS.map((k) => [k, params.get(k) || '']))

export default function Jobs() {
  const [params, setParams] = useSearchParams()
  const [form, setForm] = useState(() => fromParams(params))
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const key = params.toString()
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)

  // Back/forward button-e URL bodlale form-o milie nei
  useEffect(() => { setForm(fromParams(new URLSearchParams(key))) }, [key])

  useEffect(() => {
    let alive = true
    const query = Object.fromEntries(new URLSearchParams(key))
    const p = Math.max(1, parseInt(query.page || '1', 10) || 1)
    setLoading(true)
    setError('')
    api.public
      .get('/api/vacancies', { params: { ...query, page: p, page_size: PAGE_SIZE } })
      .then((r) => alive && setData(r.data))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [key])

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }))

  const apply = (e) => {
    e.preventDefault()
    const next = {}
    FILTERS.forEach((k) => { if (form[k].trim()) next[k] = form[k].trim() })
    setParams(next)
  }

  const goPage = (p) => {
    const next = new URLSearchParams(params)
    next.set('page', String(p))
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="container section">
      <h1>Browse vacancies</h1>

      <form className="card" onSubmit={apply} role="search" aria-label="Filter vacancies">
        <div className="filters">
          <div className="field">
            <label htmlFor="f-q">Search</label>
            <input id="f-q" value={form.q} onChange={set('q')} maxLength={100}
              placeholder="Title, company, skill" />
          </div>
          <div className="field">
            <label htmlFor="f-loc">Location</label>
            <input id="f-loc" value={form.location} onChange={set('location')} maxLength={100}
              placeholder="City or country" />
          </div>
          <div className="field">
            <label htmlFor="f-type">Job type</label>
            <select id="f-type" value={form.employment_type} onChange={set('employment_type')}>
              <option value="">Any</option>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
              <option value="freelance">Freelance</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-mode">Work mode</label>
            <select id="f-mode" value={form.work_mode} onChange={set('work_mode')}>
              <option value="">Any</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-exp">Experience</label>
            <input id="f-exp" value={form.experience} onChange={set('experience')} maxLength={100}
              placeholder="e.g. 1-3 years" />
          </div>
        </div>
        <div className="row-actions">
          <button className="btn btn-primary" type="submit">Search</button>
          <button className="btn btn-ghost" type="button" onClick={() => setParams({})}>Clear</button>
        </div>
      </form>

      <p className="muted" aria-live="polite" style={{ marginTop: 16 }}>
        {!loading && !error && `${data.total} vacancies found`}
      </p>

      {loading && <Spinner />}
      <Alert>{error}</Alert>
      {!loading && !error && data.items.length === 0 && (
        <EmptyState title="No vacancies match your search" text="Try fewer filters or different words." />
      )}
      {!loading && (
        <div className="grid">
          {data.items.map((v) => <VacancyCard key={v.id} v={v} />)}
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={goPage} />
    </div>
  )
}
