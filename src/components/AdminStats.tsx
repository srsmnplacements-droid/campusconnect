import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DAY = 86400000

export default function AdminStats() {
  const [s, setS] = useState<any>(null)
  let last = ''
  try { last = localStorage.getItem('cc-last-backup') ?? '' } catch { /* ignore */ }
  const daysSince = last ? Math.floor((Date.now() - new Date(last).getTime()) / DAY) : null

  useEffect(() => {
    (async () => {
      const { data: y } = await supabase.from('academic_years').select('id, label').eq('is_current', true).maybeSingle()
      if (!y) { setS({ none: true }); return }
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const n = (q: any) => q.then((r: any) => r.count ?? 0)
      const head = { count: 'exact' as const, head: true }
      const [drives, apps, selected, events, eventRegs, offers, notices, emails] = await Promise.all([
        n(supabase.from('campus_drives').select('*', head).eq('academic_year_id', y.id).eq('status', 'published')),
        n(supabase.from('drive_registrations').select('*', head).eq('academic_year_id', y.id).neq('status', 'withdrawn')),
        n(supabase.from('placement_results').select('*', head).eq('academic_year_id', y.id)),
        n(supabase.from('events').select('*', head).eq('academic_year_id', y.id).eq('status', 'published').gte('event_start', today.toISOString())),
        n(supabase.from('event_registrations').select('*', head).eq('academic_year_id', y.id).eq('status', 'registered')),
        n(supabase.from('offer_letters').select('*', head).eq('academic_year_id', y.id)),
        n(supabase.from('notices').select('*', head).eq('academic_year_id', y.id).eq('status', 'published')),
        n(supabase.from('student_profiles').select('*', head).eq('status', 'active').not('email', 'is', null)),
      ])
      setS({ year: y.label, drives, apps, selected, events, eventRegs, offers, notices, emails })
    })()
  }, [])

  const Box = ({ label, v }: { label: string; v: number }) => (
    <div className="card !p-3"><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-bold text-brand-navy">{v}</div></div>
  )

  return (
    <div className="space-y-3">
      {(daysSince === null || daysSince >= 330) && (
        <Link to="/admin/backup" className="block rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <b>Yearly backup due.</b> {daysSince === null ? 'No backup has been made on this device yet.' : 'The last backup on this device was ' + daysSince + ' days ago.'} Tap here to make one.
        </Link>
      )}
      {s && !s.none && (
        <section>
          <h2 className="mb-2 font-semibold text-brand-navy">Placement activity, {s.year}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Box label="Open drives" v={s.drives} />
            <Box label="Applications" v={s.apps} />
            <Box label="Students selected" v={s.selected} />
            <Box label="Offer letters" v={s.offers} />
            <Box label="Upcoming events" v={s.events} />
            <Box label="Event registrations" v={s.eventRegs} />
            <Box label="Published notices" v={s.notices} />
            <Box label="Students with email" v={s.emails} />
          </div>
        </section>
      )}
      {s?.none && <div className="card text-sm text-slate-600">No current academic year is set. Choose one under Academic years.</div>}
    </div>
  )
}
