import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { Spinner } from '../components/Layout'

const LABEL = /^(\d{4})-(\d{2})$/

function nextLabel(labels: string[]): string {
  const years = labels.map(l => Number(l.slice(0, 4))).filter(Boolean)
  const y = years.length ? Math.max(...years) + 1 : new Date().getFullYear()
  return y + '-' + String((y + 1) % 100).padStart(2, '0')
}

export default function YearsAdmin() {
  const [rows, setRows] = useState<any[]>([])
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<any | null | undefined>(undefined)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('academic_years').select('*').order('label', { ascending: false }),
      supabase.rpc('admin_year_summary'),
    ]).then(([y, s]: any[]) => {
      if (y.error) setError(y.error.message)
      if (s.error) setError(s.error.message)
      setRows(y.data ?? [])
      const m: Record<string, any> = {}
      ;(s.data ?? []).forEach((x: any) => { m[x.id] = x })
      setSummary(m)
      setLoading(false)
    })
  }, [reload])

  async function makeCurrent(r: any) {
    if (!window.confirm('Make ' + r.label + ' the current academic year? New records and filters will default to it.')) return
    setBusy(r.id); setError(''); setNotice('')
    const { error: e } = await supabase.rpc('set_current_academic_year', { p_id: r.id })
    setBusy('')
    if (e) setError(e.message); else { setNotice(r.label + ' is now the current academic year.'); setReload(n => n + 1) }
  }

  const total = (s: any) => s ? (s.enrolments + s.drives + s.drive_registrations + s.events + s.event_registrations + s.notices + s.resources + s.results + s.files) : 0

  async function remove(r: any) {
    if (r.is_current) { setError('The current year cannot be deleted.'); return }
    if (total(summary[r.id]) > 0) { setError(r.label + ' still has records. Years with records are removed later through the Academic year archive.'); return }
    if (!window.confirm('Delete the empty academic year ' + r.label + '?')) return
    setBusy(r.id); setError(''); setNotice('')
    const { error: e } = await supabase.from('academic_years').delete().eq('id', r.id)
    setBusy('')
    if (e) setError(e.message); else { setNotice(r.label + ' was deleted.'); setReload(n => n + 1) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to="/admin" className="text-sm text-brand-green">&larr; Dashboard</Link>
          <h1 className="text-2xl font-bold text-brand-navy">Academic years</h1>
        </div>
        <button className="btn-green" onClick={() => setEditing(null)}>+ Add academic year</button>
      </div>

      {notice && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</div>}
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? <Spinner /> : rows.length === 0 ? <div className="card text-slate-500">No academic years yet.</div> : (
        <div className="space-y-2">
          {rows.map(r => {
            const s = summary[r.id]
            return (
              <div key={r.id} className="card space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold text-brand-navy">{r.label}</span>
                  {r.is_current && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">current</span>}
                </div>
                <div className="text-sm text-slate-600">
                  {r.start_date ? new Date(r.start_date).toLocaleDateString('en-IN') : '?'} to {r.end_date ? new Date(r.end_date).toLocaleDateString('en-IN') : '?'}
                </div>
                {s && (
                  <div className="text-xs text-slate-500">
                    {s.enrolments} enrolments · {s.drives} drives ({s.drive_registrations} registrations) · {s.events} events ({s.event_registrations} registrations) · {s.notices} notices · {s.resources} resources · {s.results} results · {s.files} files
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {!r.is_current && <button className="btn-green !py-1.5" disabled={busy === r.id} onClick={() => makeCurrent(r)}>Make current</button>}
                  <button className="btn-outline !py-1.5" onClick={() => setEditing(r)}>Edit dates</button>
                  <button className="btn !py-1.5 border border-red-300 bg-white text-red-700 hover:bg-red-50" disabled={busy === r.id} onClick={() => remove(r)}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing !== undefined && (
        <YearEditor row={editing} labels={rows.map(r => r.label)} onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); setReload(n => n + 1) }} />
      )}
    </div>
  )
}

function YearEditor({ row, labels, onClose, onSaved }: { row: any | null; labels: string[]; onClose: () => void; onSaved: () => void }) {
  const suggested = nextLabel(labels)
  const startYear = (l: string) => Number(l.slice(0, 4))
  const [label, setLabel] = useState(row?.label ?? suggested)
  const [start, setStart] = useState(row?.start_date ?? startYear(suggested) + '-06-01')
  const [end, setEnd] = useState(row?.end_date ?? (startYear(suggested) + 1) + '-05-31')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  function changeLabel(v: string) {
    setLabel(v)
    if (!row && LABEL.test(v)) { setStart(startYear(v) + '-06-01'); setEnd((startYear(v) + 1) + '-05-31') }
  }

  async function save(e: FormEvent) {
    e.preventDefault(); setErr('')
    const l = label.trim()
    const m = LABEL.exec(l)
    if (!row) {
      if (!m) { setErr('Use the format 2027-28.'); return }
      if ((Number(m[1]) + 1) % 100 !== Number(m[2])) { setErr('The second part must be the next year, for example 2027-28.'); return }
      if (labels.includes(l)) { setErr('This academic year already exists.'); return }
    }
    if (start && end && new Date(end) <= new Date(start)) { setErr('The end date must be after the start date.'); return }
    setBusy(true)
    const payload: any = { start_date: start || null, end_date: end || null }
    const { error } = row
      ? await supabase.from('academic_years').update(payload).eq('id', row.id)
      : await supabase.from('academic_years').insert({ label: l, ...payload, is_current: false })
    setBusy(false)
    if (error) { setErr(error.message); return }
    onSaved()
  }

  return (
    <Modal title={row ? 'Edit ' + row.label : 'Add academic year'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Academic year</label>
          <input className="input" value={label} onChange={e => changeLabel(e.target.value)} disabled={!!row} maxLength={7} placeholder="2027-28" />
          {row && <p className="mt-1 text-xs text-slate-500">The name cannot be changed because archives use it.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-sm font-medium">Starts</label>
            <input className="input" type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm font-medium">Ends</label>
            <input className="input" type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
        </div>
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <button className="btn-green w-full" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
      </form>
    </Modal>
  )
}
