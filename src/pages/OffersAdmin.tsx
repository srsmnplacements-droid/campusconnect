import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/Layout'
import { formatDate, openAttachment, removeAttachment } from '../lib/content'
import { OFFER_BUCKET } from '../lib/offers'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export default function OffersAdmin() {
  const [rows, setRows] = useState<any[]>([])
  const [years, setYears] = useState<any[]>([])
  const [yearId, setYearId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    supabase.from('academic_years').select('id, label').order('label', { ascending: false }).then(({ data }) => setYears(data ?? []))
  }, [])
  useEffect(() => {
    setLoading(true)
    let q: any = supabase.from('offer_letters')
      .select('id, drive_id, job_title, file_path, size_bytes, notes, created_at, student_profiles(register_no, full_name, courses(code)), companies(name), academic_years(label)')
      .order('created_at', { ascending: false }).limit(300)
    if (yearId) q = q.eq('academic_year_id', yearId)
    q.then(({ data, error: e }: any) => { setError(e ? e.message : ''); setRows(data ?? []); setLoading(false) })
  }, [yearId, reload])

  const shown = useMemo(() => {
    const t = search.trim().toLowerCase()
    return rows.filter(r => {
      const p = one(r.student_profiles) ?? {}
      return !t || (p.full_name ?? '').toLowerCase().includes(t) || (p.register_no ?? '').toLowerCase().includes(t) || (one(r.companies)?.name ?? '').toLowerCase().includes(t)
    })
  }, [rows, search])

  async function remove(r: any) {
    if (!window.confirm('Delete this offer letter file permanently?')) return
    setError('')
    try {
      await removeAttachment(r.file_path, OFFER_BUCKET)
      const { error: e } = await supabase.from('offer_letters').delete().eq('id', r.id)
      if (e) throw new Error(e.message)
      setReload(n => n + 1)
    } catch (ex: any) { setError(ex.message) }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin" className="text-sm text-brand-green">&larr; Dashboard</Link>
        <h1 className="text-2xl font-bold text-brand-navy">Offer letters</h1>
        <p className="text-sm text-slate-600">To add one, open a drive, go to <b>Applicants</b>, mark the student <b>Selected</b>, then tap <b>Upload offer letter</b>.</p>
      </div>
      <div className="card grid gap-2 sm:grid-cols-2">
        <input className="input" placeholder="Search student, register number or company" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" value={yearId} onChange={e => setYearId(e.target.value)}>
          <option value="">All academic years</option>
          {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
        </select>
      </div>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <Spinner /> : shown.length === 0 ? <div className="card text-slate-500">No offer letters yet.</div> : (
        <div className="space-y-2">
          {shown.map(r => {
            const p = one(r.student_profiles) ?? {}
            return (
              <div key={r.id} className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-brand-navy">{p.full_name} <span className="text-sm font-normal text-slate-600">({p.register_no} · {one(p.courses)?.code})</span></div>
                  <div className="text-sm text-slate-700">{one(r.companies)?.name}{r.job_title ? ' - ' + r.job_title : ''}</div>
                  <div className="text-xs text-slate-500">{one(r.academic_years)?.label} · added {formatDate(r.created_at)}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-navy !py-1.5" onClick={() => openAttachment(r.file_path, OFFER_BUCKET).catch((e: any) => setError(e.message))}>View</button>
                  <Link to={'/admin/drives/' + r.drive_id} className="btn-outline !py-1.5">Drive</Link>
                  <button className="btn !py-1.5 border border-red-300 bg-white text-red-700 hover:bg-red-50" onClick={() => remove(r)}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
