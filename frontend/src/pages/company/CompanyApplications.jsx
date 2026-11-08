import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Alert from '../../components/Alert'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import Spinner from '../../components/Spinner'
import StatusBadge from '../../components/StatusBadge'
import { api, errorMessage } from '../../services/api'
import { formatDate } from '../../services/format'

const PAGE_SIZE = 20
const STATUSES = [
  ['', 'All statuses'], ['submitted', 'Submitted'], ['under_review', 'Under review'],
  ['approved_for_interview', 'Interview invited'], ['rejected', 'Rejected'],
  ['interview_completed', 'Interview completed'], ['shortlisted', 'Shortlisted'],
  ['accepted', 'Accepted'], ['on_hold', 'On hold'], ['final_rejected', 'Final rejected'],
]

// Mirrors backend BULK_FROM transitions (client-side enable/disable, authoritative validation on server)
const BULK = [
  { status: 'under_review', label: 'Mark under review', from: ['submitted'] },
  { status: 'rejected', label: 'Reject (before interview)', from: ['submitted', 'under_review'], danger: true },
  { status: 'shortlisted', label: 'Shortlist', from: ['interview_completed', 'on_hold'] },
  { status: 'final_rejected', label: 'Reject (after interview)', from: ['interview_completed', 'shortlisted', 'on_hold'], danger: true },
]
const REASON = {
  not_found: 'not found',
  already: 'already in that status',
  not_allowed: 'its current status does not allow this action',
}

export default function CompanyApplications() {
  const [params, setParams] = useSearchParams()
  const vacancyId = params.get('vacancy_id') || ''
  const status = params.get('status') || ''
  const [page, setPage] = useState(1)
  const [vacancies, setVacancies] = useState([])
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [tick, setTick] = useState(0)
  const [selected, setSelected] = useState([])
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const allRef = useRef(null)

  useEffect(() => {
    api.company.get('/api/company/vacancies', { params: { page_size: 100 } })
      .then((r) => setVacancies(r.data.items))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    setSelected([]) // page/filter bodlale selection reset
    api.company
      .get('/api/company/applications', {
        params: { page, page_size: PAGE_SIZE, ...(vacancyId ? { vacancy_id: vacancyId } : {}), ...(status ? { status } : {}) },
      })
      .then((r) => alive && setData(r.data))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [page, vacancyId, status, tick])

  const change = (key) => (e) => {
    const next = new URLSearchParams(params)
    if (e.target.value) next.set(key, e.target.value)
    else next.delete(key)
    setParams(next)
    setPage(1)
  }

  const ids = data.items.map((a) => a.id)
  const allChecked = ids.length > 0 && ids.every((id) => selected.includes(id))
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = selected.length > 0 && !allChecked
  }, [selected, allChecked])

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const toggleAll = () => setSelected(allChecked ? [] : ids)

  const statusOf = useMemo(() => Object.fromEntries(data.items.map((a) => [a.id, a.status])), [data.items])
  const eligible = (b) => selected.filter((id) => b.from.includes(statusOf[id])).length

  const runBulk = async () => {
    const b = pending
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const { data: res } = await api.company.post('/api/company/bulk/applications/status', {
        ids: selected, status: b.status,
      })
      const why = {}
      res.results.filter((r) => r.result === 'skipped').forEach((r) => { why[r.reason] = (why[r.reason] || 0) + 1 })
      const skippedText = Object.entries(why).map(([k, n]) => `${n} ${REASON[k] || k}`).join('; ')
      setInfo(`${res.changed} applicant(s) updated.${res.skipped ? ` ${res.skipped} skipped (${skippedText}).` : ''}`)
      setPending(null)
      setTick((t) => t + 1)
    } catch (e) {
      setError(errorMessage(e))
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  // Fetch CSV export with Authorization header as blob
  const exportCsv = async () => {
    setError('')
    setInfo('')
    setExporting(true)
    try {
      const res = await api.company.get('/api/company/exports/applications.csv', {
        params: { ...(vacancyId ? { vacancy_id: vacancyId } : {}), ...(status ? { status } : {}) },
        responseType: 'blob', timeout: 120000,
      })
      const url = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `applicants-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      setInfo('CSV downloaded. It contains personal data, so store and share it carefully.')
    } catch {
      setError('Could not export the file. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const elig = pending ? eligible(pending) : 0

  return (
    <div className="stack">
      <div className="section-head">
        <h2>Applicants</h2>
        <div className="row-actions">
          <select aria-label="Filter by vacancy" value={vacancyId} onChange={change('vacancy_id')} style={{ width: 'auto', maxWidth: 220 }}>
            <option value="">All vacancies</option>
            {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
          <select aria-label="Filter by status" value={status} onChange={change('status')} style={{ width: 'auto' }}>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={exportCsv} disabled={exporting || data.total === 0}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>
      <Alert>{error}</Alert>
      <Alert type="success">{info}</Alert>

      {selected.length > 0 && (
        <div className="bulk-bar" role="region" aria-label="Bulk actions">
          <strong>{selected.length} selected</strong>
          <div className="row-actions">
            {BULK.map((b) => (
              <button key={b.status} className={`btn btn-sm ${b.danger ? 'btn-danger' : 'btn-ghost'}`}
                disabled={eligible(b) === 0} onClick={() => setPending(b)}
                title={eligible(b) === 0 ? 'None of the selected applicants can take this action' : undefined}>
                {b.label} ({eligible(b)})
              </button>
            ))}
            <button className="link-btn" onClick={() => setSelected([])}>Clear</button>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : data.items.length === 0 ? (
        <EmptyState title="No applicants found" text="Applications will appear here when candidates apply." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="chk">
                  <input ref={allRef} type="checkbox" checked={allChecked} onChange={toggleAll}
                    aria-label="Select all applicants on this page" />
                </th>
                <th>Candidate</th><th>Vacancy</th><th>Applied</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id}>
                  <td className="chk">
                    <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)}
                      aria-label={`Select ${a.applicant_name}`} />
                  </td>
                  <td>{a.applicant_name}<div className="muted" style={{ fontSize: '0.85rem' }}>{a.applicant_email}</div></td>
                  <td>{a.vacancy_title}</td>
                  <td>{formatDate(a.applied_at)}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td><Link className="btn btn-ghost btn-sm" to={`/company/applications/${a.id}`}>Review</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />

      <ConfirmDialog
        open={Boolean(pending)} danger={pending?.danger}
        title={pending ? `${pending.label}?` : ''}
        confirmLabel={busy ? 'Working...' : pending?.label} confirmDisabled={busy}
        message={pending
          ? `${elig} of ${selected.length} selected applicant(s) can take this action.${
              selected.length - elig ? ` The other ${selected.length - elig} will be skipped.` : ''
            } ${pending.danger ? 'Candidates are emailed only if rejection emails are turned on in settings.' : 'Candidates are not emailed.'}`
          : ''}
        onConfirm={runBulk} onCancel={() => !busy && setPending(null)}
      />
    </div>
  )
}
