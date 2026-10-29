import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/Layout'
import { downloadCsv } from '../lib/csv'
import { eventCatLabel, formatDateTime } from '../lib/content'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export default function EventParticipants() {
  const { id } = useParams()
  const [event, setEvent] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showWithdrawn, setShowWithdrawn] = useState(false)
  const [busy, setBusy] = useState('')

  async function load() {
    const [ev, regs] = await Promise.all([
      supabase.from('events').select('id, title, category, event_start, venue, status').eq('id', id!).maybeSingle(),
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

  async function mark(regId: string, status: string) {
    setBusy(regId); setError('')
    const { data: u } = await supabase.auth.getUser()
    const { error: e } = await supabase.from('event_attendance').upsert(
      { event_registration_id: regId, status, marked_by: u.user?.id ?? null, marked_at: new Date().toISOString() },
      { onConflict: 'event_registration_id' })
    setBusy('')
    if (e) { setError(e.message); return }
    setRows(rs => rs.map(r => r.id === regId ? { ...r, attendance: status } : r))
  }

  async function markAllPresent() {
    const targets = rows.filter(r => r.status === 'registered' && !r.attendance)
    if (targets.length === 0) { setError('Everyone is already marked.'); return }
    if (!window.confirm('Mark ' + targets.length + ' unmarked participant(s) as present?')) return
    setBusy('all'); setError('')
    const { data: u } = await supabase.auth.getUser()
    const now = new Date().toISOString()
    const { error: e } = await supabase.from('event_attendance').upsert(
      targets.map(t => ({ event_registration_id: t.id, status: 'present', marked_by: u.user?.id ?? null, marked_at: now })),
      { onConflict: 'event_registration_id' })
    setBusy('')
    if (e) { setError(e.message); return }
    setRows(rs => rs.map(r => targets.some(t => t.id === r.id) ? { ...r, attendance: 'present' } : r))
  }

  function exportCsv() {
    downloadCsv('CampusConnect_event_' + (event?.title ?? 'event').replace(/[^a-zA-Z0-9]+/g, '_') + '.csv',
      ['register_no', 'name', 'course', 'registration_status', 'registered_at', 'attendance'],
      rows.map(r => [r.reg, r.name, r.course, r.status, r.registered_at, r.attendance || 'not marked']))
  }

  const active = rows.filter(r => r.status === 'registered')
  const count = (s: string) => active.filter(r => r.attendance === s).length
  const shown = useMemo(() => {
    const t = search.trim().toLowerCase()
    return rows.filter(r => (showWithdrawn || r.status === 'registered') &&
      (!t || r.name.toLowerCase().includes(t) || r.reg.toLowerCase().includes(t)))
  }, [rows, search, showWithdrawn])

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
          <button className="btn-green" disabled={busy === 'all'} onClick={markAllPresent}>Mark all unmarked as present</button>
          <button className="btn-outline" onClick={exportCsv}>Export CSV</button>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={showWithdrawn} onChange={e => setShowWithdrawn(e.target.checked)} /> Show withdrawn</label>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {shown.length === 0 ? <div className="card text-slate-500">No participants to show.</div> : (
        <div className="space-y-2">
          {shown.map(r => (
            <div key={r.id} className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold text-brand-navy">{r.name}</div>
                <div className="text-sm text-slate-600">{r.reg} &middot; {r.course}{r.status === 'withdrawn' ? ' · withdrawn' : ''}</div>
              </div>
              {r.status === 'registered' ? (
                <select className="input !w-auto" value={r.attendance} disabled={busy === r.id} onChange={e => mark(r.id, e.target.value)}>
                  <option value="" disabled>Not marked</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="excused">Excused</option>
                </select>
              ) : <span className="text-sm text-slate-400">-</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, v, cls = 'text-brand-navy' }: { label: string; v: number; cls?: string }) {
  return <div className="card !p-3"><div className="text-xs text-slate-500">{label}</div><div className={'text-2xl font-bold ' + cls}>{v}</div></div>
}
