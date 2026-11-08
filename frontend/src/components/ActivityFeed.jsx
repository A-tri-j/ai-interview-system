import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from './Alert'
import Spinner from './Spinner'
import { api, errorMessage } from '../services/api'
import { timeAgo } from '../services/format'

const ICON = { applied: '📨', status: '🔔', interview: '🎥', mcq: '📝', saved: '♥' }

export default function ActivityFeed({ limit = 10 }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api.candidate.get('/api/candidates/me/activity', { params: { limit } })
      .then((r) => alive && setItems(r.data.items))
      .catch((e) => alive && setError(errorMessage(e)))
    return () => { alive = false }
  }, [limit])

  if (error) return <Alert>{error}</Alert>
  if (!items) return <Spinner />
  if (items.length === 0) return <p className="muted">No activity yet. Apply to a job or save one for later and it will show up here.</p>

  return (
    <ol className="timeline">
      {items.map((e, i) => (
        <li key={i}>
          <span className="tl-icon" aria-hidden="true">{ICON[e.type] || '•'}</span>
          <div>
            <Link to={e.link}>{e.text}</Link>
            <div className="muted" style={{ fontSize: '0.82rem' }}>{timeAgo(e.at)}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}
