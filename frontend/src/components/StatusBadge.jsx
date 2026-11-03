// Application status -> readable label + rong (ok = sobuj, bad = lal, warn = amber)
const MAP = {
  submitted: ['Submitted', ''],
  under_review: ['Under review', ''],
  approved_for_interview: ['Interview invited', 'ok'],
  rejected: ['Not selected', 'bad'],
  interview_completed: ['Interview completed', 'ok'],
  shortlisted: ['Shortlisted', 'ok'],
  accepted: ['Accepted', 'ok'],
  on_hold: ['On hold', 'warn'],
  final_rejected: ['Not selected', 'bad'],
}

export default function StatusBadge({ status }) {
  const [label, tone] = MAP[status] || [status, '']
  return <span className={`badge ${tone ? `badge-${tone}` : ''}`}>{label}</span>
}

