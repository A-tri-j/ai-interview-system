import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSaved } from '../hooks/useSaved'

// variant: 'icon' (card-er kone) ba 'text' (button)
export default function SaveButton({ vacancyId, variant = 'icon' }) {
  const { users } = useAuth()
  const { ids, toggle } = useSaved()
  const location = useLocation()
  const [err, setErr] = useState('')
  const saved = ids.includes(vacancyId)

  if (!users.candidate) {
    const to = { pathname: '/login' }
    const state = { from: location.pathname + location.search }
    return variant === 'icon'
      ? <Link to={to} state={state} className="save-icon" aria-label="Sign in to save this job" title="Sign in to save this job">♡</Link>
      : <Link to={to} state={state} className="btn btn-ghost btn-sm">♡ Sign in to save</Link>
  }

  const click = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setErr((await toggle(vacancyId)) || '')
  }

  if (variant === 'icon') {
    return (
      <button type="button" className={`save-icon ${saved ? 'on' : ''}`} onClick={click} aria-pressed={saved}
        aria-label={saved ? 'Remove from saved jobs' : 'Save job for later'} title={err || (saved ? 'Saved' : 'Save for later')}>
        {saved ? '♥' : '♡'}
      </button>
    )
  }
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={click} aria-pressed={saved}>
        {saved ? '♥ Saved' : '♡ Save for later'}
      </button>
      {err && <span className="err" role="alert">{err}</span>}
    </>
  )
}
