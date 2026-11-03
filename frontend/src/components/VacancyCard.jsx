import { Link } from 'react-router-dom'
import { formatDate, pretty } from '../services/format'

export default function VacancyCard({ v }) {
  const skills = [...(v.required_skills || []), ...(v.required_technologies || [])].slice(0, 5)
  return (
    <article className="card vacancy-card">
      <div>
        <h3 className="vc-title">
          <Link to={`/jobs/${v.id}`}>{v.title}</Link>
        </h3>
        <p className="muted vc-company">{v.company.company_name}</p>
      </div>
      <div className="badges">
        <span className="badge">{pretty(v.work_mode)}</span>
        <span className="badge">{pretty(v.employment_type)}</span>
        <span className="badge">{v.location}</span>
      </div>
      {skills.length > 0 && (
        <div className="tags">
          {skills.map((s) => <span className="tag" key={s}>{s}</span>)}
        </div>
      )}
      <div className="vc-foot muted">
        {v.deadline ? `Apply by ${formatDate(v.deadline)}` : 'Open until filled'}
      </div>
    </article>
  )
}

