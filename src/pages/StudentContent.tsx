import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/Layout'
import { CONTENT, Kind, catLabel, formatDate, isHttpUrl, openAttachment } from '../lib/content'

const SIZE = 20

export default function StudentContent({ kind }: { kind: Kind }) {
  const cfg = CONTENT[kind]
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [dq, setDq] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDq(search), 300)
    return () => clearTimeout(t)
  }, [search])

  function build() {
    let q: any = supabase.from(kind).select('*', { count: 'exact' })
      .eq('status', 'published').order('published_at', { ascending: false, nullsFirst: false })
    if (category) q = q.eq('category', category)
    const t = dq.replace(/[%,()]/g, ' ').trim()
    if (t) q = q.ilike('title', '%' + t + '%')
    return q
  }

  useEffect(() => {
    setLoading(true)
    build().range(0, SIZE - 1).then(({ data, count, error: e }: any) => {
      setError(e ? e.message : '')
      setRows(data ?? [])
      setTotal(count ?? 0)
      setLoading(false)
    })
  }, [kind, category, dq])

  async function more() {
    setLoadingMore(true)
    const { data, error: e } = await build().range(rows.length, rows.length + SIZE - 1)
    if (e) setError(e.message); else setRows(r => [...r, ...(data ?? [])])
    setLoadingMore(false)
  }

  async function open(path: string) {
    try { await openAttachment(path) } catch (ex: any) { setError(ex.message) }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/student" className="text-sm text-brand-green">&larr; My dashboard</Link>
        <h1 className="text-2xl font-bold text-brand-navy">{cfg.heading}</h1>
      </div>

      <div className="card grid gap-2 sm:grid-cols-2">
        <input className="input" placeholder="Search by title" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {cfg.categories.map(c => <option key={c[0]} value={c[0]}>{c[1]}</option>)}
        </select>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? <Spinner /> : rows.length === 0 ? (
        <div className="card text-slate-500">Nothing to show yet. Please check again later.</div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const text: string | null = r[cfg.bodyField]
            return (
              <div key={r.id} className="card">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-brand-navy">{r.title}</h2>
                  <span className="rounded-full bg-brand-greenLight px-2 py-0.5 text-xs font-semibold text-brand-greenDark">{catLabel(kind, r.category)}</span>
                </div>
                {r.published_at && <div className="text-xs text-slate-500">{formatDate(r.published_at)}</div>}
                {text && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{text}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.attachment_path && <button className="btn-navy !py-1.5" onClick={() => open(r.attachment_path)}>Open attachment</button>}
                  {r.external_link && isHttpUrl(r.external_link) && (
                    <a className="btn-outline !py-1.5" href={r.external_link} target="_blank" rel="noopener noreferrer">Open link</a>
                  )}
                </div>
              </div>
            )
          })}
          {rows.length < total && (
            <button className="btn-outline w-full" disabled={loadingMore} onClick={more}>
              {loadingMore ? 'Loading...' : 'Show more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
