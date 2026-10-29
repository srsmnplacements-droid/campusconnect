import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, configMissing } from '../lib/supabase'
import { COLLEGE_NAME } from '../config'
import { Spinner } from '../components/Layout'
import { catLabel, eventCatLabel, formatDate, formatDateTime, isHttpUrl, startOfToday } from '../lib/content'

interface Notice { id: string; title: string; body: string | null; category: string; published_at: string | null }
interface Resource { id: string; title: string; description: string | null; category: string; external_link: string | null }

export default function Home() {
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [drives, setDrives] = useState<any[]>([])

  useEffect(() => {
    if (configMissing) { setNotices([]); return }
    supabase.from('notices')
      .select('id, title, body, category, published_at')
      .eq('status', 'published').eq('is_public', true)
      .order('published_at', { ascending: false }).limit(5)
      .then(({ data }) => setNotices((data as Notice[]) ?? []))
    supabase.from('placement_resources')
      .select('id, title, description, category, external_link')
      .eq('status', 'published').eq('is_public', true)
      .order('created_at', { ascending: false }).limit(6)
      .then(({ data }) => setResources((data as Resource[]) ?? []))
    supabase.from('events')
      .select('id, title, category, event_start, venue, organiser')
      .eq('status', 'published').eq('is_public', true).gte('event_start', startOfToday())
      .order('event_start', { ascending: true }).limit(4)
      .then(({ data }) => setEvents(data ?? []))
    supabase.from('campus_drives')
      .select('id, job_title, application_deadline, drive_date, venue, job_location, companies(name)')
      .eq('status', 'published').eq('is_public', true)
      .order('created_at', { ascending: false }).limit(4)
      .then(({ data }) => setDrives(data ?? []))
  }, [])

  return (
    <div className="space-y-6">
      {configMissing && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          The website is not connected to Supabase yet. Add the two GitHub variables (see setup guide).
        </div>
      )}

      <section className="rounded-2xl bg-gradient-to-br from-brand-navy to-brand-green p-6 text-white sm:p-10">
        <p className="text-sm uppercase tracking-wide text-green-100">Placement Cell</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-4xl">Welcome to CampusConnect</h1>
        <p className="mt-3 max-w-2xl text-green-50">
          The placement hub of {COLLEGE_NAME}. Find campus drives, join training programmes and
          workshops, build your resume and get ready for your career.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/login" className="btn bg-white text-brand-navy hover:bg-slate-100">Student login</Link>
          <Link to="/login?as=admin" className="btn border border-white/60 text-white hover:bg-white/10">Administrator login</Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-navy">Latest announcements</h2>
        {notices === null ? <Spinner /> : notices.length === 0 ? (
          <div className="card text-slate-500">No public announcements yet.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {notices.map(n => (
              <div key={n.id} className="card">
                <h3 className="font-semibold text-brand-navy">{n.title}</h3>
                <p className="text-xs text-slate-500">
                  {catLabel('notices', n.category)}{n.published_at ? ' · ' + formatDate(n.published_at) : ''}
                </p>
                {n.body && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{n.body.length > 200 ? n.body.slice(0, 200) + '...' : n.body}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {drives.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold text-brand-navy">Upcoming campus drives</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {drives.map(d => (
              <div key={d.id} className="card">
                <h3 className="font-semibold text-brand-navy">{(Array.isArray(d.companies) ? d.companies[0] : d.companies)?.name}</h3>
                <p className="text-sm text-slate-700">{d.job_title}</p>
                {d.job_location && <p className="text-sm text-slate-600">Location: {d.job_location}</p>}
                {d.application_deadline && <p className="text-sm text-slate-600">Apply before: {formatDateTime(d.application_deadline)}</p>}
                {d.drive_date && <p className="text-sm text-slate-600">Drive: {formatDateTime(d.drive_date)}{d.venue ? ' · ' + d.venue : ''}</p>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Log in as a student to check eligibility and register.</p>
        </section>
      )}

      {events.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold text-brand-navy">Upcoming events and workshops</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {events.map(ev => (
              <div key={ev.id} className="card">
                <h3 className="font-semibold text-brand-navy">{ev.title}</h3>
                <p className="text-xs text-slate-500">{eventCatLabel(ev.category)}</p>
                <p className="mt-1 text-sm text-slate-700">{formatDateTime(ev.event_start)}</p>
                {ev.venue && <p className="text-sm text-slate-600">Venue: {ev.venue}</p>}
                {ev.organiser && <p className="text-sm text-slate-600">Resource person: {ev.organiser}</p>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Log in as a student to register.</p>
        </section>
      )}

      {resources.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold text-brand-navy">Placement resources</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {resources.map(r => (
              <div key={r.id} className="card">
                <h3 className="font-semibold text-brand-navy">{r.title}</h3>
                <p className="text-xs text-slate-500">{catLabel('placement_resources', r.category)}</p>
                {r.description && <p className="mt-2 text-sm text-slate-600">{r.description.length > 160 ? r.description.slice(0, 160) + '...' : r.description}</p>}
                {r.external_link && isHttpUrl(r.external_link) && (
                  <a className="mt-2 inline-block text-sm font-semibold text-brand-green underline" href={r.external_link} target="_blank" rel="noopener noreferrer">Open link</a>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Log in as a student to see all resources and downloads.</p>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ['Campus drives', 'Company recruitment drives for your course. Register after student login.'],
          ['Training and events', 'Workshops, aptitude training and interview preparation. Register after student login.'],
          ['Resume builder', 'Students can create a professional resume and download it as PDF.'],
        ].map(([t, d]) => (
          <div key={t} className="card">
            <h3 className="font-semibold text-brand-green">{t}</h3>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
