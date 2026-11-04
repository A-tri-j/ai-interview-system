import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../hooks/useAuth'

const LINKS = [
  ['/admin', 'Dashboard', true],
  ['/admin/companies', 'Companies'],
  ['/admin/candidates', 'Candidates'],
  ['/admin/vacancies', 'Vacancies'],
  ['/admin/audit', 'Audit log'],
  ['/admin/users', 'Users'],
  ['/admin/reports', 'Reports'],
  ['/admin/settings', 'Settings'],
]

export default function AdminLayout() {
  const { users, logout } = useAuth()
  const navigate = useNavigate()

  const signOut = () => {
    logout('admin')
    navigate('/admin/login', { replace: true })
  }

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <span className="brand">AI<span>Interview</span> <span className="muted admin-tag">Admin</span></span>
          <div className="spacer" />
          <span className="muted admin-email">{users.admin?.email}</span>
          <ThemeToggle />
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Log out</button>
        </div>
        <div className="container">
          <nav className="tabs admin-tabs" aria-label="Admin sections">
            {LINKS.map(([to, label, end]) => (
              <NavLink key={to} to={to} end={end} className="tab">{label}</NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="main container section">
        <Outlet />
      </main>
    </>
  )
}

