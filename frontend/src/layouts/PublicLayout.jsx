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
        <div className="container footer-content">
          <div className="footer-top">
            <div className="footer-brand-col">
              <Link to="/" className="brand">AI<span>Interview</span></Link>
              <p className="footer-tagline">
                AI-driven smart interview platform. AI scores are advisory — people make hiring decisions.
              </p>
            </div>

            <div className="footer-links-col">
              <span className="footer-heading">Platform</span>
              <div className="footer-links">
                <Link to="/jobs">Browse Jobs</Link>
                <Link to="/recommend">AI Job Finder</Link>
                <Link to="/company/login">Company Portal</Link>
              </div>
            </div>

            <div className="footer-creator-col">
              <span className="footer-heading">Creator & Developer</span>
              <div className="footer-creator-card">
                <div className="creator-avatar" aria-hidden="true">AG</div>
                <div className="creator-info">
                  <div className="creator-role">Built by</div>
                  <div className="creator-name">Atrij Ghosh</div>
                  <a href="mailto:atrijghosh07@gmail.com" className="creator-email" title="Send email to Atrij Ghosh">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect width="20" height="16" x="2" y="4" rx="2"/>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                    atrijghosh07@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} AI Interview Platform. All rights reserved.</span>
            <span className="footer-pill">Fair & Transparent by Design</span>
          </div>
        </div>
      </footer>
    </>
  )
}
