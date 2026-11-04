import EmptyState from '../../components/EmptyState'

const TEXT = {
  Users: 'Manage candidate and company accounts: disable, enable, and review activity.',
  Reports: 'Platform reports: application and interview statistics over time.',
  Settings: 'Platform settings: notification rules, retention period and limits.',
}

export default function AdminPlaceholder({ title }) {
  return (
    <div className="stack">
      <h1>{title}</h1>
      <EmptyState title="Coming soon" text={TEXT[title]} />
    </div>
  )
}

