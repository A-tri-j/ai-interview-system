import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import AuroraBackground from '../components/AuroraBackground'
import ThemeToggle from '../components/ThemeToggle'
import UserMenu from '../components/UserMenu'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

export default function PublicLayout() {
  const [open, setOpen] = useState(false)
  const { users, logout } = useAuth()
  const { theme } = useTheme()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  const signOut = (role) => {
    logout(role)
    navigate('/')
  }

  return (
    <>
      {theme === 'aurora' && <AuroraBackground />}
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">AI<span>Interview</span></Link>
          <div className="spacer" />

          <nav className={`nav ${open ? 'open' : ''}`} aria-label="Main" onClick={() => setOpen(false)}>
            <NavLink to="/jobs">Jobs</NavLink>
            {users.candidate ? (
              <>
                <NavLink to="/recommend">Job finder</NavLink>
                <NavLink to="/dashboard">Dashboard</NavLink>
              </>
            ) : users.company ? (
              <>
                <NavLink to="/company">Company dashboard</NavLink>
                <button className="btn btn-ghost btn-sm" onClick={() => signOut('company')}>Log out</button>
              </>
            ) : (
              <>
                <NavLink to="/company/login">For companies</NavLink>
                <NavLink to="/login">Sign in</NavLink>
                <Link to="/register" className="btn btn-primary btn-sm">Create account</Link>
              </>
            )}
          </nav>

          <ThemeToggle />
          {users.candidate && <UserMenu user={users.candidate} onLogout={() => signOut('candidate')} />}
          <button className="icon-btn menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? '✕' : '☰'}
          </button>
        </div>
      </header>

      <main id="main" className="main">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <span>© {new Date().getFullYear()} AI Interview Platform</span>
          <span className="muted">AI scores are advisory. People make hiring decisions.</span>
        </div>
      </footer>
    </>
  )
}
