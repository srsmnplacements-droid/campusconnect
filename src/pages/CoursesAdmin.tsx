import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { Spinner } from '../components/Layout'

export default function CoursesAdmin() {
  const [rows, setRows] = useState<any[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<any | null | undefined>(undefined)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    setLoading(true)
    supabase.from('courses').select('*').order('code').then(async ({ data, error: e }) => {
      if (e) setError(e.message)
      const list = data ?? []
      const c: Record<string, number> = {}
      await Promise.all(list.map(async (x: any) => {
        const { count } = await supabase.from('student_profiles').select('*', { count: 'exact', head: true }).eq('course_id', x.id)
        c[x.id] = count ?? 0
      }))
      setRows(list); setCounts(c); setLoading(false)
    })
  }, [reload])

  async function toggle(r: any) {
    setBusy(r.id); setError('')
    const { error: e } = await supabase.from('courses').update({ is_active: !r.is_active }).eq('id', r.id)
    setBusy('')
    if (e) setError(e.message); else setReload(n => n + 1)
  }

  async function remove(r: any) {
    if ((counts[r.id] ?? 0) > 0) { setError(r.code + ' has ' + counts[r.id] + ' student(s). Deactivate it instead of deleting.'); return }
    if (!window.confirm('Delete the course ' + r.code + '?')) return
    setBusy(r.id); setError('')
    const { error: e } = await supabase.from('courses').delete().eq('id', r.id)
    setBusy('')
    if (e) setError(e.code === '23503' ? r.code + ' is used by drives, events or records. Deactivate it instead.' : e.message)
    else setReload(n => n + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to="/admin" className="text-sm text-brand-green">&larr; Dashboard</Link>
          <h1 className="text-2xl font-bold text-brand-navy">Courses</h1>
        </div>
        <button className="btn-green" onClick={() => setEditing(null)}>+ Add course</button>
      </div>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="card space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold text-brand-navy">{r.code}</span>
                <span className="text-slate-700">{r.name}</span>
                {!r.is_active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">inactive</span>}
              </div>
              <div className="text-sm text-slate-600">{r.duration_years} year(s) · {r.total_semesters} semesters · {counts[r.id] ?? 0} student(s)</div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-outline !py-1.5" onClick={() => setEditing(r)}>Edit</button>
                <button className="btn-outline !py-1.5" disabled={busy === r.id} onClick={() => toggle(r)}>{r.is_active ? 'Deactivate' : 'Activate'}</button>
                <button className="btn !py-1.5 border border-red-300 bg-white text-red-700 hover:bg-red-50" disabled={busy === r.id} onClick={() => remove(r)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">An inactive course cannot get new students, but its existing students and history stay safe.</p>
      {editing !== undefined && <CourseEditor row={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setReload(n => n + 1) }} />}
    </div>
  )
}

function CourseEditor({ row, onClose, onSaved }: { row: any | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(row?.code ?? '')
  const [name, setName] = useState(row?.name ?? '')
  const [years, setYears] = useState(String(row?.duration_years ?? 3))
  const [sems, setSems] = useState(String(row?.total_semesters ?? 6))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault(); setErr('')
    const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (c.length < 2 || c.length > 12) { setErr('Course code needs 2 to 12 letters or numbers (for example BCOM).'); return }
    if (name.trim().length < 3) { setErr('Please enter the full course name.'); return }
    const y = Number(years), s = Number(sems)
    if (!Number.isInteger(y) || y < 1 || y > 6) { setErr('Duration must be 1 to 6 years.'); return }
    if (!Number.isInteger(s) || s < 1 || s > 12) { setErr('Semesters must be 1 to 12.'); return }
    setBusy(true)
    const payload = { code: c, name: name.trim(), duration_years: y, total_semesters: s }
    const { error } = row
      ? await supabase.from('courses').update(payload).eq('id', row.id)
      : await supabase.from('courses').insert(payload)
    setBusy(false)
    if (error) { setErr(error.code === '23505' ? 'This course code already exists.' : error.message); return }
    onSaved()
  }

  return (
    <Modal title={row ? 'Edit course' : 'Add course'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div><label className="mb-1 block text-sm font-medium">Code</label>
          <input className="input" value={code} maxLength={12} onChange={e => setCode(e.target.value)} placeholder="BCOM" /></div>
        <div><label className="mb-1 block text-sm font-medium">Full name</label>
          <input className="input" value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder="Bachelor of Commerce" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-sm font-medium">Duration (years)</label>
            <input className="input" inputMode="numeric" value={years} onChange={e => setYears(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm font-medium">Total semesters</label>
            <input className="input" inputMode="numeric" value={sems} onChange={e => setSems(e.target.value)} /></div>
        </div>
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <button className="btn-green w-full" disabled={busy}>{busy ? 'Saving...' : 'Save course'}</button>
      </form>
    </Modal>
  )
}
