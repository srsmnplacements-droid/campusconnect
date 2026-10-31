import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/Layout'
import ReportPrint, { printReport } from '../components/ReportPrint'
import { downloadCsv } from '../lib/csv'
import { DRIVE_STATUS, driveStatusLabel, formatDateTime, openAttachment, removeAttachment } from '../lib/content'
import Modal from '../components/Modal'
import { OFFER_BUCKET, OFFER_MAX, cleanupOfferFile, uploadOffer, uploadSharedOffer } from '../lib/offers'

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
  const [offers, setOffers] = useState<Record<string, any>>({})
  const [offerFor, setOfferFor] = useState<any | null>(null)
  const [commonOpen, setCommonOpen] = useState(false)
  const [info, setInfo] = useState('')
  const [offerTick, setOfferTick] = useState(0)

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
  useEffect(() => {
    supabase.from('offer_letters').select('*').eq('drive_id', id!).then(({ data }) => {
      const m: Record<string, any> = {}
      ;(data ?? []).forEach((o: any) => { m[o.student_id] = o })
      setOffers(m)
    })
  }, [id, offerTick])

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
          <button className="btn-green" onClick={() => { setInfo(''); setCommonOpen(true) }}>Upload common offer PDF</button>
        </div>
        <p className="text-xs text-slate-500">Exports include only the {shown.length} applicant(s) currently shown. For the PDF, choose <b>Save as PDF</b> in the print window.</p>
      </div>

      {info && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{info}</div>}
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {shown.length === 0 ? <div className="card text-slate-500">No applicants to show.</div> : (
        <div className="space-y-2">
          {shown.map(r => (
            <div key={r.id} className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold text-brand-navy">{r.name}</div>
                <div className="text-sm text-slate-600">{r.reg} &middot; {r.course}{r.sem ? ' · Sem ' + r.sem : ''}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select className={'input !w-auto font-semibold ' + (DRIVE_STATUS[r.status]?.cls ?? '')} value={r.status} disabled={busy === r.id} onChange={e => setStatus(r, e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{driveStatusLabel(s)}</option>)}
                </select>
                {offers[r.student_id] ? (
                  <button className="btn-green !py-1.5" onClick={() => setOfferFor(r)}>Offer letter &#10003;</button>
                ) : r.status === 'selected' ? (
                  <button className="btn-outline !py-1.5" onClick={() => setOfferFor(r)}>Upload offer letter</button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {commonOpen && <CommonOfferModal drive={drive} rows={rows} offers={offers} onClose={() => setCommonOpen(false)}
        onSaved={(n) => { setCommonOpen(false); setOfferTick(t => t + 1); setInfo('The common PDF was shared with ' + n + ' student' + (n === 1 ? '' : 's') + '.'); load() }} />}
      {offerFor && <OfferModal drive={drive} row={offerFor} existing={offers[offerFor.student_id]}
        onClose={() => setOfferFor(null)} onSaved={() => { setOfferFor(null); setOfferTick(n => n + 1) }} />}

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

function OfferModal({ drive, row, existing, onClose, onSaved }: { drive: any; row: any; existing: any; onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState<string>(existing?.notes ?? '')
  const [outcome, setOutcome] = useState('selected')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('placement_results').select('outcome').eq('drive_id', drive.id).eq('student_id', row.student_id).maybeSingle()
      .then(({ data }) => { if (data?.outcome) setOutcome(data.outcome) })
  }, [])

  function pick(f: File | null) {
    setErr('')
    if (f && f.size > OFFER_MAX) { setErr('File is too large. Maximum size is 15 MB.'); return }
    if (f && !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(f.type)) { setErr('Only PDF, PNG, JPG or WEBP files are allowed.'); return }
    setFile(f)
  }

  async function save() {
    setErr('')
    if (!existing && !file) { setErr('Please choose the offer letter file.'); return }
    setBusy(true)
    const id: string = existing?.id ?? crypto.randomUUID()
    let newPath: string | null = null
    try {
      if (file) newPath = await uploadOffer(file, row.student_id, id, drive.academic_year_id)
      const payload: any = { notes: notes.trim() || null }
      if (file && newPath) Object.assign(payload, { file_path: newPath, file_name: file.name, size_bytes: file.size, mime_type: file.type, is_shared: false })
      let dbErr: any
      if (existing) {
        ({ error: dbErr } = await supabase.from('offer_letters').update(payload).eq('id', id))
      } else {
        const { data: u } = await supabase.auth.getUser()
        ;({ error: dbErr } = await supabase.from('offer_letters').insert({
          ...payload, id, academic_year_id: drive.academic_year_id, drive_id: drive.id, student_id: row.student_id,
          company_id: drive.company_id, job_title: drive.job_title, uploaded_by: u.user?.id ?? null,
        }))
      }
      if (dbErr) {
        if (newPath) await removeAttachment(newPath, OFFER_BUCKET).catch(() => {})
        throw new Error(dbErr.message)
      }
      if (file && existing?.file_path) await cleanupOfferFile(existing.file_path).catch(() => {})
      const { error: pe } = await supabase.from('placement_results').update({ outcome }).eq('drive_id', drive.id).eq('student_id', row.student_id)
      if (pe) throw new Error('The letter was saved, but the outcome could not be updated: ' + pe.message)
      onSaved()
    } catch (ex: any) { setErr(ex.message) }
    setBusy(false)
  }

  async function remove() {
    if (!window.confirm('Delete this offer letter file permanently?')) return
    setBusy(true); setErr('')
    try {
      const { error } = await supabase.from('offer_letters').delete().eq('id', existing.id)
      if (error) throw new Error(error.message)
      await cleanupOfferFile(existing.file_path)
      onSaved()
    } catch (ex: any) { setErr(ex.message) }
    setBusy(false)
  }

  return (
    <Modal title={'Offer letter: ' + row.name} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{row.reg} &middot; {row.course}. Only this student and the Placement Cell can open this file.</p>
        {existing && (
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm">
            <span className="flex-1">{existing.is_shared ? 'A common PDF shared with other students is linked' : 'A letter is already saved'}{existing.file_name ? ': ' + existing.file_name : ''}.</span>
            <button type="button" className="font-semibold text-brand-green underline" onClick={() => openAttachment(existing.file_path, OFFER_BUCKET).catch((e: any) => setErr(e.message))}>View</button>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">{existing ? 'Replace with this student\'s own letter (optional)' : 'Offer letter file'}</label>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="block w-full text-sm" onChange={e => pick(e.target.files?.[0] ?? null)} />
          <p className="mt-1 text-xs text-slate-500">PDF, PNG, JPG or WEBP. Maximum 15 MB. A phone photo of the letter works too.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Outcome</label>
          <select className="input" value={outcome} onChange={e => setOutcome(e.target.value)}>
            <option value="selected">Selected</option>
            <option value="offer_accepted">Offer accepted</option>
            <option value="offer_declined">Offer declined</option>
            <option value="joined">Joined</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
          <textarea className="input" rows={2} maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Package, joining date, remarks..." />
        </div>
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <button className="btn-green w-full" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save'}</button>
        {existing && <button type="button" className="w-full text-sm text-red-600 underline" disabled={busy} onClick={remove}>{existing.is_shared ? 'Remove the common PDF from this student' : 'Delete this offer letter'}</button>}
      </div>
    </Modal>
  )
}

function CommonOfferModal({ drive, rows, offers, onClose, onSaved }:
  { drive: any; rows: any[]; offers: Record<string, any>; onClose: () => void; onSaved: (n: number) => void }) {
  const list = rows.filter(r => r.status !== 'withdrawn')
  const free = list.filter(r => !offers[r.student_id])
  const [picked, setPicked] = useState<string[]>(free.filter(r => r.status === 'selected').map(r => r.student_id))
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [markSelected, setMarkSelected] = useState(true)
  const [agree, setAgree] = useState(false)
  const [search, setSearch] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const shownList = list.filter(r => { const t = search.trim().toLowerCase(); return !t || r.name.toLowerCase().includes(t) || r.reg.toLowerCase().includes(t) })
  const toggle = (sid: string) => setPicked(p => p.includes(sid) ? p.filter(x => x !== sid) : [...p, sid])

  function pick(f: File | null) {
    setErr('')
    if (f && f.size > OFFER_MAX) { setErr('File is too large. Maximum size is 15 MB.'); return }
    if (f && !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(f.type)) { setErr('Only PDF, PNG, JPG or WEBP files are allowed.'); return }
    setFile(f)
  }

  async function save() {
    setErr('')
    if (!file) { setErr('Please choose the PDF file.'); return }
    if (picked.length === 0) { setErr('Please tick at least one student.'); return }
    if (!agree) { setErr('Please tick the box to confirm the privacy notice.'); return }
    setBusy(true)
    let path: string | null = null
    try {
      path = await uploadSharedOffer(file, drive.id, drive.academic_year_id)
      const { data: u } = await supabase.auth.getUser()
      const recs = picked.map(sid => ({
        id: crypto.randomUUID(), academic_year_id: drive.academic_year_id, drive_id: drive.id, student_id: sid,
        company_id: drive.company_id, job_title: drive.job_title, file_path: path, file_name: file.name,
        size_bytes: file.size, mime_type: file.type, notes: notes.trim() || null, is_shared: true, uploaded_by: u.user?.id ?? null,
      }))
      const { error } = await supabase.from('offer_letters').insert(recs)
      if (error) { await cleanupOfferFile(path).catch(() => {}); throw new Error(error.message) }

      if (markSelected) {
        const toMark = list.filter(r => picked.includes(r.student_id) && r.status !== 'selected')
        if (toMark.length) {
          const { error: e1 } = await supabase.from('drive_registrations').update({ status: 'selected' }).in('id', toMark.map(r => r.id))
          if (e1) throw new Error('The PDF was shared, but the status could not be changed: ' + e1.message)
          const sids = toMark.map(r => r.student_id)
          await supabase.from('placement_results').delete().eq('drive_id', drive.id).in('student_id', sids)
          const { error: e2 } = await supabase.from('placement_results').insert(sids.map(sid => ({
            academic_year_id: drive.academic_year_id, drive_id: drive.id, student_id: sid, company_id: drive.company_id,
            job_title: drive.job_title, package_details: drive.package_details, outcome: 'selected',
          })))
          if (e2) throw new Error('The PDF was shared, but the placement results could not be added: ' + e2.message)
        }
      }
      onSaved(picked.length)
    } catch (ex: any) { setErr(ex.message) }
    setBusy(false)
  }

  return (
    <Modal title="Upload common offer PDF" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Use this when the company sends <b>one PDF for many students</b>. It is stored once, and each student you tick can open it.</p>
        <div>
          <label className="mb-1 block text-sm font-medium">PDF file</label>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="block w-full text-sm" onChange={e => pick(e.target.files?.[0] ?? null)} />
          <p className="mt-1 text-xs text-slate-500">Maximum 15 MB.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Students who can open it ({picked.length} ticked)</label>
          <input className="input mb-2" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="mb-2 flex flex-wrap gap-2 text-xs">
            <button type="button" className="btn-outline !px-2 !py-1" onClick={() => setPicked(free.filter(r => r.status === 'selected').map(r => r.student_id))}>All selected students</button>
            <button type="button" className="btn-outline !px-2 !py-1" onClick={() => setPicked(free.map(r => r.student_id))}>All applicants</button>
            <button type="button" className="btn-outline !px-2 !py-1" onClick={() => setPicked([])}>Clear</button>
          </div>
          <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {shownList.length === 0 && <div className="p-3 text-sm text-slate-500">No applicants.</div>}
            {shownList.map(r => {
              const has = !!offers[r.student_id]
              return (
                <label key={r.id} className={'flex items-center gap-3 p-2 text-sm ' + (has ? 'opacity-50' : 'cursor-pointer')}>
                  <input type="checkbox" className="h-4 w-4" disabled={has} checked={picked.includes(r.student_id)} onChange={() => toggle(r.student_id)} />
                  <span className="flex-1"><b>{r.name}</b> <span className="text-slate-500">{r.reg} · {r.course}</span></span>
                  <span className="text-xs text-slate-500">{has ? 'already has a letter' : driveStatusLabel(r.status)}</span>
                </label>
              )
            })}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
          <input className="input" maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Offer letters for all selected students" />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={markSelected} onChange={e => setMarkSelected(e.target.checked)} />
          <span>Also mark the ticked students as <b>Selected</b> (adds them to the placement results).</span>
        </label>
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <b>Privacy notice.</b> Everyone you tick can open this whole file. If it contains other students' names or letters, they will see them too.
          If that is a problem, split the PDF first and upload each student's page separately.
          <label className="mt-2 flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>I understand and want to share this file with the ticked students.</span>
          </label>
        </div>
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <button className="btn-green w-full" disabled={busy} onClick={save}>{busy ? 'Uploading...' : 'Upload and share'}</button>
      </div>
    </Modal>
  )
}
