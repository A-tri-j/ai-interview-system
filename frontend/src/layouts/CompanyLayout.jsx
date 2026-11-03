import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import Alert from '../components/Alert'
import { useAuth } from '../hooks/useAuth'

const NOTICE = {
  pending_approval: ['info', 'Your company is waiting for admin approval. You can prepare vacancy drafts, but you cannot publish yet.'],
  pending_verification: ['info', 'Please verify your company email.'],
}

export default function CompanyLayout() {
  const { users, reload } = useAuth()
  const company = users.company

  // Admin approve korle jate notun status dekhay
  useEffect(() => { reload('company') }, [reload])

  const notice = NOTICE[company?.status]
  return (
    <div className="container section">
      <h1>{company?.company_name}</h1>
      {notice && <Alert type={notice[0]}>{notice[1]}</Alert>}
      <nav className="tabs" aria-label="Company sections">
        <NavLink end to="/company" className="tab">Overview</NavLink>
        <NavLink to="/company/vacancies" className="tab">Vacancies</NavLink>
        <NavLink to="/company/applications" className="tab">Applicants</NavLink>
      </nav>
      <Outlet />
    </div>
  )
}
