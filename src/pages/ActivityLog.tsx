import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/Layout'

const PAGE = 25
const LABEL: Record<string, string> = {
  create_students: 'Students created',
  reset_student_password: 'Password reset',
  delete_student: 'Student deleted',
  send_notification: 'Announcement sent',
  export_year_archive: 'Archive exported',
  delete_year_data: 'Academic-year data deleted',
}

export default function ActivityLog() {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    supabase.from('protected_admin_audit_logs').select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
      .then(({ data, count, error: e }) => {
        setError(e ? e.message : ''); setRows(data ?? []); setTotal(count ?? 0); setLoading(false)
      })
  }, [page])

  const pages = Math.max(1, Math.ceil(total / PAGE))
  const detail = (d: any) => d ? Object.entries(d).map(([k, v]) => k.replace(/_/g, ' ') + ': ' + String(v)).join(', ') : ''

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin" className="text-sm text-brand-green">&larr; Dashboard</Link>
        <h1 className="text-2xl font-bold text-brand-navy">Activity history</h1>
        <p className="text-sm text-slate-600">A protected record of important admin actions. It cannot be edited or deleted.</p>
      </div>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <Spinner /> : rows.length === 0 ? <div className="card text-slate-500">No activity recorded yet.</div> : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="card !p-3">
              <div className="font-semibold text-brand-navy">{LABEL[r.action] ?? r.action}</div>
              <div className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString('en-IN')} · {r.admin_email ?? 'unknown admin'}</div>
              {r.details && <div className="mt-1 text-sm text-slate-700">{detail(r.details)}</div>}
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <button className="btn-outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span className="text-sm text-slate-500">Page {page + 1} of {pages}</span>
            <button className="btn-outline" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
