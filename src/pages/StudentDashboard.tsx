import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { catLabel, formatDate } from '../lib/content'

export default function StudentDashboard() {
  const { student } = useAuth()
  const [latest, setLatest] = useState<any[] | null>(null)

  useEffect(() => {
    supabase.from('notices').select('id, title, category, published_at')
      .eq('status', 'published').order('published_at', { ascending: false, nullsFirst: false }).limit(3)
      .then(({ data }) => setLatest(data ?? []))
  }, [])

  if (!student) return null
  if (student.must_change_password) return <Navigate to="/change-password?first=1" replace />

  const soon = ['Upcoming events', 'Campus drives for my course', 'My registrations']

  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="text-2xl font-bold text-brand-navy">Hello, {student.full_name}</h1>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-500">Register number</dt><dd className="font-semibold">{student.register_no}</dd></div>
          <div><dt className="text-slate-500">Course</dt><dd className="font-semibold">{student.course_code} - {student.course_name}</dd></div>
          <div><dt className="text-slate-500">Profile</dt><dd className="font-semibold">{student.profile_completed ? 'Complete' : 'Incomplete'}</dd></div>
        </dl>
        <Link to="/change-password" className="btn-outline mt-4">Change password</Link>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-navy">Latest notices</h2>
          <Link to="/student/notices" className="text-sm font-semibold text-brand-green">View all</Link>
        </div>
        {latest === null ? <div className="card text-slate-500">Loading...</div> : latest.length === 0 ? (
          <div className="card text-slate-500">No notices yet.</div>
        ) : (
          <div className="space-y-2">
            {latest.map(n => (
              <Link key={n.id} to="/student/notices" className="card block hover:bg-slate-50">
                <div className="font-semibold text-brand-navy">{n.title}</div>
                <div className="text-xs text-slate-500">{catLabel('notices', n.category)}{n.published_at ? ' · ' + formatDate(n.published_at) : ''}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/student/notices" className="card border-brand-green hover:bg-brand-greenLight">
          <h3 className="font-semibold text-brand-green">Notices</h3>
          <p className="mt-1 text-sm text-slate-600">All placement notices and announcements.</p>
        </Link>
        <Link to="/student/resources" className="card border-brand-green hover:bg-brand-greenLight">
          <h3 className="font-semibold text-brand-green">Placement resources</h3>
          <p className="mt-1 text-sm text-slate-600">Resume guides, aptitude practice, interview tips.</p>
        </Link>
        <Link to="/student/resume" className="card border-brand-green hover:bg-brand-greenLight">
          <h3 className="font-semibold text-brand-green">My resume</h3>
          <p className="mt-1 text-sm text-slate-600">Build a professional resume and download it as PDF.</p>
        </Link>
        {soon.map(t => (
          <div key={t} className="card">
            <h3 className="font-semibold text-slate-500">{t}</h3>
            <p className="mt-1 text-sm text-slate-500">Coming soon.</p>
          </div>
        ))}
      </section>
    </div>
  )
}
