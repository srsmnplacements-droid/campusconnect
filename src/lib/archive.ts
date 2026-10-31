import JSZip from 'jszip'
import Papa from 'papaparse'
import { supabase } from './supabase'
import { toCsv, downloadBlob } from './csv'
import { callArchive } from './api'

export interface ExportInput {
  yearId: string
  yearLabel: string
  courseId: string | null
  courseCode: string | null
}
export interface ExportResult {
  jobId: string
  counts: Record<string, number>
  fileCount: number
  parts: { name: string; bytes: number }[]
}
type Progress = (percent: number, message: string) => void

const PART_LIMIT = 100 * 1024 * 1024 // keep each ZIP part under about 100 MB
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const chunk = <T,>(a: T[], n: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n))
  return out
}

async function fetchAll(make: () => any): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make().range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}
async function fetchIn(ids: string[], make: (ids: string[]) => any): Promise<any[]> {
  const out: any[] = []
  for (const part of chunk(ids, 50)) out.push(...(await fetchAll(() => make(part))))
  return out
}

export async function buildAndExport(input: ExportInput, progress: Progress): Promise<ExportResult> {
  const { yearId: y, courseId: c } = input
  const wholeYear = !c
  const exportedAt = new Date().toISOString()
  progress(2, 'Reading records...')

  // ---------- students of the scope ----------
  const enrol = await fetchAll(() => {
    let q = supabase.from('student_academic_records')
      .select('id, student_id, semester, batch, status, student_profiles(register_no, full_name, email, phone, status), courses(code)')
      .eq('academic_year_id', y).order('id')
    if (c) q = q.eq('course_id', c)
    return q
  })
  const scopeIds: string[] | null = c ? Array.from(new Set(enrol.map((e: any) => e.student_id))) : null
  const scoped = async (make: (ids: string[] | null) => any) =>
    scopeIds ? fetchIn(scopeIds, ids => make(ids)) : fetchAll(() => make(null))

  // ---------- activity records ----------
  progress(8, 'Reading drives and events...')
  const driveRegs = await scoped(ids => {
    let q = supabase.from('drive_registrations')
      .select('id, status, registered_at, drive_id, student_profiles(register_no, full_name, courses(code)), campus_drives(job_title, companies(name))')
      .eq('academic_year_id', y).order('id')
    if (ids) q = q.in('student_id', ids)
    return q
  })
  const eventRegs = await scoped(ids => {
    let q = supabase.from('event_registrations')
      .select('id, status, registered_at, event_id, student_profiles(register_no, full_name, courses(code)), events(title, event_start), event_attendance(status, remarks, marked_at)')
      .eq('academic_year_id', y).order('id')
    if (ids) q = q.in('student_id', ids)
    return q
  })
  const results = await scoped(ids => {
    let q = supabase.from('placement_results')
      .select('id, outcome, job_title, package_details, created_at, student_profiles(register_no, full_name, courses(code)), companies(name)')
      .eq('academic_year_id', y).order('id')
    if (ids) q = q.in('student_id', ids)
    return q
  })
  const offers = await scoped(ids => {
    let q = supabase.from('offer_letters')
      .select('id, student_id, job_title, file_name, file_path, size_bytes, notes, is_shared, created_at, student_profiles(register_no, full_name, courses(code)), companies(name)')
      .eq('academic_year_id', y).order('id')
    if (ids) q = q.in('student_id', ids)
    return q
  })

  // ---------- year-wide records (whole-year mode) or the ones referenced (course mode) ----------
  let drives: any[] = [], events: any[] = [], notices: any[] = [], resources: any[] = [], companies: any[] = []
  if (wholeYear) {
    drives = await fetchAll(() => supabase.from('campus_drives').select('*, companies(name), drive_eligible_courses(courses(code))').eq('academic_year_id', y).order('id'))
    events = await fetchAll(() => supabase.from('events').select('*, event_eligible_courses(courses(code))').eq('academic_year_id', y).order('id'))
    notices = await fetchAll(() => supabase.from('notices').select('*').eq('academic_year_id', y).order('id'))
    resources = await fetchAll(() => supabase.from('placement_resources').select('*').eq('academic_year_id', y).order('id'))
  } else {
    const dIds = Array.from(new Set(driveRegs.map((r: any) => r.drive_id)))
    const eIds = Array.from(new Set(eventRegs.map((r: any) => r.event_id)))
    if (dIds.length) drives = await fetchIn(dIds, ids => supabase.from('campus_drives').select('*, companies(name), drive_eligible_courses(courses(code))').in('id', ids).order('id'))
    if (eIds.length) events = await fetchIn(eIds, ids => supabase.from('events').select('*, event_eligible_courses(courses(code))').in('id', ids).order('id'))
  }
  const companyIds = Array.from(new Set(drives.map((d: any) => d.company_id).filter(Boolean)))
  if (companyIds.length) companies = await fetchIn(companyIds, ids => supabase.from('companies').select('*').in('id', ids).order('id'))

  const { data: yearRow } = await supabase.from('academic_years').select('*').eq('id', y).maybeSingle()
  const { data: courseRows } = await supabase.from('courses').select('*').order('code')

  // ---------- files ----------
  progress(14, 'Listing files...')
  let files: any[] = []
  if (wholeYear) {
    files = await fetchAll(() => supabase.from('uploaded_files').select('*').eq('academic_year_id', y).order('id'))
  } else if (offers.length) {
    files = await fetchIn(offers.map((o: any) => o.id), ids => supabase.from('uploaded_files').select('*').eq('linked_table', 'offer_letters').in('linked_id', ids).order('id'))
  }

  // common PDFs shared by several students: put them in the ZIP, but they are not counted or deleted in course mode
  let extraFiles: any[] = []
  if (!wholeYear) {
    const sharedPaths = Array.from(new Set(offers.filter((o: any) => o.is_shared).map((o: any) => o.file_path)))
    if (sharedPaths.length) extraFiles = await fetchIn(sharedPaths, ids => supabase.from('uploaded_files').select('*').in('path', ids).order('id'))
  }
  const zipFiles = [...files, ...extraFiles]

  // ---------- counts (must match the database, checked by the server) ----------
  const counts: Record<string, number> = {
    enrolments: enrol.length,
    drive_registrations: driveRegs.length,
    event_registrations: eventRegs.length,
    event_attendance: eventRegs.filter((r: any) => one(r.event_attendance)).length,
    placement_results: results.length,
    offer_letters: offers.length,
    files: files.length,
  }
  if (wholeYear) Object.assign(counts, { drives: drives.length, events: events.length, notices: notices.length, resources: resources.length })

  // ---------- CSV files ----------
  const sp = (r: any) => one(r.student_profiles) ?? {}
  const regNoByOffer = new Map<string, string>(offers.map((o: any) => [o.id, sp(o).register_no ?? 'unknown']))
  const coName = (r: any) => one(r.companies)?.name ?? ''
  const eligible = (list: any) => (Array.isArray(list) ? list : []).map((x: any) => one(x.courses)?.code).filter(Boolean).join('; ')

  const csvs: { path: string; header: string[]; rows: unknown[][] }[] = [
    { path: 'data/01_students/student_enrolments.csv',
      header: ['register_no', 'name', 'course', 'semester', 'batch', 'enrolment_status', 'account_status', 'email', 'phone'],
      rows: enrol.map((e: any) => { const p = sp(e); return [p.register_no, p.full_name, one(e.courses)?.code, e.semester, e.batch, e.status, p.status, p.email, p.phone] }) },
    { path: 'data/02_courses_and_year/academic_year.csv',
      header: ['label', 'start_date', 'end_date', 'is_current'],
      rows: yearRow ? [[yearRow.label, yearRow.start_date, yearRow.end_date, yearRow.is_current]] : [] },
    { path: 'data/02_courses_and_year/courses.csv',
      header: ['code', 'name', 'duration_years', 'total_semesters', 'is_active'],
      rows: (courseRows ?? []).map((r: any) => [r.code, r.name, r.duration_years, r.total_semesters, r.is_active]) },
    { path: 'data/03_companies/companies.csv', header: ['name', 'website'], rows: companies.map((r: any) => [r.name, r.website]) },
    { path: 'data/04_drives/drives.csv',
      header: ['company', 'job_title', 'status', 'eligible_courses', 'eligible_semesters', 'min_percentage', 'package', 'location', 'application_deadline', 'drive_date', 'venue', 'selection_process', 'documents_required', 'required_qualification', 'required_skills', 'instructions', 'external_link', 'description'],
      rows: drives.map((d: any) => [coName(d), d.job_title, d.status, eligible(d.drive_eligible_courses), (d.eligible_semesters ?? []).join('; '), d.min_percentage, d.package_details, d.job_location, d.application_deadline, d.drive_date, d.venue, d.selection_process, d.documents_required, d.required_qualification, d.required_skills, d.instructions, d.external_link, d.description]) },
    { path: 'data/04_drives/drive_registrations.csv',
      header: ['register_no', 'name', 'course', 'company', 'job_title', 'status', 'registered_at'],
      rows: driveRegs.map((r: any) => { const p = sp(r); const d = one(r.campus_drives) ?? {}; return [p.register_no, p.full_name, one(p.courses)?.code, one(d.companies)?.name, d.job_title, r.status, r.registered_at] }) },
    { path: 'data/05_events/events.csv',
      header: ['title', 'category', 'status', 'start', 'end', 'venue', 'organiser', 'registration_deadline', 'eligible_courses', 'description'],
      rows: events.map((e: any) => [e.title, e.category, e.status, e.event_start, e.event_end, e.venue, e.organiser, e.registration_deadline, eligible(e.event_eligible_courses), e.description]) },
    { path: 'data/05_events/event_registrations.csv',
      header: ['register_no', 'name', 'course', 'event', 'event_start', 'registration_status', 'registered_at'],
      rows: eventRegs.map((r: any) => { const p = sp(r); const e = one(r.events) ?? {}; return [p.register_no, p.full_name, one(p.courses)?.code, e.title, e.event_start, r.status, r.registered_at] }) },
    { path: 'data/05_events/event_attendance.csv',
      header: ['register_no', 'name', 'course', 'event', 'event_start', 'attendance', 'remarks', 'marked_at'],
      rows: eventRegs.filter((r: any) => one(r.event_attendance)).map((r: any) => { const p = sp(r); const e = one(r.events) ?? {}; const a = one(r.event_attendance); return [p.register_no, p.full_name, one(p.courses)?.code, e.title, e.event_start, a.status, a.remarks, a.marked_at] }) },
    { path: 'data/06_notices_resources/notices.csv',
      header: ['title', 'category', 'status', 'published_at', 'is_public', 'body'],
      rows: notices.map((n: any) => [n.title, n.category, n.status, n.published_at, n.is_public, n.body]) },
    { path: 'data/06_notices_resources/placement_resources.csv',
      header: ['title', 'category', 'status', 'is_public', 'external_link', 'description'],
      rows: resources.map((r: any) => [r.title, r.category, r.status, r.is_public, r.external_link, r.description]) },
    { path: 'data/07_placement/placement_results.csv',
      header: ['register_no', 'name', 'course', 'company', 'job_title', 'package', 'outcome', 'recorded_at'],
      rows: results.map((r: any) => { const p = sp(r); return [p.register_no, p.full_name, one(p.courses)?.code, coName(r), r.job_title, r.package_details, r.outcome, r.created_at] }) },
    { path: 'data/07_placement/offer_letters.csv',
      header: ['register_no', 'name', 'course', 'company', 'job_title', 'file_in_zip', 'notes', 'uploaded_at'],
      rows: offers.map((o: any) => { const p = sp(o); return [p.register_no, p.full_name, one(p.courses)?.code, coName(o), o.job_title, o.file_path ? (o.is_shared ? 'files/offer_letters/_common/' : 'files/offer_letters/' + (p.register_no ?? 'unknown') + '/') + o.file_path.split('/').pop() : '', o.notes, o.created_at] }) },
  ]

  // ---------- plan the ZIP parts ----------
  const folder: Record<string, string> = { notices: 'notices', placement_resources: 'resources', events: 'events', drives: 'drives' }
  const zipPathOf = (f: any) => {
    const base = String(f.path).split('/').pop()
    if (f.linked_table === 'offer_letters_shared') return 'files/offer_letters/_common/' + base
    if (f.linked_table === 'offer_letters') return 'files/offer_letters/' + (regNoByOffer.get(f.linked_id) ?? 'unknown') + '/' + base
    return 'files/' + (folder[f.linked_table] ?? 'other') + '/' + base
  }
  const parts: { files: any[]; bytes: number }[] = [{ files: [], bytes: 0 }]
  for (const f of zipFiles) {
    const cur = parts[parts.length - 1]
    const size = Number(f.size_bytes ?? 0)
    if (cur.files.length > 0 && cur.bytes + size > PART_LIMIT) parts.push({ files: [], bytes: 0 })
    const p = parts[parts.length - 1]
    p.files.push(f); p.bytes += size
  }
  const base = 'CampusConnect_AcademicYear_' + input.yearLabel + (input.courseCode ? '_' + input.courseCode : '')
  const partName = (i: number) => parts.length === 1 ? base + '.zip' : base + '_part' + (i + 1) + 'of' + parts.length + '.zip'

  const manifest = {
    application: 'CampusConnect - SRSMN GFGC Barkur Placement Hub',
    academic_year: input.yearLabel,
    course: input.courseCode ?? 'all courses',
    exported_at: exportedAt,
    record_counts: counts,
    zip_parts: parts.map((_, i) => partName(i)),
    data_files: csvs.map(f => ({ path: f.path, records: f.rows.length })),
    files: parts.flatMap((p, i) => p.files.map(f => ({ path: zipPathOf(f), bytes: f.size_bytes, part: i + 1, source: f.linked_table }))),
  }
  const readme = [
    'CampusConnect - Academic Year Archive',
    '=====================================',
    'College : Smt. Rukmini Shedthi Memorial National Government First Grade College and PG Study Center, Barkur',
    'Year    : ' + input.yearLabel,
    'Scope   : ' + (input.courseCode ? 'Course ' + input.courseCode + ' only' : 'Whole academic year'),
    'Created : ' + exportedAt,
    '',
    'WHAT IS INSIDE',
    '  data/    CSV files (open with Excel or Google Sheets). Numbered folders keep related records together.',
    '  files/   Uploaded documents: notices, resources, events, drives and offer letters (offer letters are sorted by register number).',
    '  manifest.json  The list of every file and the number of records in each CSV.',
    parts.length > 1 ? '  This archive has ' + parts.length + ' parts. The data folder is in part 1. Keep all parts together.' : '',
    '',
    'HOW THE FILES CONNECT',
    '  Students are identified by register number in every CSV. Drive and event rows show the company, job or event name.',
    '',
    'PRIVACY',
    '  This archive contains personal student data (names, phone numbers, emails, offer letters).',
    '  Keep it in a safe place. Do not share it publicly or upload it to open websites.',
    '  It contains no passwords, login tokens or secret keys.',
    '',
    'RETENTION',
    '  Keep this archive as long as the college retention policy and audit rules require.',
  ].filter(l => l !== undefined).join('\n')

  // ---------- build the ZIP parts ----------
  const total = zipFiles.length
  let doneFiles = 0
  const built: { name: string; blob: Blob }[] = []
  for (let i = 0; i < parts.length; i++) {
    const zip = new JSZip()
    if (i === 0) {
      zip.file('README.txt', readme)
      zip.file('manifest.json', JSON.stringify(manifest, null, 2))
      for (const f of csvs) zip.file(f.path, '\ufeff' + toCsv(f.header, f.rows))
    } else {
      zip.file('README_part' + (i + 1) + '.txt', 'Part ' + (i + 1) + ' of ' + parts.length + ' of the archive ' + base + '. The data folder and manifest are in part 1.')
    }
    for (const f of parts[i].files) {
      progress(15 + Math.round((doneFiles / Math.max(total, 1)) * 60), 'Downloading file ' + (doneFiles + 1) + ' of ' + total + '...')
      const { data, error } = await supabase.storage.from(f.bucket).download(f.path)
      if (error || !data) throw new Error('Could not download a file (' + String(f.path).split('/').pop() + '): ' + (error?.message ?? 'empty'))
      if (Number(f.size_bytes) > 0 && data.size !== Number(f.size_bytes)) throw new Error('A downloaded file has the wrong size (' + String(f.path).split('/').pop() + '). Please try again.')
      zip.file(zipPathOf(f), data)
      doneFiles++
    }
    progress(78 + Math.round((i / parts.length) * 10), 'Creating ZIP ' + (i + 1) + ' of ' + parts.length + '...')
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })

    // ---------- verify the ZIP by opening it again ----------
    progress(90, 'Checking ZIP ' + (i + 1) + '...')
    const check = await JSZip.loadAsync(blob)
    if (i === 0) {
      for (const f of csvs) {
        const entry = check.file(f.path)
        if (!entry) throw new Error('Check failed: ' + f.path + ' is missing from the ZIP.')
        const text = await entry.async('string')
        const parsed = Papa.parse(text.replace(/^\ufeff/, ''), { skipEmptyLines: true })
        if (parsed.data.length !== f.rows.length + 1) throw new Error('Check failed: ' + f.path + ' has the wrong number of rows.')
      }
      if (!check.file('README.txt') || !check.file('manifest.json')) throw new Error('Check failed: README or manifest is missing.')
    }
    for (const f of parts[i].files) {
      if (!check.file(zipPathOf(f))) throw new Error('Check failed: ' + zipPathOf(f) + ' is missing from the ZIP.')
    }
    built.push({ name: partName(i), blob })
  }

  // ---------- tell the server (it compares counts with the database) ----------
  progress(94, 'Recording the archive...')
  const archiveBytes = built.reduce((s, b) => s + b.blob.size, 0)
  const rec = await callArchive<{ export_job_id: string }>({
    action: 'record_export', academic_year_id: y, course_id: c, counts, file_count: files.length, archive_size_bytes: archiveBytes,
  })

  // ---------- save to the computer ----------
  progress(97, 'Saving to your device...')
  for (const b of built) {
    downloadBlob(b.name, b.blob)
    await new Promise(r => setTimeout(r, 700))
  }
  progress(100, 'Done.')
  return { jobId: rec.export_job_id, counts, fileCount: files.length, parts: built.map(b => ({ name: b.name, bytes: b.blob.size })) }
}
