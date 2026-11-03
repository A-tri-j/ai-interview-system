import { useCallback, useEffect, useState } from 'react'
import Alert from '../../components/Alert'
import Field from '../../components/Field'
import Spinner from '../../components/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { api, errorMessage } from '../../services/api'
import { formatDate } from '../../services/format'
import { checkCv } from '../Apply'

export default function ProfileTab() {
  const { reload } = useAuth()
  const [f, setF] = useState(null)
  const [docs, setDocs] = useState([])
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState(null)
  const [cvError, setCvError] = useState('')
  const [cvOk, setCvOk] = useState('')
  const [uploading, setUploading] = useState(false)

  const apply = (p) => {
    setF({
      full_name: p.full_name || '', phone: p.phone || '', education: p.education || '',
      skills: (p.skills || []).join(', '), experience: p.experience || '',
      projects: p.projects || '', portfolio_url: p.portfolio_url || '',
    })
    setDocs(p.documents || [])
  }

  const load = useCallback(async () => {
    try {
      const { data } = await api.candidate.get('/api/candidates/me/profile')
      apply(data)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setError('')
    setOk('')
    const errs = {}
    if (f.full_name.trim().length < 2) errs.full_name = 'Enter your full name'
    if (!/^\+?[0-9]{7,15}$/.test(f.phone.replace(/[\s-]/g, ''))) errs.phone = 'Enter a valid phone number'
    if (f.portfolio_url.trim() && !/^https?:\/\//.test(f.portfolio_url.trim())) errs.portfolio_url = 'Must start with http:// or https://'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setBusy(true)
    try {
      const { data } = await api.candidate.put('/api/candidates/me/profile', {
        full_name: f.full_name.trim(), phone: f.phone, education: f.education.trim(),
        skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean),
        experience: f.experience.trim(), projects: f.projects.trim(),
        portfolio_url: f.portfolio_url.trim() || null,
      })
      apply(data)
      reload('candidate') // header-er naam update
      setOk('Profile saved.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const upload = async (e) => {
    e.preventDefault()
    setCvError('')
    setCvOk('')
    if (!file) return setCvError('Choose a PDF or DOCX file first')
    const msg = checkCv(file)
    if (msg) return setCvError(msg)
    const body = new FormData()
    body.append('cv', file)
    setUploading(true)
    try {
      await api.candidate.post('/api/candidates/me/cv', body)
      setCvOk('CV uploaded.')
      setFile(null)
      e.target.reset()
      await load()
    } catch (err) {
      setCvError(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <Spinner />
  if (!f) return <Alert>{error}</Alert>

  return (
    <div className="stack">
      <form className="card" onSubmit={save} noValidate>
        <h2>Profile</h2>
        <p className="muted">A complete profile helps the AI ask better questions about your experience.</p>
        <Alert>{error}</Alert>
        <Alert type="success">{ok}</Alert>
        <div className="form-grid">
          <Field id="p-name" label="Full name" error={errors.full_name}>
            <input id="p-name" value={f.full_name} onChange={set('full_name')} maxLength={150} />
          </Field>
          <Field id="p-phone" label="Phone" error={errors.phone}>
            <input id="p-phone" type="tel" value={f.phone} onChange={set('phone')} />
          </Field>
        </div>
        <Field id="p-edu" label="Education"><textarea id="p-edu" value={f.education} onChange={set('education')} maxLength={3000} /></Field>
        <Field id="p-skills" label="Skills" hint="Separate with commas, e.g. React, JavaScript, Python">
          <input id="p-skills" value={f.skills} onChange={set('skills')} />
        </Field>
        <Field id="p-exp" label="Experience"><textarea id="p-exp" value={f.experience} onChange={set('experience')} maxLength={5000} /></Field>
        <Field id="p-proj" label="Projects"><textarea id="p-proj" value={f.projects} onChange={set('projects')} maxLength={5000} /></Field>
        <Field id="p-url" label="Portfolio URL" error={errors.portfolio_url}>
          <input id="p-url" type="url" value={f.portfolio_url} onChange={set('portfolio_url')} placeholder="https://" />
        </Field>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save profile'}</button>
      </form>

      <form className="card" onSubmit={upload}>
        <h2>My CV</h2>
        {docs.length === 0 ? (
          <p className="muted">No CV uploaded yet.</p>
        ) : (
          <ul className="doc-list">
            {docs.map((d, i) => (
              <li key={d.id}>
                <span>{d.filename}{i === 0 ? ' (latest, used for new applications)' : ''}</span>
                <span className="muted">{Math.max(1, Math.round(d.size_bytes / 1024))} KB · {formatDate(d.uploaded_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <Alert>{cvError}</Alert>
        <Alert type="success">{cvOk}</Alert>
        <Field id="p-cv" label="Upload a new CV (PDF or DOCX, max 5 MB)">
          <input id="p-cv" type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </Field>
        <button className="btn btn-ghost" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload CV'}</button>
      </form>
    </div>
  )
}

