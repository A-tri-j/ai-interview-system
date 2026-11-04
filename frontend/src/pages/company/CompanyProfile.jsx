import { useEffect, useState } from 'react'
import Alert from '../../components/Alert'
import Field from '../../components/Field'
import PasswordInput from '../../components/PasswordInput'
import Spinner from '../../components/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { api, errorMessage, tokenStore } from '../../services/api'

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/

function Password() {
  const [f, setF] = useState({ cur: '', next: '', conf: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setOk('')
    const errs = {}
    if (!f.cur) errs.cur = 'Enter your current password'
    if (!PASSWORD_RULE.test(f.next)) errs.next = 'At least 8 characters with an uppercase letter, a lowercase letter and a number'
    if (f.next !== f.conf) errs.conf = 'Passwords do not match'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const { data } = await api.company.post('/api/company/change-password', {
        current_password: f.cur, new_password: f.next, confirm_password: f.conf,
      })
      if (data.access_token) tokenStore.set('company', data.access_token) // logout hobe na
      setOk('Password changed.')
      setF({ cur: '', next: '', conf: '' })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Change password</h2>
      <Alert>{error}</Alert>
      <Alert type="success">{ok}</Alert>
      <Field id="cpw-cur" label="Current password" error={errors.cur}>
        <PasswordInput id="cpw-cur" value={f.cur} onChange={set('cur')} autoComplete="current-password" invalid={!!errors.cur} />
      </Field>
      <Field id="cpw-new" label="New password" error={errors.next}>
        <PasswordInput id="cpw-new" value={f.next} onChange={set('next')} autoComplete="new-password" invalid={!!errors.next} />
      </Field>
      <Field id="cpw-conf" label="Confirm new password" error={errors.conf}>
        <PasswordInput id="cpw-conf" value={f.conf} onChange={set('conf')} autoComplete="new-password" invalid={!!errors.conf} />
      </Field>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Change password'}</button>
    </form>
  )
}

export default function CompanyProfile() {
  const { reload } = useAuth()
  const [p, setP] = useState(null)
  const [f, setF] = useState(null)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  const fill = (d) => {
    setP(d)
    setF({
      manager_name: d.manager_name, manager_designation: d.manager_designation, phone: d.phone,
      industry: d.industry, company_size: d.company_size, address: d.address,
      website: d.website || '', description: d.description || '',
    })
  }

  useEffect(() => {
    api.company.get('/api/company/profile').then((r) => fill(r.data)).catch((e) => setError(errorMessage(e)))
  }, [])

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setError('')
    setOk('')
    const errs = {}
    if (f.manager_name.trim().length < 2) errs.manager_name = 'Enter the manager name'
    if (f.manager_designation.trim().length < 2) errs.manager_designation = 'Enter the designation'
    if (!/^\+?[0-9]{7,15}$/.test(f.phone.replace(/[\s-]/g, ''))) errs.phone = 'Enter a valid phone number'
    if (f.industry.trim().length < 2) errs.industry = 'Enter the industry'
    if (f.address.trim().length < 5) errs.address = 'Enter the office address'
    if (f.website.trim() && !/^https?:\/\//.test(f.website.trim())) errs.website = 'Must start with http:// or https://'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const { data } = await api.company.put('/api/company/profile', {
        manager_name: f.manager_name.trim(), manager_designation: f.manager_designation.trim(),
        phone: f.phone, industry: f.industry.trim(), company_size: f.company_size,
        address: f.address.trim(), website: f.website.trim() || null,
        description: f.description.trim() || null,
      })
      fill(data)
      reload('company')
      setOk('Profile saved.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!f) return error ? <Alert>{error}</Alert> : <Spinner />

  return (
    <div className="stack">
      <form className="card" onSubmit={save} noValidate>
        <h2>Company profile</h2>
        <p className="muted">
          Company name, email and registration number can only be changed by an administrator.
        </p>
        <dl className="kv">
          <dt>Company</dt><dd>{p.company_name}</dd>
          <dt>Email</dt><dd>{p.email}</dd>
          <dt>Registration no.</dt><dd>{p.registration_number}</dd>
        </dl>
        <Alert>{error}</Alert>
        <Alert type="success">{ok}</Alert>
        <div className="form-grid">
          <Field id="cp-mgr" label="Manager name" error={errors.manager_name}><input id="cp-mgr" value={f.manager_name} onChange={set('manager_name')} maxLength={150} /></Field>
          <Field id="cp-des" label="Manager designation" error={errors.manager_designation}><input id="cp-des" value={f.manager_designation} onChange={set('manager_designation')} maxLength={150} /></Field>
          <Field id="cp-phone" label="Phone" error={errors.phone}><input id="cp-phone" type="tel" value={f.phone} onChange={set('phone')} /></Field>
          <Field id="cp-ind" label="Industry" error={errors.industry}><input id="cp-ind" value={f.industry} onChange={set('industry')} maxLength={100} /></Field>
          <Field id="cp-size" label="Company size">
            <select id="cp-size" value={f.company_size} onChange={set('company_size')}>
              {[...new Set(['1-10', '11-50', '51-200', '201-1000', '1000+', f.company_size])].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field id="cp-web" label="Website" error={errors.website}><input id="cp-web" type="url" value={f.website} onChange={set('website')} placeholder="https://" /></Field>
        </div>
        <Field id="cp-addr" label="Office address" error={errors.address}>
          <textarea id="cp-addr" value={f.address} onChange={set('address')} maxLength={500} style={{ minHeight: 70 }} />
        </Field>
        <Field id="cp-desc" label="Description"><textarea id="cp-desc" value={f.description} onChange={set('description')} maxLength={3000} /></Field>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save profile'}</button>
      </form>
      <Password />
    </div>
  )
}
