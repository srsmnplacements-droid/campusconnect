import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { callAdmin, RowResult } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import Modal from '../components/Modal'
import { Spinner } from '../components/Layout'

const PAGE = 25
interface Course { id: string; code: string; name: string; total_semesters: number }
interface Year { id: string; label: string; is_current: boolean }
interface Filters { courseId: string; status: string; yearId: string; semester: string; batch: string }

export default function StudentsPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [years, setYears] = useState<Year[]>([])
  const [ready, setReady] = useState(false)
  const [f, setF] = useState<Filters>({ courseId: '', status: '', yearId: '', semester: '', batch: '' })
  const [search, setSearch] = useState('')
  const [dq, setDq] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<any | null>(null)
  const [adding, setAdding] = useState(false)
  const [cred, setCred] = useState<{ reg: string; pw: string } | null>(null)
  const [reload, setReload] = useState(0)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('courses').select('id, code, name, total_semesters').order('code'),
      supabase.from('academic_years').select('id, label, is_current').order('label', { ascending: false }),
    ]).then(([c, y]) => {
      setCourses((c.data as Course[]) ?? [])
      const ys = (y.data as Year[]) ?? []
      setYears(ys)
      const cur = ys.find(v => v.is_current)
      if (cur) setF(p => ({ ...p, yearId: cur.id }))
      setReady(true)
    })
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { setDq(search); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const build = useCallback(() => {
    const useYear = !!f.yearId
    const sel = 'id, register_no, full_name, email, phone, status, course_id, courses(code)' +
      (useYear ? ', student_academic_records!inner(semester, batch, academic_year_id)' : '')
    let q: any = supabase.from('student_profiles').select(sel, { count: 'exact' })
    if (useYear) {
      q = q.eq('student_academic_records.academic_year_id', f.yearId)
      if (f.semester) q = q.eq('student_academic_records.semester', Number(f.semester))
      if (f.batch.trim()) q = q.ilike('student_academic_records.batch', '%' + f.batch.trim().replace(/[%,()]/g, ' ') + '%')
    }
    if (f.courseId) q = q.eq('course_id', f.courseId)
    if (f.status) q = q.eq('status', f.status)
    const t = dq.replace(/[%,()]/g, ' ').trim()
    if (t) q = q.or('full_name.ilike.%' + t + '%,register_no.ilike.%' + t + '%')
    return q.order('full_name')
  }, [f, dq])

  useEffect(() => {
    if (!ready) return
    setLoading(true)
    build().range(page * PAGE, page * PAGE + PAGE - 1).then(({ data, count, error: e }: any) => {
      if (e) setError(e.message); else setError('')
      setRows(data ?? [])
      setTotal(count ?? 0)
      setLoading(false)
    })
  }, [ready, build, page, reload])

  function setFilter(patch: Partial<Filters>) { setF(p => ({ ...p, ...patch })); setPage(0) }
  const yearLabel = years.find(y => y.id === f.yearId)?.label ?? ''
  const rec = (s: any) => (Array.isArray(s.student_academic_records) ? s.student_academic_records[0] : s.student_academic_records)

  async function toggleStatus(s: any) {
    const next = s.status === 'active' ? 'inactive' : 'active'
    if (!window.confirm((next === 'inactive' ? 'Deactivate ' : 'Activate ') + s.full_name + '?')) return
    setBusyId(s.id)
    const { error: e } = await supabase.from('student_profiles').update({ status: next }).eq('id', s.id)
    setBusyId('')
    if (e) setError(e.message); else setReload(n => n + 1)
  }

  async function resetPw(s: any) {
    if (!window.confirm('Create a new temporary password for ' + s.full_name + '? The old password will stop working.')) return
    setBusyId(s.id)
    try {
      const r = await callAdmin<{ temp_password: string }>({ action: 'reset_password', student_id: s.id })
      setCred({ reg: s.register_no, pw: r.temp_password })
    } catch (e: any) { setError(e.message) }
    setBusyId('')
  }

  async function exportCsv() {
    setError('')
    const all: any[] = []
    for (let from = 0; ; from += 500) {
      const { data, error: e } = await build().range(from, from + 499)
      if (e) { setError(e.message); return }
      all.push(...(data ?? []))
      if (!data || data.length < 500) break
    }
    downloadCsv('CampusConnect_students.csv',
      ['register_no', 'full_name', 'course', 'semester', 'batch', 'academic_year', 'email', 'phone', 'status'],
      all.map(s => { const r = rec(s); return [s.register_no, s.full_name, s.courses?.code ?? '', r?.semester ?? '', r?.batch ?? '', yearLabel, s.email ?? '', s.phone ?? '', s.status] }))
  }

  const pages = Math.max(1, Math.ceil(total / PAGE))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to="/admin" className="text-sm text-brand-green">&larr; Dashboard</Link>
          <h1 className="text-2xl font-bold text-brand-navy">Student directory</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-green" onClick={() => setAdding(true)}>+ Add student</button>
          <Link to="/admin/students/import" className="btn-navy">Import CSV</Link>
          <button className="btn-outline" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div className="card space-y-3">
        <input className="input" placeholder="Search by name or register number" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <select className="input" value={f.yearId} onChange={e => setFilter({ yearId: e.target.value, semester: '', batch: '' })}>
            <option value="">All years</option>
            {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
          <select className="input" value={f.courseId} onChange={e => setFilter({ courseId: e.target.value })}>
            <option value="">All courses</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
          <select className="input" value={f.semester} disabled={!f.yearId} onChange={e => setFilter({ semester: e.target.value })}>
            <option value="">All semesters</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>Semester {n}</option>)}
          </select>
          <input className="input" placeholder="Batch" disabled={!f.yearId} value={f.batch} onChange={e => setFilter({ batch: e.target.value })} />
          <select className="input" value={f.status} onChange={e => setFilter({ status: e.target.value })}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? <Spinner /> : rows.length === 0 ? (
        <div className="card text-slate-500">No students found. Add a student or import a CSV file.</div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-slate-500">{total} student{total === 1 ? '' : 's'}</div>
          {rows.map(s => {
            const r = rec(s)
            return (
              <div key={s.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-brand-navy">{s.full_name}</div>
                  <div className="text-sm text-slate-600">
                    {s.register_no} &middot; {s.courses?.code}
                    {r ? ' · Sem ' + r.semester + (r.batch ? ' · ' + r.batch : '') : ''}
                  </div>
                  <span className={'mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ' +
                    (s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600')}>{s.status}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-outline !py-1.5" onClick={() => setEdit(s)}>Edit</button>
                  <button className="btn-outline !py-1.5" disabled={busyId === s.id} onClick={() => resetPw(s)}>Reset password</button>
                  <button className="btn-outline !py-1.5" disabled={busyId === s.id} onClick={() => toggleStatus(s)}>
                    {s.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            )
          })}
          <div className="flex items-center justify-between pt-2">
            <button className="btn-outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span className="text-sm text-slate-500">Page {page + 1} of {pages}</span>
            <button className="btn-outline" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {edit && <EditModal s={edit} rec={rec(edit)} courses={courses} yearId={f.yearId} yearLabel={yearLabel}
        onClose={() => setEdit(null)} onSaved={() => { setEdit(null); setReload(n => n + 1) }} />}
      {adding && <AddModal courses={courses} years={years} defaultYear={yearLabel}
        onClose={() => setAdding(false)} onCreated={(reg, pw) => { setAdding(false); setCred({ reg, pw }); setReload(n => n + 1) }} />}
      {cred && <Modal title="Temporary password" onClose={() => setCred(null)}>
        <p className="text-sm text-slate-600">Give this to the student. It is shown <b>only once</b>. They must change it at first login.</p>
        <div className="mt-3 rounded-lg bg-slate-100 p-3 text-center">
          <div className="text-xs text-slate-500">Register number</div>
          <div className="font-mono text-lg font-bold">{cred.reg}</div>
          <div className="mt-2 text-xs text-slate-500">Temporary password</div>
          <div className="font-mono text-2xl font-bold tracking-wider text-brand-navy">{cred.pw}</div>
        </div>
        <button className="btn-green mt-4 w-full" onClick={() => setCred(null)}>Done</button>
      </Modal>}
    </div>
  )
}

function EditModal({ s, rec, courses, yearId, yearLabel, onClose, onSaved }:
  { s: any; rec: any; courses: Course[]; yearId: string; yearLabel: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(s.full_name)
  const [email, setEmail] = useState(s.email ?? '')
  const [phone, setPhone] = useState(s.phone ?? '')
  const [courseId, setCourseId] = useState(s.course_id)
  const [sem, setSem] = useState(rec ? String(rec.semester) : '')
  const [batch, setBatch] = useState(rec?.batch ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault(); setErr('')
    if (name.trim().length < 2) { setErr('Name is required.'); return }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr('Invalid email address.'); return }
    if (phone && !/^[0-9+\- ]{7,15}$/.test(phone)) { setErr('Invalid phone number.'); return }
    setBusy(true)
    const { error: e1 } = await supabase.from('student_profiles').update({
      full_name: name.trim(), email: email.trim() || null, phone: phone.trim() || null, course_id: courseId,
    }).eq('id', s.id)
    if (e1) { setBusy(false); setErr(e1.message); return }
    if (yearId && sem) {
      const { error: e2 } = await supabase.from('student_academic_records').upsert({
        student_id: s.id, academic_year_id: yearId, course_id: courseId, semester: Number(sem), batch: batch.trim() || null,
      }, { onConflict: 'student_id,academic_year_id' })
      if (e2) { setBusy(false); setErr(e2.message); return }
    }
    setBusy(false); onSaved()
  }

  return (
    <Modal title={'Edit ' + s.register_no} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Full name"><input className="input" value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Course">
          <select className="input" value={courseId} onChange={e => setCourseId(e.target.value)}>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
          </select>
        </Field>
        {yearId && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={'Semester (' + yearLabel + ')'}><input className="input" inputMode="numeric" value={sem} onChange={e => setSem(e.target.value)} /></Field>
            <Field label="Batch"><input className="input" value={batch} onChange={e => setBatch(e.target.value)} placeholder="2024-27" /></Field>
          </div>
        )}
        <Field label="Email (optional)"><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field label="Phone (optional)"><input className="input" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></Field>
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <button className="btn-green w-full" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
      </form>
    </Modal>
  )
}

function AddModal({ courses, years, defaultYear, onClose, onCreated }:
  { courses: Course[]; years: Year[]; defaultYear: string; onClose: () => void; onCreated: (reg: string, pw: string) => void }) {
  const [v, setV] = useState({ register_no: '', full_name: '', course: courses[0]?.code ?? '', semester: '1', batch: '', academic_year: defaultYear || years[0]?.label || '', email: '', phone: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string, val: string) => setV(p => ({ ...p, [k]: val }))

  async function save(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const r = await callAdmin<{ results: RowResult[] }>({ action: 'create_students', rows: [v] })
      const x = r.results[0]
      if (x.status === 'created') onCreated(x.register_no, x.temp_password!)
      else setErr(x.message)
    } catch (ex: any) { setErr(ex.message) }
    setBusy(false)
  }

  return (
    <Modal title="Add student" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Register number"><input className="input" value={v.register_no} onChange={e => set('register_no', e.target.value)} /></Field>
        <Field label="Full name"><input className="input" value={v.full_name} onChange={e => set('full_name', e.target.value)} /></Field>
        <Field label="Course">
          <select className="input" value={v.course} onChange={e => set('course', e.target.value)}>
            {courses.map(c => <option key={c.id} value={c.code}>{c.code} - {c.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Semester"><input className="input" inputMode="numeric" value={v.semester} onChange={e => set('semester', e.target.value)} /></Field>
          <Field label="Batch"><input className="input" value={v.batch} onChange={e => set('batch', e.target.value)} placeholder="2024-27" /></Field>
        </div>
        <Field label="Academic year">
          <select className="input" value={v.academic_year} onChange={e => set('academic_year', e.target.value)}>
            {years.map(y => <option key={y.id} value={y.label}>{y.label}</option>)}
          </select>
        </Field>
        <Field label="Email (optional)"><input className="input" type="email" value={v.email} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Phone (optional)"><input className="input" inputMode="tel" value={v.phone} onChange={e => set('phone', e.target.value)} /></Field>
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <button className="btn-green w-full" disabled={busy}>{busy ? 'Creating...' : 'Create student'}</button>
      </form>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm font-medium">{label}</label>{children}</div>
}
