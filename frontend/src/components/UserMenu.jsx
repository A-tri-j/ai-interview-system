import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export default function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const initials = (user.full_name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="usermenu" ref={ref}>
      <button className="avatar-btn" aria-haspopup="menu" aria-expanded={open}
        aria-label="Account menu" onClick={() => setOpen((o) => !o)}>{initials}</button>
      {open && (
        <div className="menu" role="menu" onClick={() => setOpen(false)}>
          <div className="menu-head">
            <strong>{user.full_name}</strong>
            <span className="muted">{user.email}</span>
          </div>
          <Link role="menuitem" to="/dashboard">My dashboard</Link>
          <Link role="menuitem" to="/dashboard?tab=saved">Saved jobs</Link>
          <Link role="menuitem" to="/recommend">Job finder</Link>
          <Link role="menuitem" to="/settings">Settings</Link>
          <button role="menuitem" className="menu-out" onClick={onLogout}>Log out</button>
        </div>
      )}
    </div>
  )
}

