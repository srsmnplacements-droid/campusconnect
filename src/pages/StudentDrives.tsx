import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Spinner } from '../components/Layout'
import CompanyLogo from '../components/CompanyLogo'
import { DRIVE_STATUS, driveStatusLabel, formatDateTime, isHttpUrl, openAttachment } from '../lib/content'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export function eligibilityProblems(d: any, courseId: string, semByYear: Record<string, number>): string[] {
  const out: string[] = []
  const courses: any[] = d.drive_eligible_courses ?? []
  if (!courses.some(c => c.course_id === courseId)) out.push('Your course is not eligible.')
  const sems: number[] | null = d.eligible_semesters
  if (sems && sems.length) {
    const sem = semByYear[d.academic_year_id]
    if (!sem || !sems.includes(sem)) out.push('Open only to semester ' + sems.join(', ') + (sem ? ' (you are in semester ' + sem + ').' : '.'))
  }
  return out
}

export default function StudentDrives() {
  const { student } = useAuth()
  const [tab, setTab] = useState<'open' | 'mine'>('open')
  const [drives, setDrives] = useState<any[]>([])
  const [mine, setMine] = useState<any[]>([])
  const [regs, setRegs] = useState<Record<string, { id: string; status: string }>>({})
  const [semByYear, setSemByYear] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!student) return
    setLoading(true); setError('')
    const regsQ = supabase.from('drive_registrations').select('id, drive_id, status, registered_at, campus_drives(job_title, drive_date, companies(name))').eq('student_id', student.id).order('registered_at', { ascending: false }).limit(100)
    if (tab === 'mine') {
      regsQ.then(({ data, error: e }) => {
        if (e) setError(e.message)
        setMine((data ?? []).map((r: any) => ({ ...r, d: one(r.campus_drives) })))
        setLoading(false)
      })
    } else {
      Promise.all([
        supabase.from('campus_drives').select('*, companies(name, logo_path), drive_eligible_courses(course_id)')
          .in('status', ['published', 'closed']).order('created_at', { ascending: false }).limit(60),
        regsQ,
        supabase.from('student_academic_records').select('academic_year_id, semester').eq('student_id', student.id),
      ]).then(([d, r, s]: any[]) => {
        if (d.error) setError(d.error.message)
        // show only drives meant for this student's course
        setDrives((d.data ?? []).filter((x: any) => (x.drive_eligible_courses ?? []).some((c: any) => c.course_id === student.course_id)))
        const m: Record<string, { id: string; status: string }> = {}
        ;(r.data ?? []).forEach((x: any) => { m[x.drive_id] = { id: x.id, status: x.status } })
        setRegs(m)
        const sm: Record<string, number> = {}
        ;(s.data ?? []).forEach((x: any) => { sm[x.academic_year_id] = x.semester })
        setSemByYear(sm)
        setLoading(false)
      })
    }
  }, [tab, student, reload])

  async function register(d: any) {
    setBusy(d.id); setError(''); setInfo('')
    const { error: e } = await supabase.rpc('register_for_drive', { p_drive_id: d.id })
    setBusy('')
    if (e) { setError(e.message); return }
    setInfo('Registration confirmed: ' + d.job_title + ' at ' + one(d.companies)?.name + '. Track your status under "My registrations".')
    setReload(n => n + 1)
  }

  async function withdraw(d: any) {
    const reg = regs[d.id]
    if (!reg || !window.confirm('Withdraw your registration for ' + d.job_title + '?')) return
    setBusy(d.id); setError(''); setInfo('')
    const { error: e } = await supabase.rpc('withdraw_drive_registration', { p_registration_id: reg.id })
    setBusy('')
    if (e) { setError(e.message); return }
    setInfo('Your registration was withdrawn.')
    setReload(n => n + 1)
  }

  async function open(path: string) {
    try { await openAttachment(path) } catch (ex: any) { setError(ex.message) }
  }

  const Line = ({ label, v }: { label: string; v?: string | null }) => v ? <div className="text-sm"><span className="text-slate-500">{label}: </span>{v}</div> : null

  return (
    <div className="space-y-4">
      <div>
        <Link to="/student" className="text-sm text-brand-green">&larr; My dashboard</Link>
        <h1 className="text-2xl font-bold text-brand-navy">Campus drives</h1>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200 p-1">
        {([['open', 'Drives for me'], ['mine', 'My registrations']] as ['open' | 'mine', string][]).map(([t, label]) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={'rounded-md py-2 text-sm font-semibold ' + (tab === t ? 'bg-white text-brand-navy shadow' : 'text-slate-500')}>{label}</button>
        ))}
      </div>

      {info && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{info}</div>}
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? <Spinner /> : tab === 'mine' ? (
        mine.length === 0 ? <div className="card text-slate-500">You have not registered for any drive yet.</div> : (
          <div className="space-y-2">
            {mine.map(r => (
              <div key={r.id} className="card">
                <div className="font-semibold text-brand-navy">{r.d ? one(r.d.companies)?.name + ' - ' + r.d.job_title : 'Drive no longer available'}</div>
                {r.d?.drive_date && <div className="text-sm text-slate-600">Drive: {formatDateTime(r.d.drive_date)}</div>}
                <div className="mt-2">
                  <span className={'rounded-full px-3 py-1 text-xs font-semibold ' + (DRIVE_STATUS[r.status]?.cls ?? '')}>{driveStatusLabel(r.status)}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : drives.length === 0 ? (
        <div className="card text-slate-500">No drives for your course right now. Please check again later.</div>
      ) : (
        <div className="space-y-3">
          {drives.map(d => {
            const company = one(d.companies)
            const reg = regs[d.id]
            const isReg = reg?.status === 'registered'
            const problems = eligibilityProblems(d, student!.course_id, semByYear)
            const deadlinePassed = d.application_deadline && new Date(d.application_deadline) < new Date()
            const canRegister = d.status === 'published' && !deadlinePassed && problems.length === 0 && !isReg && (!reg || reg.status === 'withdrawn')
            const canWithdraw = isReg && !deadlinePassed
            const chip = reg ? reg.status : ''
            return (
              <div key={d.id} className="card">
                <div className="flex items-start gap-3">
                  <CompanyLogo path={company?.logo_path} name={company?.name ?? '?'} size={48} />
                  <div className="min-w-0">
                    <h2 className="font-semibold text-brand-navy">{d.job_title}</h2>
                    <div className="text-sm text-slate-700">{company?.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className={'rounded-full px-2 py-0.5 ' + (d.status === 'published' && !deadlinePassed ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800')}>
                        {d.status === 'published' && !deadlinePassed ? 'Open' : 'Closed'}
                      </span>
                      {chip && <span className={'rounded-full px-2 py-0.5 ' + (DRIVE_STATUS[chip]?.cls ?? '')}>{driveStatusLabel(chip)}</span>}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-0.5">
                  <Line label="Package" v={d.package_details} />
                  <Line label="Location" v={d.job_location} />
                  <Line label="Apply before" v={d.application_deadline ? formatDateTime(d.application_deadline) : null} />
                  <Line label="Drive date" v={d.drive_date ? formatDateTime(d.drive_date) : null} />
                  <Line label="Venue" v={d.venue} />
                </div>

                <details className="mt-3 rounded-lg bg-slate-50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand-green">Full details and eligibility</summary>
                  <div className="mt-2 space-y-1">
                    {d.description && <p className="whitespace-pre-wrap text-sm">{d.description}</p>}
                    <Line label="Qualification" v={d.required_qualification} />
                    <Line label="Skills" v={d.required_skills} />
                    {d.min_percentage != null && <Line label="Minimum marks" v={d.min_percentage + '%'} />}
                    {d.selection_process && <div className="text-sm"><span className="text-slate-500">Selection process: </span><span className="whitespace-pre-wrap">{d.selection_process}</span></div>}
                    {d.documents_required && <div className="text-sm"><span className="text-slate-500">Documents required: </span><span className="whitespace-pre-wrap">{d.documents_required}</span></div>}
                    {d.instructions && <div className="text-sm"><span className="text-slate-500">Instructions: </span><span className="whitespace-pre-wrap">{d.instructions}</span></div>}
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-sm">
                      <div className="font-semibold text-brand-navy">Your eligibility</div>
                      {problems.length === 0 ? <div className="text-green-700">&#10003; Your course and semester are eligible.</div> : problems.map((p, i) => <div key={i} className="text-red-700">&#10007; {p}</div>)}
                      {d.min_percentage != null && <div className="text-slate-600">Please make sure you have at least {d.min_percentage}% marks. The Placement Cell will verify this.</div>}
                    </div>
                  </div>
                </details>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {canRegister && <button className="btn-green !py-1.5" disabled={busy === d.id} onClick={() => register(d)}>{reg ? 'Register again' : 'Register'}</button>}
                  {canWithdraw && <button className="btn-outline !py-1.5" disabled={busy === d.id} onClick={() => withdraw(d)}>Withdraw</button>}
                  {!canRegister && !reg && <span className="text-xs text-slate-500">{problems.length ? 'Not eligible' : 'Registration closed'}</span>}
                  {d.external_link && isHttpUrl(d.external_link) && <a className="btn-outline !py-1.5" href={d.external_link} target="_blank" rel="noopener noreferrer">Company link</a>}
                  {d.attachment_path && <button className="btn-navy !py-1.5" onClick={() => open(d.attachment_path)}>Open document</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
