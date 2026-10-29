import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/Layout'
import ReportPrint, { printReport } from '../components/ReportPrint'
import { downloadCsv } from '../lib/csv'
import { DRIVE_STATUS, driveStatusLabel, formatDateTime } from '../lib/content'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const STATUSES = ['registered', 'shortlisted', 'selected', 'not_selected', 'withdrawn']

export default function DriveApplicants() {
  const { id } = useParams()
  const [drive, setDrive] = useState<any>(null)
  const [yearLabel, setYearLabel] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [courseId, setCourseId] = useState('')
  const [statusF, setStatusF] = useState('')
  const [busy, setBusy] = useState('')

  async function load() {
    const [d, r, c] = await Promise.all([
      supabase.from('campus_drives').select('*, companies(name)').eq('id', id!).maybeSingle(),
      supabase.from('drive_registrations')
        .select('id, status, registered_at, student_id, student_profiles(register_no, full_name, course_id, courses(code), student_academic_records(semester, academic_year_id))')
        .eq('drive_id', id!).order('registered_at').limit(1000),
      supabase.from('courses').select('id, code').order('code'),
    ])
    if (d.error) setError(d.error.message)
    if (r.error) setError(r.error.message)
    setDrive(d.data); setCourses(c.data ?? [])
    if (d.data) {
      const { data: y } = await supabase.from('academic_years').select('label').eq('id', d.data.academic_year_id).maybeSingle()
      setYearLabel(y?.label ?? '')
    }
    const yr = d.data?.academic_year_id
    setRows((r.data ?? []).map((x: any) => {
      const sp = one(x.student_profiles) ?? {}
      const recs: any[] = Array.isArray(sp.student_academic_records) ? sp.student_academic_records : []
      return {
        id: x.id, student_id: x.student_id, status: x.status, registered_at: x.registered_at,
        reg: sp.register_no ?? '', name: sp.full_name ?? '', course_id: sp.course_id, course: one(sp.courses)?.code ?? '',
        sem: recs.find(a => a.academic_year_id === yr)?.semester ?? '',
      }
    }).sort((a: any, b: any) => a.name.localeCompare(b.name)))
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  async function setStatus(row: any, next: string) {
    if (next === row.status) return
    setBusy(row.id); setError('')
    const { error: e } = await supabase.from('drive_registrations').update({ status: next }).eq('id', row.id)
    if (e) { setBusy(''); setError(e.message); return }
    // keep the placement results in step with the status
    let resErr: any = null
    if (next === 'selected') {
      await supabase.from('placement_results').delete().eq('drive_id', drive.id).eq('student_id', row.student_id)
      const { error: e2 } = await supabase.from('placement_results').insert({
        academic_year_id: drive.academic_year_id, drive_id: drive.id, student_id: row.student_id,
        company_id: drive.company_id, job_title: drive.job_title, package_details: drive.package_details, outcome: 'selected',
      })
      resErr = e2
    } else if (row.status === 'selected') {
      const { error: e3 } = await supabase.from('placement_results').delete().eq('drive_id', drive.id).eq('student_id', row.student_id)
      resErr = e3
    }
    if (resErr) {
      await supabase.from('drive_registrations').update({ status: row.status }).eq('id', row.id)
      setBusy(''); setError('Could not update the placement result, so the change was undone: ' + resErr.message); return
    }
    setBusy('')
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, status: next } : r))
  }

  const shown = useMemo(() => {
    const t = search.trim().toLowerCase()
    return rows.filter(r => (!courseId || r.course_id === courseId) && (!statusF || r.status === statusF) &&
      (!t || r.name.toLowerCase().includes(t) || r.reg.toLowerCase().includes(t)))
  }, [rows, search, courseId, statusF])

  const count = (s: string) => rows.filter(r => r.status === s).length
  const company = one(drive?.companies)?.name ?? ''
  const fileBase = 'CampusConnect_applicants_' + (company + '_' + (drive?.job_title ?? '')).replace(/[^a-zA-Z0-9]+/g, '_')

  function exportCsv() {
    downloadCsv(fileBase + '.csv',
      ['register_no', 'name', 'course', 'semester', 'status', 'registered_at', 'company', 'job_title', 'academic_year'],
      shown.map(r => [r.reg, r.name, r.course, r.sem, driveStatusLabel(r.status), r.registered_at, company, drive.job_title, yearLabel]))
  }
  function exportPdf() { printReport('Applicants - ' + company + ' - ' + drive.job_title) }

  if (loading) return <Spinner />
  if (!drive) return <div className="card">Drive not found. <Link to="/admin/drives" className="text-brand-green underline">Back</Link></div>

  const filterNote = [
    courseId ? 'Course: ' + (courses.find(c => c.id === courseId)?.code ?? '') : '',
    statusF ? 'Status: ' + driveStatusLabel(statusF) : '',
    search.trim() ? 'Search: ' + search.trim() : '',
  ].filter(Boolean).join(' · ')

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin/drives" className="text-sm text-brand-green">&larr; Drives</Link>
        <h1 className="text-2xl font-bold text-brand-navy">{company} - {drive.job_title}</h1>
        <p className="text-sm text-slate-600">{yearLabel}{drive.drive_date ? ' · Drive ' + formatDateTime(drive.drive_date) : ''}{drive.venue ? ' · ' + drive.venue : ''}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STATUSES.map(s => (
          <div key={s} className="card !p-3"><div className="text-xs text-slate-500">{driveStatusLabel(s)}</div><div className="text-2xl font-bold text-brand-navy">{count(s)}</div></div>
        ))}
      </div>

      <div className="card space-y-3">
        <input className="input" placeholder="Search by name or register number" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={courseId} onChange={e => setCourseId(e.target.value)}>
            <option value="">All courses</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
          <select className="input" value={statusF} onChange={e => setStatusF(e.target.value)}>
            <option value="">Any status</option>
            {STATUSES.map(s => <option key={s} value={s}>{driveStatusLabel(s)}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" onClick={exportCsv}>Export CSV</button>
          <button className="btn-navy" onClick={exportPdf}>Export PDF</button>
        </div>
        <p className="text-xs text-slate-500">Exports include only the {shown.length} applicant(s) currently shown. For the PDF, choose <b>Save as PDF</b> in the print window.</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {shown.length === 0 ? <div className="card text-slate-500">No applicants to show.</div> : (
        <div className="space-y-2">
          {shown.map(r => (
            <div key={r.id} className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold text-brand-navy">{r.name}</div>
                <div className="text-sm text-slate-600">{r.reg} &middot; {r.course}{r.sem ? ' · Sem ' + r.sem : ''}</div>
              </div>
              <select className={'input !w-auto font-semibold ' + (DRIVE_STATUS[r.status]?.cls ?? '')} value={r.status} disabled={busy === r.id} onChange={e => setStatus(r, e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{driveStatusLabel(s)}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      <ReportPrint
        title={'Applicants: ' + company + ' - ' + drive.job_title}
        meta={['Academic year: ' + yearLabel + (drive.drive_date ? '   |   Recruitment date: ' + formatDateTime(drive.drive_date) : '') + (drive.venue ? '   |   Venue: ' + drive.venue : ''), ...(filterNote ? ['Filters: ' + filterNote] : [])]}
        columns={[{ label: 'S.No', width: '9mm' }, { label: 'Register no', width: '28mm' }, { label: 'Name' }, { label: 'Course', width: '18mm' }, { label: 'Sem', width: '11mm' }, { label: 'Status', width: '27mm' }]}
        rows={shown.map((r, i) => [i + 1, r.reg, r.name, r.course, r.sem, driveStatusLabel(r.status)])}
        summary={['Total: ' + shown.length, 'Shortlisted: ' + shown.filter(r => r.status === 'shortlisted').length, 'Selected: ' + shown.filter(r => r.status === 'selected').length]}
        signatures={['Placement Coordinator', 'Principal']}
      />
    </div>
  )
}
