import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Spinner } from '../components/Layout'
import { formatDate, openAttachment } from '../lib/content'
import { OFFER_BUCKET } from '../lib/offers'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export default function StudentOffers() {
  const { student } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!student) return
    supabase.from('offer_letters').select('id, job_title, file_name, file_path, notes, is_shared, created_at, companies(name)')
      .eq('student_id', student.id).order('created_at', { ascending: false })
      .then(({ data, error: e }) => { if (e) setError(e.message); setRows(data ?? []); setLoading(false) })
  }, [student])

  return (
    <div className="space-y-4">
      <div>
        <Link to="/student" className="text-sm text-brand-green">&larr; My dashboard</Link>
        <h1 className="text-2xl font-bold text-brand-navy">My offer letters</h1>
        <p className="text-sm text-slate-600">Only you and the Placement Cell can see these.</p>
      </div>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <Spinner /> : rows.length === 0 ? <div className="card text-slate-500">No offer letters yet.</div> : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="card">
              <div className="font-semibold text-brand-navy">{one(r.companies)?.name ?? 'Company'}{r.job_title ? ' - ' + r.job_title : ''}</div>
              <div className="text-xs text-slate-500">Added {formatDate(r.created_at)}</div>
              {r.is_shared && <p className="mt-1 text-xs text-slate-500">This is a common file shared with the students selected in this drive.</p>}
              {r.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.notes}</p>}
              <button className="btn-navy mt-2 !py-1.5" onClick={() => openAttachment(r.file_path, OFFER_BUCKET).catch((e: any) => setError(e.message))}>Open offer letter</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
