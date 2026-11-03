import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import ApplicationsTab from './ApplicationsTab'
import ProfileTab from './ProfileTab'
import SettingsTab from './SettingsTab'

const TABS = [
  ['applications', 'My applications'],
  ['profile', 'Profile and CV'],
  ['settings', 'Account settings'],
]

export default function CandidateDashboard() {
  const { users } = useAuth()
  const [tab, setTab] = useState('applications')

  return (
    <div className="container section">
      <h1>Welcome, {users.candidate?.full_name}</h1>
      <div className="tabs" role="tablist" aria-label="Dashboard sections">
        {TABS.map(([key, label]) => (
          <button
            key={key} role="tab" className="tab" id={`tab-${key}`}
            aria-selected={tab === key} aria-controls={`panel-${key}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'applications' && <ApplicationsTab />}
        {tab === 'profile' && <ProfileTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}

