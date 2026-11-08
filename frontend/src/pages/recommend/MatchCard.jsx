import { Link } from 'react-router-dom'
import SaveButton from '../../components/SaveButton'
import { formatDate, pretty } from '../../services/format'

const tone = (p) => (p >= 75 ? 'high' : p >= 55 ? 'mid' : 'low')

export default function MatchCard({ v, onPrep }) {
  const m = v.match
  return (
    <article className="card vacancy-card match-card">
      <div className="mc-top">
        <div style={{ minWidth: 0 }}>
          <h3 className="vc-title">
            <Link to={`/jobs/${v.id}`} className="stretched-link">{v.title}</Link>
          </h3>
          <p className="muted vc-company">{v.company.company_name}</p>
        </div>
        {m && (
          <div className={`ring ring-${tone(m.percent)}`} title={m.label}>
            <span>{m.percent}%</span>
          </div>
        )}
      </div>

      <div className="badges">
        <span className="badge">{pretty(v.work_mode)}</span>
        <span className="badge">{pretty(v.employment_type)}</span>
        <span className="badge">{v.location}</span>
      </div>

      {m && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>{m.label}</span>
          {m.matched.length > 0 && (
            <div className="tags">
              {m.matched.slice(0, 5).map((s) => <span className="tag tag-ok" key={s}>✓ {s}</span>)}
            </div>
          )}
          {m.missing.length > 0 && (
            <div className="tags">
              {m.missing.slice(0, 4).map((s) => <span className="tag tag-miss" key={s}>{s}</span>)}
            </div>
          )}
        </div>
      )}

      <div className="vc-foot muted">
        {v.deadline ? `Apply by ${formatDate(v.deadline)}` : 'Open until filled'}
      </div>
      <div className="row-actions mc-actions">
        {v.applied ? <span className="badge badge-ok">Applied</span> : (
          <Link to={`/jobs/${v.id}/apply`} className="btn btn-primary btn-sm">Apply</Link>
        )}
        <SaveButton vacancyId={v.id} variant="text" />
        {onPrep && m && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPrep(v)}>
            Interview prep
          </button>
        )}
      </div>
    </article>
  )
}

