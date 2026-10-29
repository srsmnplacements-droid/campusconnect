import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Spinner } from '../components/Layout'
import { eventCatLabel, formatDateTime, openAttachment, startOfToday } from '../lib/content'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)
type Tab = 'upcoming' | 'past' | 'mine'
const ATT: Record<string, string> = { present: 'Present', absent: 'Absent', excused: 'Excused' }

export default function StudentEvents() {
  const { student } = useAuth()
  const [tab, setTab] = useState<Tab>('upcoming')
  const [events, setEvents] = useState<any[]>([])
  const [mine, setMine] = useState<any[]>([])
  const [regs, setRegs] = useState<Record<string, { id: string; status: string }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState('')

  const loadRegs = useCallback(async () => {
    if (!student) return
    const { data, error: e } = await supabase.from('event_registrations').select('id, event_id, status').eq('student_id', student.id)
    if (e) { setError(e.message); return }
    const m: Record<string, { id: string; status: string }> = {}
    ;(data ?? []).forEach((r: any) => { m[r.event_id] = { id: r.id, status: r.status } })
    setRegs(m)
  }, [student])

  useEffect(() => {
    if (!student) return
    setLoading(true); setError('')
    const today = startOfToday()
    if (tab === 'mine') {
      supabase.from('event_registrations')
        .select('id, status, registered_at, events(id, title, category, event_start, venue), event_attendance(status)')
        .eq('student_id', student.id).order('registered_at', { ascending: false }).limit(100)
        .then(({ data, error: e }) => {
          if (e) setError(e.message)
          setMine((data ?? []).map((r: any) => ({ ...r, ev: one(r.events), att: one(r.event_attendance)?.status ?? '' })))
          setLoading(false)
        })
    } else {
      let q: any = supabase.from('events').select('*').limit(50)
      q = tab === 'upcoming'
        ? q.gte('event_start', today).order('event_start', { ascending: true })
        : q.lt('event_start', today).order('event_start', { ascending: false })
      Promise.all([q, loadRegs()]).then(([res]: any) => {
        if (res.error) setError(res.error.message)
        setEvents(res.data ?? [])
        setLoading(false)
      })
    }
  }, [tab, student, loadRegs])

  async function register(ev: any) {
    setBusy(ev.id); setError(''); setInfo('')
    const { error: e } = await supabase.rpc('register_for_event', { p_event_id: ev.id })
    setBusy('')
    if (e) { setError(e.message); return }
    setInfo('You are registered for "' + ev.title + '".')
    await loadRegs()
  }

  async function withdraw(ev: any) {
    const reg = regs[ev.id]
    if (!reg || !window.confirm('Withdraw from "' + ev.title + '"?')) return
    setBusy(ev.id); setError(''); setInfo('')
    const { error: e } = await supabase.rpc('withdraw_event_registration', { p_registration_id: reg.id })
    setBusy('')
    if (e) { setError(e.message); return }
    setInfo('Your registration was withdrawn.')
    await loadRegs()
  }

  async function open(path: string) {
    try { await openAttachment(path) } catch (ex: any) { setError(ex.message) }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/student" className="text-sm text-brand-green">&larr; My dashboard</Link>
        <h1 className="text-2xl font-bold text-brand-navy">Events and workshops</h1>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-200 p-1">
        {([['upcoming', 'Upcoming'], ['past', 'Past'], ['mine', 'My participation']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={'rounded-md py-2 text-xs font-semibold sm:text-sm ' + (tab === t ? 'bg-white text-brand-navy shadow' : 'text-slate-500')}>{label}</button>
        ))}
      </div>

      {info && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{info}</div>}
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? <Spinner /> : tab === 'mine' ? (
        mine.length === 0 ? <div className="card text-slate-500">You have not registered for any event yet.</div> : (
          <div className="space-y-2">
            {mine.map(r => (
              <div key={r.id} className="card">
                <div className="font-semibold text-brand-navy">{r.ev?.title ?? 'Event no longer available'}</div>
                {r.ev && <div className="text-sm text-slate-600">{eventCatLabel(r.ev.category)} &middot; {formatDateTime(r.ev.event_start)}{r.ev.venue ? ' · ' + r.ev.venue : ''}</div>}
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className={'rounded-full px-2 py-0.5 ' + (r.status === 'registered' ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600')}>
                    {r.status === 'registered' ? 'Registered' : 'Withdrawn'}
                  </span>
                  {r.status === 'registered' && (
                    <span className={'rounded-full px-2 py-0.5 ' + (r.att === 'present' ? 'bg-brand-greenLight text-brand-greenDark' : r.att ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600')}>
                      {r.att ? 'Attendance: ' + ATT[r.att] : 'Attendance not marked yet'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : events.length === 0 ? (
        <div className="card text-slate-500">{tab === 'upcoming' ? 'No upcoming events for your course right now.' : 'No past events.'}</div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => {
            const reg = regs[ev.id]
            const isReg = reg?.status === 'registered'
            const deadlinePassed = ev.registration_deadline && new Date(ev.registration_deadline) < new Date()
            const started = new Date(ev.event_start) < new Date()
            const canRegister = ev.status === 'published' && !deadlinePassed && !started && !isReg
            return (
              <div key={ev.id} className="card">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-brand-navy">{ev.title}</h2>
                  <span className="rounded-full bg-brand-greenLight px-2 py-0.5 text-xs font-semibold text-brand-greenDark">{eventCatLabel(ev.category)}</span>
                </div>
                <div className="mt-1 text-sm text-slate-700">{formatDateTime(ev.event_start)}{ev.event_end ? ' to ' + formatDateTime(ev.event_end) : ''}</div>
                {ev.venue && <div className="text-sm text-slate-600">Venue: {ev.venue}</div>}
                {ev.organiser && <div className="text-sm text-slate-600">Resource person: {ev.organiser}</div>}
                {ev.registration_deadline && <div className="text-sm text-slate-600">Register before: {formatDateTime(ev.registration_deadline)}</div>}
                {ev.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{ev.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isReg && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">You are registered</span>}
                  {canRegister && <button className="btn-green !py-1.5" disabled={busy === ev.id} onClick={() => register(ev)}>{reg ? 'Register again' : 'Register'}</button>}
                  {isReg && !started && <button className="btn-outline !py-1.5" disabled={busy === ev.id} onClick={() => withdraw(ev)}>Withdraw</button>}
                  {!isReg && !canRegister && tab === 'upcoming' && (
                    <span className="text-xs text-slate-500">{ev.status === 'closed' || deadlinePassed ? 'Registration closed' : 'Registration not available'}</span>
                  )}
                  {ev.attachment_path && <button className="btn-navy !py-1.5" onClick={() => open(ev.attachment_path)}>Open document</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
