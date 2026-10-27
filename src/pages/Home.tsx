import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, configMissing } from '../lib/supabase'
import { COLLEGE_NAME } from '../config'
import { Spinner } from '../components/Layout'

interface Notice { id: string; title: string; body: string | null; published_at: string | null }

export default function Home() {
  const [notices, setNotices] = useState<Notice[] | null>(null)

  useEffect(() => {
    if (configMissing) { setNotices([]); return }
    supabase.from('notices')
      .select('id, title, body, published_at')
      .eq('status', 'published').eq('is_public', true)
      .order('published_at', { ascending: false }).limit(5)
      .then(({ data }) => setNotices((data as Notice[]) ?? []))
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
                {n.published_at && (
                  <p className="text-xs text-slate-500">{new Date(n.published_at).toLocaleDateString('en-IN')}</p>
                )}
                {n.body && <p className="mt-2 text-sm text-slate-600">{n.body.slice(0, 160)}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ['Campus drives', 'Company recruitment drives for your course (coming soon).'],
          ['Training and events', 'Workshops, aptitude training and interview preparation (coming soon).'],
          ['Resume builder', 'Create a professional resume and download it as PDF (coming soon).'],
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
