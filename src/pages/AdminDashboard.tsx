import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/Layout'

interface CourseCount { id: string; code: string; name: string; count: number }

export default function AdminDashboard() {
  const [total, setTotal] = useState<number | null>(null)
  const [active, setActive] = useState(0)
  const [byCourse, setByCourse] = useState<CourseCount[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [{ count: t }, { count: a }, { data: courses, error: ce }] = await Promise.all([
        supabase.from('student_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('student_profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('courses').select('id, code, name').order('code'),
      ])
      if (ce) { setError(ce.message); setTotal(0); return }
      const rows = await Promise.all((courses ?? []).map(async (c: any) => {
        const { count } = await supabase.from('student_profiles')
          .select('*', { count: 'exact', head: true }).eq('course_id', c.id)
        return { id: c.id, code: c.code, name: c.name, count: count ?? 0 }
      }))
      setTotal(t ?? 0); setActive(a ?? 0); setByCourse(rows)
    }
    load()
  }, [])

  if (total === null) return <Spinner />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-navy">Administrator dashboard</h1>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card"><div className="text-sm text-slate-500">Total students</div><div className="text-3xl font-bold text-brand-navy">{total}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Active</div><div className="text-3xl font-bold text-brand-green">{active}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Inactive</div><div className="text-3xl font-bold text-slate-600">{total - active}</div></div>
      </section>

      <section className="card">
        <h2 className="font-semibold text-brand-navy">Students by course</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {byCourse.map(c => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span><b>{c.code}</b> <span className="text-slate-500">{c.name}</span></span>
              <span className="font-semibold">{c.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {['Student directory and CSV import', 'Recruitment drives', 'Events and attendance', 'Notices and resources', 'Academic year archive', 'Storage dashboard'].map(t => (
          <div key={t} className="card">
            <h3 className="font-semibold text-brand-green">{t}</h3>
            <p className="mt-1 text-sm text-slate-500">Coming in the next phases.</p>
          </div>
        ))}
      </section>
      <Link to="/change-password" className="btn-outline">Change my password</Link>
    </div>
  )
}
