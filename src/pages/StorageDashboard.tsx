import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/Layout'
import { STORAGE_LIMITS } from '../config'
import { openAttachment } from '../lib/content'

const MB = 1024 * 1024
const fmt = (b: number) => b >= 1024 * MB ? (b / 1024 / MB).toFixed(2) + ' GB' : b >= MB ? (b / MB).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB'

function Bar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100)
  const color = pct >= 90 ? 'bg-red-600' : pct >= 70 ? 'bg-amber-500' : 'bg-brand-green'
  return (
    <div className="card space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-brand-navy">{label}</h3>
        <span className="text-sm text-slate-600">{fmt(used)} of {fmt(limit)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className={'h-full ' + color} style={{ width: pct + '%' }} /></div>
      <div className="text-sm font-semibold">{pct.toFixed(1)}% used</div>
      {pct >= 90 && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">Almost full. Download an academic-year archive and clear old data soon.</div>}
      {pct >= 70 && pct < 90 && <div className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">Getting full. Plan to archive an old academic year.</div>}
    </div>
  )
}

export default function StorageDashboard() {
  const [sum, setSum] = useState<any>(null)
  const [years, setYears] = useState<any[]>([])
  const [big, setBig] = useState<any[]>([])
  const [registered, setRegistered] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.rpc('admin_storage_summary'),
      supabase.rpc('admin_year_summary'),
      supabase.from('uploaded_files').select('id, bucket, path, size_bytes, linked_table, created_at, academic_years(label)').order('size_bytes', { ascending: false }).limit(10),
      supabase.from('uploaded_files').select('*', { count: 'exact', head: true }),
    ]).then(([s, y, b, c]: any[]) => {
      const e = s.error ?? y.error ?? b.error
      if (e) setError(e.message)
      setSum(s.data); setYears(y.data ?? []); setBig(b.data ?? []); setRegistered(c.count ?? 0)
      setLoading(false)
    })
  }, [])

  if (loading) return <Spinner />
  const fileCount = Number(sum?.file_count ?? 0)
  const nice = (p: string) => p.split('/').pop() ?? p
  const what: Record<string, string> = { notices: 'Notice', placement_resources: 'Resource', events: 'Event', drives: 'Drive', companies: 'Company logo', offer_letters: 'Offer letter' }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin" className="text-sm text-brand-green">&larr; Dashboard</Link>
        <h1 className="text-2xl font-bold text-brand-navy">Storage dashboard</h1>
      </div>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {sum && <>
        <Bar label="Database" used={Number(sum.database_bytes)} limit={STORAGE_LIMITS.databaseMB * MB} />
        <Bar label="File storage" used={Number(sum.file_bytes)} limit={STORAGE_LIMITS.filesMB * MB} />
        <div className="card">
          <div className="text-sm text-slate-500">Uploaded files</div>
          <div className="text-2xl font-bold text-brand-navy">{fileCount}</div>
          {fileCount !== registered && (
            <p className="mt-1 text-sm text-amber-700">Storage holds {fileCount} file(s) but the portal has recorded {registered}. The difference may be files uploaded by hand in Supabase or left over from a failed upload.</p>
          )}
        </div>
      </>}

      <section className="card">
        <h2 className="mb-2 font-semibold text-brand-navy">By academic year</h2>
        {years.length === 0 ? <p className="text-sm text-slate-500">No academic years.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr><th className="p-2">Year</th><th className="p-2">Students</th><th className="p-2">Drives</th><th className="p-2">Events</th><th className="p-2">Files</th><th className="p-2">File size</th></tr>
              </thead>
              <tbody>
                {years.map(y => (
                  <tr key={y.id} className="border-t border-slate-100">
                    <td className="p-2 font-semibold">{y.label}</td><td className="p-2">{y.enrolments}</td>
                    <td className="p-2">{y.drives}</td><td className="p-2">{y.events}</td>
                    <td className="p-2">{y.files}</td><td className="p-2">{fmt(Number(y.file_bytes))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold text-brand-navy">Largest files</h2>
        {big.length === 0 ? <p className="text-sm text-slate-500">No files uploaded yet.</p> : (
          <ul className="divide-y divide-slate-100">
            {big.map(f => (
              <li key={f.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{nice(f.path)}</div>
                  <div className="text-xs text-slate-500">{what[f.linked_table] ?? f.linked_table}{(Array.isArray(f.academic_years) ? f.academic_years[0] : f.academic_years)?.label ? ' · ' + (Array.isArray(f.academic_years) ? f.academic_years[0] : f.academic_years).label : ''}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold">{fmt(f.size_bytes)}</span>
                  <button className="text-brand-green underline" onClick={() => openAttachment(f.path, f.bucket).catch((e: any) => setError(e.message))}>Open</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
        <p>The database size is an estimate and can look larger than the figure on Supabase's own Usage page. Use Supabase's page for the official number.</p>
        <p className="mt-1">Database size, file storage, bandwidth, logins and requests are separate limits. Deleting data does not reset them, and the numbers can take time to update after a deletion. The limits above are set in <code>src/config.ts</code>; check Supabase's pricing page now and then in case they change.</p>
      </div>
    </div>
  )
}
