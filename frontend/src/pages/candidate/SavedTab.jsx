import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '../../components/Alert'
import EmptyState from '../../components/EmptyState'
import Spinner from '../../components/Spinner'
import { useSaved } from '../../hooks/useSaved'
import { api, errorMessage } from '../../services/api'
import { formatDate } from '../../services/format'
import MatchCard from '../recommend/MatchCard'

export default function SavedTab() {
  const { ids, toggle } = useSaved()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api.candidate.get('/api/saved')
      .then((r) => alive && setItems(r.data.items))
      .catch((e) => alive && setError(errorMessage(e)))
    return () => { alive = false }
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!items) return <Spinner />
  // Heart theke unsave korle sathe sathe list theke jay
  const list = items.filter((v) => ids.includes(v.id))
  if (list.length === 0) {
    return (
      <EmptyState title="No saved jobs" text="Tap the heart on any job to keep it here for later.">
        <Link to="/jobs" className="btn btn-primary">Browse vacancies</Link>
      </EmptyState>
    )
  }
  const open = list.filter((v) => v.open)
  const closed = list.filter((v) => !v.open)
  return (
    <div className="stack">
      {open.length > 0 && <div className="grid" style={{ marginTop: 0 }}>{open.map((v) => <MatchCard key={v.id} v={v} />)}</div>}
      {closed.length > 0 && (
        <section className="card">
          <h3>No longer open</h3>
          <ul className="doc-list">
            {closed.map((v) => (
              <li key={v.id}>
                <span>{v.title} <span className="muted">· {v.company.company_name} · saved {formatDate(v.saved_at)}</span></span>
                <button className="btn btn-ghost btn-sm" onClick={() => toggle(v.id)}>Remove</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
