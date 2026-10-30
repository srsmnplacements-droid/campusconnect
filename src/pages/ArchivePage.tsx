import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { callArchive } from '../lib/api'
import { buildAndExport, ExportResult } from '../lib/archive'

const MB = 1024 * 1024
const fmt = (b: number) => b >= 1024 * MB ? (b / 1024 / MB).toFixed(2) + ' GB' : b >= MB ? (b / MB).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB'
const one = (x: any) => (Array.isArray(x) ? x[0] : x)

const LABELS: [string, string][] = [
  ['enrolments', 'Student enrolments'],
  ['drives', 'Recruitment drives'],
  ['drive_registrations', 'Drive registrations'],
  ['events', 'Events'],
  ['event_registrations', 'Event registrations'],
  ['event_attendance', 'Attendance records'],
  ['notices', 'Notices'],
  ['resources', 'Placement resources'],
  ['placement_results', 'Placement results'],
  ['offer_letters', 'Offer letters'],
  ['files', 'Uploaded files'],
]

export default function ArchivePage() {
  const [years, setYears] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [yearId, setYearId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [plan, setPlan] = useState<any>(null)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [pct, setPct] = useState(0)
  const [msg, setMsg] = useState('')
  const [exp, setExp] = useState<ExportResult | null>(null)
  const [checked, setChecked] = useState(false)
  const [verified, setVerified] = useState(false)
  const [typed, setTyped] = useState('')
  const [del, setDel] = useState<any>(null)
  const [exports, setExports] = useState<any[]>([])
  const [deletions, setDeletions] = useState<any[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    Promise.all([
      supabase.from('academic_years').select('id, label, is_current').order('label', { ascending: false }),
      supabase.from('courses').select('id, code, name').order('code'),
    ]).then(([y, c]) => { setYears(y.data ?? []); setCourses(c.data ?? []) })
  }, [])

  useEffect(() => {
    supabase.from('export_jobs').select('id, created_at, verified, archive_size_bytes, file_count, academic_years(label), courses(code)').order('created_at', { ascending: false }).limit(8)
      .then(({ data }) => setExports(data ?? []))
    supabase.from('deletion_jobs').select('id, created_at, status, files_deleted, files_remaining, bytes_released, academic_years(label), courses(code)').order('created_at', { ascending: false }).limit(8)
      .then(({ data }) => setDeletions(data ?? []))
  }, [tick])

  function reset() { setPlan(null); setExp(null); setChecked(false); setVerified(false); setTyped(''); setDel(null); setErr(''); setPct(0); setMsg('') }
  const year = years.find(y => y.id === yearId)
  const course = courses.find(c => c.id === courseId)

  async function review() {
    setErr(''); setBusy('plan')
    try { setPlan(await callArchive({ action: 'plan', academic_year_id: yearId, course_id: courseId || null })) }
    catch (e: any) { setErr(e.message) }
    setBusy('')
  }

  async function makeArchive() {
    setErr(''); setBusy('export'); setExp(null); setVerified(false); setChecked(false); setPct(1)
    try {
      const r = await buildAndExport({ yearId, yearLabel: year.label, courseId: courseId || null, courseCode: course?.code ?? null }, (p, m) => { setPct(p); setMsg(m) })
      setExp(r); setTick(n => n + 1)
    } catch (e: any) { setErr('The archive could not be completed: ' + e.message); setPct(0) }
    setBusy('')
  }

  async function confirmChecked() {
    setErr(''); setBusy('verify')
    try { await callArchive({ action: 'verify_export', export_job_id: exp!.jobId }); setVerified(true); setTick(n => n + 1) }
    catch (e: any) { setErr(e.message) }
    setBusy('')
  }

  async function deleteNow() {
    if (!window.confirm('FINAL WARNING: ' + year.label + (course ? ' (' + course.code + ')' : '') + ' data will be permanently deleted and cannot be recovered through the app. Continue?')) return
    setErr(''); setBusy('delete'); setDel(null)
    try { setDel(await callArchive({ action: 'delete_year_data', export_job_id: exp!.jobId, typed_year: typed })); setTick(n => n + 1) }
    catch (e: any) { setErr(e.message) }
    setBusy('')
  }

  async function retry() {
    setErr(''); setBusy('retry')
    try { setDel({ ...del, ...(await callArchive({ action: 'retry_cleanup', deletion_job_id: del.job_id })) }); setTick(n => n + 1) }
    catch (e: any) { setErr(e.message) }
    setBusy('')
  }

  const canDelete = !!plan && !!exp && verified && !plan.is_current && typed.trim() === plan.year_label && !del

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin" className="text-sm text-brand-green">&larr; Dashboard</Link>
        <h1 className="text-2xl font-bold text-brand-navy">Academic year archive</h1>
        <p className="text-sm text-slate-600">Download a backup ZIP of one academic year, then (only if you want) permanently delete it to free space.</p>
      </div>

      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {/* STEP 1 */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-brand-navy">Step 1. Choose and review</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className="input" value={yearId} onChange={e => { setYearId(e.target.value); reset() }}>
            <option value="">Choose academic year...</option>
            {years.map(y => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' (current)' : ''}</option>)}
          </select>
          <select className="input" value={courseId} onChange={e => { setCourseId(e.target.value); reset() }}>
            <option value="">Whole year (all courses)</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code} only</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-500">
          Whole year: removes that year's drives, events, notices, resources, registrations, attendance, results, offer letters and files.
          One course: removes only that course's students' enrolments, registrations, attendance, results and offer letters in that year.
        </p>
        <button className="btn-navy" disabled={!yearId || busy === 'plan'} onClick={review}>{busy === 'plan' ? 'Counting...' : 'Review records'}</button>

        {plan && (
          <div className="space-y-2">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="mb-1 text-sm font-semibold">{plan.year_label}{plan.course_code ? ' - ' + plan.course_code : ' - whole year'}</div>
              <table className="w-full text-sm">
                <tbody>
                  {LABELS.filter(([k]) => k in plan.counts).map(([k, label]) => (
                    <tr key={k} className="border-t border-slate-200"><td className="py-1">{label}</td><td className="py-1 text-right font-semibold">{plan.counts[k]}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 text-sm">Files that may be released: <b>{fmt(Number(plan.counts.file_bytes ?? 0))}</b>. Database space is freed too but cannot be measured exactly, and Supabase may take time to update its numbers.</div>
            </div>
            {plan.is_current && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">This is the <b>current</b> academic year. You can download an archive, but it cannot be deleted. Make another year current first.</div>}
          </div>
        )}
      </section>

      {/* STEP 2 */}
      <section className={'card space-y-3 ' + (plan ? '' : 'opacity-50')}>
        <h2 className="font-semibold text-brand-navy">Step 2. Download the archive ZIP</h2>
        <p className="text-sm text-slate-600">Best done on a laptop. Nothing is deleted in this step. The ZIP contains personal student data, so keep it private.</p>
        <button className="btn-green" disabled={!plan || busy === 'export'} onClick={makeArchive}>{busy === 'export' ? 'Working... keep this page open' : 'Create and download ZIP'}</button>
        {(busy === 'export' || pct > 0) && (
          <div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-green" style={{ width: pct + '%' }} /></div>
            <div className="mt-1 text-xs text-slate-600">{msg} {pct}%</div>
          </div>
        )}
        {exp && (
          <div className="space-y-2 rounded-lg bg-green-50 p-3 text-sm text-green-900">
            <div><b>Archive created and checked.</b> It was saved to your downloads folder:</div>
            <ul className="list-disc pl-5">{exp.parts.map(p => <li key={p.name}>{p.name} ({fmt(p.bytes)})</li>)}</ul>
            <div>Records: {Object.entries(exp.counts).map(([k, v]) => k.replace(/_/g, ' ') + ' ' + v).join(', ')}</div>
            {exp.parts.length > 1 && <div className="text-amber-800">The archive has several parts. If your browser asks, allow multiple downloads. Keep all parts together.</div>}
          </div>
        )}
      </section>

      {/* STEP 3 */}
      <section className={'card space-y-3 ' + (exp ? '' : 'opacity-50')}>
        <h2 className="font-semibold text-brand-navy">Step 3. Confirm you checked it</h2>
        <p className="text-sm text-slate-600">Open the downloaded ZIP on your computer. Look at the README, the CSV files and a few of the uploaded documents.</p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" disabled={!exp || verified} checked={checked || verified} onChange={e => setChecked(e.target.checked)} />
          I downloaded the ZIP, opened it, and the data looks complete.
        </label>
        <button className="btn-navy" disabled={!exp || !checked || verified || busy === 'verify'} onClick={confirmChecked}>{verified ? 'Confirmed' : 'Confirm'}</button>
      </section>

      {/* STEP 4 */}
      <section className={'card space-y-3 border-red-200 ' + (verified ? '' : 'opacity-50')}>
        <h2 className="font-semibold text-red-700">Step 4. Permanently delete</h2>
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <b>Retention warning.</b> Some records may have to be kept under the college's retention policy, audit requirements or government rules.
          Check with the Principal or the office before deleting. Deletion is permanent and cannot be undone through this app.
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Student profiles and logins are <b>kept</b>. Other years and other courses are <b>not touched</b>.</li>
          <li>Companies are kept. The real files are deleted from storage, not only from the list.</li>
          <li>The app checks afterwards that everything is gone, and tells you honestly if anything is left.</li>
        </ul>
        <div>
          <label className="mb-1 block text-sm font-medium">Type the academic year{plan ? ' (' + plan.year_label + ')' : ''} to confirm</label>
          <input className="input" disabled={!verified || !!del} value={typed} onChange={e => setTyped(e.target.value)} placeholder="2026-27" />
        </div>
        <button className="btn !bg-red-600 !text-white hover:!bg-red-700" disabled={!canDelete || busy === 'delete'} onClick={deleteNow}>
          {busy === 'delete' ? 'Deleting... keep this page open' : 'Permanently delete'}
        </button>

        {del && (
          <div className={'space-y-2 rounded-lg p-3 text-sm ' + (del.status === 'completed' ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900')}>
            <div className="font-semibold">{del.status === 'completed' ? 'Deletion completed and verified.' : 'Deletion is only PARTLY complete.'}</div>
            <div>Files deleted: {del.files_deleted} · Files remaining: {del.files_remaining} · Space released: {fmt(Number(del.bytes_released ?? 0))}</div>
            {del.deleted_counts && <div>Records deleted: {Object.entries(del.deleted_counts).map(([k, v]) => k.replace(/_/g, ' ') + ' ' + v).join(', ')}</div>}
            {del.remaining_counts && Object.keys(del.remaining_counts).length > 0 && <div>Records still present: {Object.entries(del.remaining_counts).map(([k, v]) => k + ' ' + v).join(', ')}</div>}
            {del.status !== 'completed' && <button className="btn-navy" disabled={busy === 'retry'} onClick={retry}>{busy === 'retry' ? 'Retrying...' : 'Retry cleanup'}</button>}
            {del.status === 'completed' && <div className="text-xs">Supabase may take some time to show the new storage numbers.</div>}
          </div>
        )}
      </section>

      {/* HISTORY */}
      <section className="card space-y-2">
        <h2 className="font-semibold text-brand-navy">Archive and deletion history</h2>
        {exports.length === 0 && deletions.length === 0 && <p className="text-sm text-slate-500">Nothing yet.</p>}
        {exports.map(e => (
          <div key={e.id} className="border-t border-slate-100 pt-2 text-sm">
            <b>Archive</b> {one(e.academic_years)?.label}{one(e.courses)?.code ? ' · ' + one(e.courses).code : ''} · {fmt(Number(e.archive_size_bytes ?? 0))} · {e.file_count} files · {e.verified ? 'checked by admin' : 'not confirmed'}
            <div className="text-xs text-slate-500">{new Date(e.created_at).toLocaleString('en-IN')}</div>
          </div>
        ))}
        {deletions.map(d => (
          <div key={d.id} className="border-t border-slate-100 pt-2 text-sm">
            <b>Deletion</b> {one(d.academic_years)?.label}{one(d.courses)?.code ? ' · ' + one(d.courses).code : ''} · {d.status} · {d.files_deleted} files deleted, {d.files_remaining} remaining · {fmt(Number(d.bytes_released ?? 0))}
            <div className="text-xs text-slate-500">{new Date(d.created_at).toLocaleString('en-IN')}</div>
          </div>
        ))}
      </section>
    </div>
  )
}
