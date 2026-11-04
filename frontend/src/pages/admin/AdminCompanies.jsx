import { Fragment, useCallback, useEffect, useState } from 'react'
import Alert from '../../components/Alert'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'
import { formatDate, formatDateTime, pretty } from '../../services/format'

const PAGE_SIZE = 20
const TONE = { approved: 'badge-ok', rejected: 'badge-bad', suspended: 'badge-bad', pending_approval: 'badge-warn' }

// Kon status-e kon button dekhabo: [new status, label, danger?]
const ACTIONS = {
  pending_approval: [['approved', 'Approve'], ['rejected', 'Reject', true]],
  approved: [['suspended', 'Suspend', true]],
  rejected: [['approved', 'Approve']],
  suspended: [['approved', 'Reinstate']],
}

export default function AdminCompanies() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [open, setOpen] = useState(null)       // details khola company id
  const [pending, setPending] = useState(null) // confirm-er opekkhay: { company, status, label, danger }
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.admin.get('/api/admin/companies', {
        params: { page, page_size: PAGE_SIZE, ...(status ? { status } : {}) },
      })
      setData(data)
      setError('')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { load() }, [load])

  const confirm = async () => {
    const { company, status: next } = pending
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await api.admin.patch(`/api/admin/companies/${company.id}/status`, { status: next })
      setInfo(`${company.company_name}: status changed to ${pretty(next)}.`)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  return (
    <div className="stack">
      <div className="section-head">
        <h1>Companies</h1>
        <select aria-label="Filter by status" value={status} style={{ width: 'auto' }}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All statuses</option>
          <option value="pending_verification">Pending verification</option>
          <option value="pending_approval">Pending approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      <Alert>{error}</Alert>
      <Alert type="success">{info}</Alert>

      {loading ? <Spinner /> : data.items.length === 0 ? (
        <EmptyState title="No companies found" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Company</th><th>Manager</th><th>Status</th><th>Registered</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <Fragment key={c.id}>
                  <tr>
                    <td>{c.company_name}<div className="muted" style={{ fontSize: '0.85rem' }}>{c.email}{c.is_email_verified ? '' : ' (email not verified)'}</div></td>
                    <td>{c.manager_name}<div className="muted" style={{ fontSize: '0.85rem' }}>{c.manager_designation}</div></td>
                    <td><span className={`badge ${TONE[c.status] || ''}`}>{pretty(c.status)}</span></td>
                    <td>{formatDate(c.created_at)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-ghost btn-sm" aria-expanded={open === c.id}
                          onClick={() => setOpen(open === c.id ? null : c.id)}>
                          {open === c.id ? 'Hide' : 'Details'}
                        </button>
                        {(ACTIONS[c.status] || []).map(([next, label, danger]) => (
                          <button key={next} className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}
                            onClick={() => setPending({ company: c, status: next, label, danger })}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {open === c.id && (
                    <tr key={`${c.id}-d`}>
                      <td colSpan={5} className="detail-row">
                        <dl className="kv">
                          <dt>Registration no.</dt><dd>{c.registration_number}</dd>
                          <dt>Phone</dt><dd>{c.phone}</dd>
                          <dt>Industry</dt><dd>{c.industry} · {c.company_size} employees</dd>
                          <dt>Address</dt><dd className="prewrap">{c.address}</dd>
                          {c.website && <><dt>Website</dt><dd>{/^https?:\/\//.test(c.website) ? <a href={c.website} target="_blank" rel="noopener noreferrer nofollow">{c.website}</a> : c.website}</dd></>}
                          <dt>Last login</dt><dd>{c.last_login_at ? formatDateTime(c.last_login_at) : 'Never'}</dd>
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />

      <ConfirmDialog
        open={Boolean(pending)} danger={pending?.danger} confirmLabel={busy ? 'Saving...' : pending?.label}
        title={`${pending?.label || ''} company?`}
        message={pending ? `${pending.company.company_name} will be set to "${pretty(pending.status)}". ${
          ['approved', 'rejected'].includes(pending.status) ? 'The company is notified by email.' : ''}` : ''}
        onConfirm={confirm} onCancel={() => !busy && setPending(null)}
      />
    </div>
  )
}

