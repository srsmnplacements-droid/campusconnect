import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/Layout'
import { downloadCsv } from '../lib/csv'
import ReportPrint, { printReport } from '../components/ReportPrint'
import { eventCatLabel, formatDateTime } from '../lib/content'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const ATT_LABEL: Record<string, string> = { present: 'Present', absent: 'Absent', excused: 'Excused' }
const ATT_CLS: Record<string, string> = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-700',
  excused: 'bg-amber-100 text-amber-800',
  '': 'bg-slate-100 text-slate-500',
}

export default function EventParticipants() {
  const { id } = useParams()
  const [event, setEvent] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [search, setSearch] = useState('')
  const [showWithdrawn, setShowWithdrawn] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  async function load() {
    const [ev, regs] = await Promise.all([
      supabase.from('events').select('id, title, category, event_start, venue, organiser, status, academic_years(label)').eq('id', id!).maybeSingle(),
      supabase.from('event_registrations')
        .select('id, status, registered_at, student_profiles(register_no, full_name, courses(code)), event_attendance(id, status)')
        .eq('event_id', id!).order('registered_at').limit(500),
    ])
    if (ev.error) setError(ev.error.message)
    if (regs.error) setError(regs.error.message)
    setEvent(ev.data)
    setRows((regs.data ?? []).map((r: any) => {
      const sp = one(r.student_profiles) ?? {}
      const att = one(r.event_attendance)
      return {
        id: r.id, status: r.status, registered_at: r.registered_at,
        reg: sp.register_no ?? '', name: sp.full_name ?? '', course: one(sp.courses)?.code ?? '',
        attendance: att?.status ?? '',
      }
    }).sort((a: any, b: any) => a.name.localeCompare(b.name)))
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  const shown = useMemo(() => {
    const t = search.trim().toLowerCase()
    return rows.filter(r => (showWithdrawn || r.status === 'registered') &&
      (!t || r.name.toLowerCase().includes(t) || r.reg.toLowerCase().includes(t)))
  }, [rows, search, showWithdrawn])

  // only registered (not withdrawn) people can be marked
  const markable = shown.filter(r => r.status === 'registered')
  const allSelected = markable.length > 0 && markable.every(r => selected.includes(r.id))

  function toggleAll() {
    setInfo('')
    setSelected(allSelected ? selected.filter(x => !markable.some(r => r.id === x)) : Array.from(new Set([...selected, ...markable.map(r => r.id)])))
  }
  function toggleOne(rid: string) {
    setInfo('')
    setSelected(s => s.includes(rid) ? s.filter(x => x !== rid) : [...s, rid])
  }

  async function applyBulk(status: 'present' | 'absent' | 'excused') {
    const ids = selected.filter(x => rows.some(r => r.id === x && r.status === 'registered'))
    if (ids.length === 0) { setError('Please tick at least one participant first.'); return }
    setBusy(true); setError(''); setInfo('')
    const { data: u } = await supabase.auth.getUser()
    const now = new Date().toISOString()
    const { error: e } = await supabase.from('event_attendance').upsert(
      ids.map(rid => ({ event_registration_id: rid, status, marked_by: u.user?.id ?? null, marked_at: now })),
      { onConflict: 'event_registration_id' })
    setBusy(false)
    if (e) { setError(e.message); return }
    setRows(rs => rs.map(r => ids.includes(r.id) ? { ...r, attendance: status } : r))
    setSelected([])
    setInfo('Marked ' + ids.length + ' participant' + (ids.length === 1 ? '' : 's') + ' as ' + ATT_LABEL[status] + '.')
  }

  function exportCsv() {
    downloadCsv('CampusConnect_event_' + (event?.title ?? 'event').replace(/[^a-zA-Z0-9]+/g, '_') + '.csv',
      ['register_no', 'name', 'course', 'registration_status', 'registered_at', 'attendance'],
      rows.map(r => [r.reg, r.name, r.course, r.status, r.registered_at, r.attendance || 'not marked']))
  }

  const active = rows.filter(r => r.status === 'registered')
  const count = (s: string) => active.filter(r => r.attendance === s).length
  const attLabel = (a: string) => ATT_LABEL[a] ?? 'Not marked'
  const sheet = active

  if (loading) return <Spinner />
  if (!event) return <div className="card">Event not found. <Link to="/admin/events" className="text-brand-green underline">Back to events</Link></div>

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin/events" className="text-sm text-brand-green">&larr; Events</Link>
        <h1 className="text-2xl font-bold text-brand-navy">{event.title}</h1>
        <p className="text-sm text-slate-600">{eventCatLabel(event.category)} &middot; {formatDateTime(event.event_start)}{event.venue ? ' · ' + event.venue : ''}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Registered" v={active.length} />
        <Stat label="Present" v={count('present')} cls="text-brand-green" />
        <Stat label="Absent" v={count('absent')} cls="text-red-600" />
        <Stat label="Excused" v={count('excused')} cls="text-amber-600" />
        <Stat label="Not marked" v={active.filter(r => !r.attendance).length} cls="text-slate-600" />
      </div>

      <div className="card space-y-3">
        <input className="input" placeholder="Search by name or register number" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-outline" onClick={exportCsv}>Export CSV</button>
          <button className="btn-navy" onClick={() => printReport('Attendance - ' + event.title)}>Export PDF</button>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={showWithdrawn} onChange={e => setShowWithdrawn(e.target.checked)} /> Show withdrawn</label>
        </div>
      </div>

      {/* ---- select all + bulk marking bar ---- */}
      <div className="card sticky top-0 z-10 space-y-2 border-brand-green">
        <label className="flex cursor-pointer items-center gap-3 text-base font-semibold text-brand-navy">
          <input type="checkbox" className="h-5 w-5" checked={allSelected} disabled={markable.length === 0} onChange={toggleAll} />
          Select all ({markable.length})
          <span className="ml-auto text-sm font-normal text-slate-500">{selected.length} selected</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button className="btn-green" disabled={busy || selected.length === 0} onClick={() => applyBulk('present')}>Present</button>
          <button className="btn !bg-red-600 !text-white hover:!bg-red-700" disabled={busy || selected.length === 0} onClick={() => applyBulk('absent')}>Absent</button>
          <button className="btn !bg-amber-500 !text-white hover:!bg-amber-600" disabled={busy || selected.length === 0} onClick={() => applyBulk('excused')}>Excused</button>
        </div>
        {selected.length > 0 && (
          <button type="button" className="text-sm text-slate-500 underline" onClick={() => setSelected([])}>Clear selection</button>
        )}
      </div>

      {info && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{info}</div>}
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <ReportPrint
        title={'Attendance sheet: ' + event.title}
        meta={[eventCatLabel(event.category) + '   |   ' + formatDateTime(event.event_start) + (event.venue ? '   |   Venue: ' + event.venue : ''), ...(event.organiser ? ['Resource person: ' + event.organiser] : []), ...(one(event.academic_years)?.label ? ['Academic year: ' + one(event.academic_years).label] : [])]}
        columns={[{ label: 'S.No', width: '9mm' }, { label: 'Register no', width: '28mm' }, { label: 'Name' }, { label: 'Course', width: '18mm' }, { label: 'Attendance', width: '24mm' }, { label: 'Signature', width: '28mm' }]}
        rows={sheet.map((r, i) => [i + 1, r.reg, r.name, r.course, attLabel(r.attendance), ''])}
        summary={['Registered: ' + sheet.length, 'Present: ' + sheet.filter(r => r.attendance === 'present').length, 'Absent: ' + sheet.filter(r => r.attendance === 'absent').length, 'Excused: ' + sheet.filter(r => r.attendance === 'excused').length]}
        signatures={['Resource person / Organiser', 'Placement Coordinator']}
      />

      {shown.length === 0 ? <div className="card text-slate-500">No participants to show.</div> : (
        <div className="space-y-2">
          {shown.map(r => (
            <label key={r.id} className={'card flex items-center gap-3 !p-3 ' + (r.status === 'registered' ? 'cursor-pointer' : 'opacity-60') + (selected.includes(r.id) ? ' !border-brand-green bg-brand-greenLight/40' : '')}>
              {r.status === 'registered'
                ? <input type="checkbox" className="h-5 w-5 shrink-0" checked={selected.includes(r.id)} onChange={() => toggleOne(r.id)} />
                : <span className="w-5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-brand-navy">{r.name}</div>
                <div className="text-sm text-slate-600">{r.reg} &middot; {r.course}{r.status === 'withdrawn' ? ' · withdrawn' : ''}</div>
              </div>
              {r.status === 'registered' && (
                <span className={'shrink-0 rounded-full px-3 py-1 text-xs font-semibold ' + ATT_CLS[r.attendance]}>{attLabel(r.attendance)}</span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, v, cls = 'text-brand-navy' }: { label: string; v: number; cls?: string }) {
  return <div className="card !p-3"><div className="text-xs text-slate-500">{label}</div><div className={'text-2xl font-bold ' + cls}>{v}</div></div>
}
