import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function StudentDashboard() {
  const { student } = useAuth()
  if (!student) return null
  if (student.must_change_password) return <Navigate to="/change-password?first=1" replace />

  const soon = ['Latest notices', 'Upcoming events', 'Campus drives for my course', 'My registrations', 'My resume', 'Placement resources']

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

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {soon.map(t => (
          <div key={t} className="card">
            <h3 className="font-semibold text-brand-green">{t}</h3>
            <p className="mt-1 text-sm text-slate-500">Coming in the next phases.</p>
          </div>
        ))}
      </section>
    </div>
  )
}
