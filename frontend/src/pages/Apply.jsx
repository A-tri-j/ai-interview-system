import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '../components/Alert'
import EmptyState from '../components/EmptyState'
import Field from '../components/Field'
import Spinner from '../components/Spinner'
import { api, errorMessage } from '../services/api'

const MAX_MB = 5 // backend-er MAX_CV_MB-er shathe milte hobe

export function checkCv(file) {
  if (!file) return ''
  if (!/\.(pdf|docx)$/i.test(file.name)) return 'Only PDF or DOCX files are allowed'
  if (file.size === 0) return 'The file is empty'
  if (file.size > MAX_MB * 1024 * 1024) return `File is too large (max ${MAX_MB} MB)`
  return ''
}

export default function Apply() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [savedCv, setSavedCv] = useState(null)
  const [f, setF] = useState({ applicant_name: '', applicant_email: '', applicant_phone: '', education: '', message: '' })
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [duplicate, setDuplicate] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      api.public.get(`/api/vacancies/${id}`),
      api.candidate.get('/api/candidates/me/profile'),
    ])
      .then(([j, p]) => {
        if (!alive) return
        setJob(j.data)
        const prof = p.data
        setSavedCv(prof.documents?.[0] || null)
        // Profile theke form age-i bhore dei
        setF((x) => ({
          ...x, applicant_name: prof.full_name || '', applicant_email: prof.email || '',
          applicant_phone: prof.phone || '', education: prof.education || '',
        }))
      })
      .catch((e) => {
        if (!alive) return
        const s = e.response?.status
        if (s === 404 || s === 422) setNotFound(true)
        else if (s !== 401) setError(errorMessage(e))
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [id])

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  const validate = () => {
    const e = {}
    if (f.applicant_name.trim().length < 2) e.applicant_name = 'Enter your full name'
    if (!/^\S+@\S+\.\S+$/.test(f.applicant_email.trim())) e.applicant_email = 'Enter a valid email address'
    if (!/^\+?[0-9]{7,15}$/.test(f.applicant_phone.replace(/[\s-]/g, ''))) e.applicant_phone = 'Enter a valid phone number'
    if (f.education.trim().length < 2) e.education = 'Tell us about your education'
    const cvErr = checkCv(file)
    if (cvErr) e.cv = cvErr
    else if (!file && !savedCv) e.cv = 'Please upload your CV (PDF or DOCX)'
    return e
  }

  const submit = async (ev) => {
    ev.preventDefault()
    setError('')
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length) return

    const body = new FormData()
    body.append('vacancy_id', id)
    body.append('applicant_name', f.applicant_name.trim())
    body.append('applicant_email', f.applicant_email.trim().toLowerCase())
    body.append('applicant_phone', f.applicant_phone)
    body.append('education', f.education.trim())
    if (f.message.trim()) body.append('message', f.message.trim())
    if (file) body.append('cv', file)

    setBusy(true)
    try {
      await api.candidate.post('/api/applications', body)
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
      if (err.response?.status === 409) setDuplicate(true)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  if (notFound) {
    return (
      <div className="container section">
        <EmptyState title="This vacancy is no longer open">
          <Link to="/jobs" className="btn btn-primary">Browse vacancies</Link>
        </EmptyState>
      </div>
    )
  }
  if (!job) return <div className="container section"><Alert>{error}</Alert></div>

  if (done) {
    return (
      <div className="container">
        <div className="card form-card">
          <h1>Application sent</h1>
          <Alert type="success">
            Your application for {job.title} at {job.company.company_name} was submitted. We emailed you a confirmation.
          </Alert>
          <div className="row-actions">
            <Link to="/dashboard" className="btn btn-primary">Track my applications</Link>
            <Link to="/jobs" className="btn btn-ghost">More vacancies</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <form className="card form-card wide" onSubmit={submit} noValidate>
        <h1>Apply: {job.title}</h1>
        <p className="muted">{job.company.company_name} · {job.location}</p>
        <Alert>{error}</Alert>
        {duplicate && <p><Link to="/dashboard">View your applications</Link></p>}

        <div className="form-grid">
          <Field id="a-name" label="Full name" error={errors.applicant_name}>
            <input id="a-name" value={f.applicant_name} onChange={set('applicant_name')} maxLength={150} />
          </Field>
          <Field id="a-email" label="Email" error={errors.applicant_email}>
            <input id="a-email" type="email" value={f.applicant_email} onChange={set('applicant_email')} />
          </Field>
          <Field id="a-phone" label="Phone" error={errors.applicant_phone}>
            <input id="a-phone" type="tel" value={f.applicant_phone} onChange={set('applicant_phone')} />
          </Field>
        </div>

        <Field id="a-edu" label="Education" error={errors.education} hint="Degree, institute, year">
          <textarea id="a-edu" value={f.education} onChange={set('education')} maxLength={3000} />
        </Field>

        <Field id="a-cv" label="CV (PDF or DOCX, max 5 MB)" error={errors.cv}
          hint={savedCv && !file ? `No file chosen: your latest CV "${savedCv.filename}" will be used.` : 'Text-based files work best. Scanned images cannot be read.'}>
          <input id="a-cv" type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </Field>

        <Field id="a-msg" label="Message or question (optional)">
          <textarea id="a-msg" value={f.message} onChange={set('message')} maxLength={3000} />
        </Field>

        <div className="row-actions">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit application'}</button>
          <Link to={`/jobs/${id}`} className="btn btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
