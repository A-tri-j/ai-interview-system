// Create + edit ek-i form. Route: /company/vacancies/new ar /company/vacancies/:id/edit
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Alert from '../../components/Alert'
import Field from '../../components/Field'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'

const EMPTY = {
  title: '', department: '', description: '', responsibilities: '',
  required_skills: '', required_technologies: '', education_requirements: '',
  experience_requirements: '', employment_type: 'full_time', salary_range: '',
  location: '', work_mode: 'onsite', openings: 1, deadline: '', interview_instructions: '',
}

const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean)
const nullIfEmpty = (s) => (s.trim() ? s.trim() : null)

function toPayload(f) {
  return {
    title: f.title.trim(), department: nullIfEmpty(f.department), description: f.description.trim(),
    responsibilities: nullIfEmpty(f.responsibilities),
    required_skills: list(f.required_skills), required_technologies: list(f.required_technologies),
    education_requirements: nullIfEmpty(f.education_requirements),
    experience_requirements: nullIfEmpty(f.experience_requirements),
    employment_type: f.employment_type, salary_range: nullIfEmpty(f.salary_range),
    location: f.location.trim(), work_mode: f.work_mode,
    openings: Number(f.openings) || 1, deadline: f.deadline || null,
    interview_instructions: nullIfEmpty(f.interview_instructions),
  }
}

export default function VacancyForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [f, setF] = useState(EMPTY)
  const [status, setStatus] = useState('draft')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(editing)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!editing) return
    let alive = true
    api.company.get(`/api/company/vacancies/${id}`)
      .then(({ data: v }) => {
        if (!alive) return
        setStatus(v.status)
        setF({
          title: v.title, department: v.department || '', description: v.description,
          responsibilities: v.responsibilities || '',
          required_skills: (v.required_skills || []).join(', '),
          required_technologies: (v.required_technologies || []).join(', '),
          education_requirements: v.education_requirements || '',
          experience_requirements: v.experience_requirements || '',
          employment_type: v.employment_type, salary_range: v.salary_range || '',
          location: v.location, work_mode: v.work_mode, openings: v.openings,
          deadline: v.deadline || '', interview_instructions: v.interview_instructions || '',
        })
      })
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [editing, id])

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  const validate = () => {
    const e = {}
    if (f.title.trim().length < 3) e.title = 'Enter a job title (at least 3 characters)'
    if (f.description.trim().length < 20) e.description = 'Describe the job (at least 20 characters)'
    if (f.location.trim().length < 2) e.location = 'Enter the location'
    if (!(Number(f.openings) >= 1 && Number(f.openings) <= 1000)) e.openings = 'Enter a number from 1 to 1000'
    return e
  }

  const save = async (publish) => {
    setError('')
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      let vid = id
      if (editing) {
        await api.company.patch(`/api/company/vacancies/${id}`, toPayload(f))
      } else {
        const { data } = await api.company.post('/api/company/vacancies', toPayload(f))
        vid = data.id
      }
      if (publish) {
        try {
          await api.company.post(`/api/company/vacancies/${vid}/publish`)
        } catch (err) {
          // Save hoyeche, kintu publish hoy ni (jemon company approved na)
          navigate(`/company/vacancies/${vid}/edit`, { replace: true })
          setError(`Saved as draft, but not published: ${errorMessage(err)}`)
          setBusy(false)
          return
        }
      }
      navigate('/company/vacancies')
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  const closed = status === 'closed'

  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); save(false) }} noValidate>
      <h2>{editing ? 'Edit vacancy' : 'New vacancy'}</h2>
      <Alert>{error}</Alert>
      {closed && <Alert type="info">This vacancy is closed. Reopen it from the vacancy list before editing.</Alert>}

      <fieldset disabled={closed} className="plain-fieldset">
        <div className="form-grid">
          <Field id="v-title" label="Job title" error={errors.title}>
            <input id="v-title" value={f.title} onChange={set('title')} maxLength={200} />
          </Field>
          <Field id="v-dept" label="Department">
            <input id="v-dept" value={f.department} onChange={set('department')} maxLength={150} />
          </Field>
          <Field id="v-type" label="Employment type">
            <select id="v-type" value={f.employment_type} onChange={set('employment_type')}>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
              <option value="freelance">Freelance</option>
            </select>
          </Field>
          <Field id="v-mode" label="Work mode">
            <select id="v-mode" value={f.work_mode} onChange={set('work_mode')}>
              <option value="onsite">On-site</option>
              <option value="hybrid">Hybrid</option>
              <option value="remote">Remote</option>
            </select>
          </Field>
          <Field id="v-loc" label="Location" error={errors.location}>
            <input id="v-loc" value={f.location} onChange={set('location')} maxLength={200} />
          </Field>
          <Field id="v-sal" label="Salary range (optional)">
            <input id="v-sal" value={f.salary_range} onChange={set('salary_range')} maxLength={100} placeholder="e.g. 40,000 - 60,000 per month" />
          </Field>
          <Field id="v-open" label="Number of openings" error={errors.openings}>
            <input id="v-open" type="number" min="1" max="1000" value={f.openings} onChange={set('openings')} />
          </Field>
          <Field id="v-dead" label="Application deadline" hint="Leave empty for no deadline.">
            <input id="v-dead" type="date" value={f.deadline} onChange={set('deadline')} />
          </Field>
          <Field id="v-exp" label="Experience requirement">
            <input id="v-exp" value={f.experience_requirements} onChange={set('experience_requirements')} maxLength={200} placeholder="e.g. 1-3 years" />
          </Field>
        </div>

        <Field id="v-desc" label="Job description" error={errors.description}>
          <textarea id="v-desc" value={f.description} onChange={set('description')} maxLength={10000} />
        </Field>
        <Field id="v-resp" label="Responsibilities">
          <textarea id="v-resp" value={f.responsibilities} onChange={set('responsibilities')} maxLength={5000} />
        </Field>
        <div className="form-grid">
          <Field id="v-skills" label="Required skills" hint="Separate with commas">
            <input id="v-skills" value={f.required_skills} onChange={set('required_skills')} placeholder="React.js, JavaScript" />
          </Field>
          <Field id="v-tech" label="Required technologies" hint="Separate with commas">
            <input id="v-tech" value={f.required_technologies} onChange={set('required_technologies')} placeholder="REST APIs, Git" />
          </Field>
        </div>
        <Field id="v-edu" label="Educational qualifications">
          <textarea id="v-edu" value={f.education_requirements} onChange={set('education_requirements')} maxLength={2000} style={{ minHeight: 70 }} />
        </Field>
        <Field id="v-int" label="Interview instructions (private)"
          hint="Used by the AI to choose and judge interview questions. Candidates cannot see this. Example: focus on React hooks and API design.">
          <textarea id="v-int" value={f.interview_instructions} onChange={set('interview_instructions')} maxLength={5000} />
        </Field>
      </fieldset>

      <div className="row-actions">
        {!closed && <button className="btn btn-ghost" disabled={busy}>{editing ? 'Save changes' : 'Save draft'}</button>}
        {!closed && status !== 'published' && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => save(true)}>
            {busy ? 'Saving...' : 'Save and publish'}
          </button>
        )}
        <Link to="/company/vacancies" className="btn btn-ghost">Cancel</Link>
      </div>
    </form>
  )
}
