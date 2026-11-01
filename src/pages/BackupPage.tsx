import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buildBackup, BackupResult } from '../lib/backup'

const MB = 1024 * 1024
const fmt = (b: number) => b >= MB ? (b / MB).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB'
export const BACKUP_KEY = 'cc-last-backup'

export default function BackupPage() {
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [res, setRes] = useState<BackupResult | null>(null)
  let last = ''
  try { last = localStorage.getItem(BACKUP_KEY) ?? '' } catch { /* ignore */ }

  async function run() {
    setErr(''); setRes(null); setBusy(true); setPct(1)
    try {
      const r = await buildBackup((p, m) => { setPct(p); setMsg(m) })
      setRes(r)
      try { localStorage.setItem(BACKUP_KEY, new Date().toISOString()) } catch { /* ignore */ }
    } catch (e: any) { setErr('The backup could not be completed: ' + e.message); setPct(0) }
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin" className="text-sm text-brand-green">&larr; Dashboard</Link>
        <h1 className="text-2xl font-bold text-brand-navy">Backup everything</h1>
        <p className="text-sm text-slate-600">The free Supabase plan does not make automatic backups, so please do this once a year (June or July, before the new academic year) and also before you delete any academic year's data.</p>
      </div>

      <section className="card space-y-3">
        <div className="text-sm text-slate-700">
          <p>One ZIP file with <b>all your data</b> (students, courses, years, drives, applications, events, attendance, notices, resources, results, resumes, offer-letter records and activity history) and <b>every uploaded file</b>.</p>
          <p className="mt-2">Nothing is deleted. It is built in your browser, so use a <b>laptop</b> and keep this page open. Big backups are split into several parts.</p>
        </div>
        {last && <div className="rounded-lg bg-slate-50 p-3 text-sm">Last backup made on this device: <b>{new Date(last).toLocaleString('en-IN')}</b></div>}
        <button className="btn-green" disabled={busy} onClick={run}>{busy ? 'Working... keep this page open' : 'Create backup ZIP'}</button>
        {(busy || pct > 0) && (
          <div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-green" style={{ width: pct + '%' }} /></div>
            <div className="mt-1 text-xs text-slate-600">{msg} {pct}%</div>
          </div>
        )}
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      </section>

      {res && (
        <section className="card space-y-2">
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-900">
            <b>Backup created and checked.</b> It was saved to your downloads folder:
            <ul className="mt-1 list-disc pl-5">{res.parts.map(p => <li key={p.name}>{p.name} ({fmt(p.bytes)})</li>)}</ul>
            <div className="mt-1">{res.fileCount} uploaded file(s) included.</div>
          </div>
          {res.missing.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <b>{res.missing.length} file(s) could not be downloaded</b> (they are listed in the database but missing in storage):
              <ul className="mt-1 list-disc pl-5">{res.missing.slice(0, 10).map(m => <li key={m} className="break-all">{m}</li>)}</ul>
              {res.missing.length > 10 && <div>...and {res.missing.length - 10} more.</div>}
            </div>
          )}
          <details className="text-sm"><summary className="cursor-pointer font-semibold text-brand-green">Records in each table</summary>
            <ul className="mt-1 columns-2 text-xs text-slate-600">{res.tables.map(t => <li key={t.name}>{t.name.replace(/_/g, ' ')}: {t.rows}</li>)}</ul>
          </details>
        </section>
      )}

      <section className="card space-y-2 text-sm text-slate-700">
        <h2 className="font-semibold text-brand-navy">After the download</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Open the ZIP once and look at the README and a few CSV files.</li>
          <li>Copy it to a <b>pen drive</b> or another safe place. A backup that stays only on this laptop is not safe.</li>
          <li>The ZIP holds personal data. Keep it private and never upload it to public websites.</li>
          <li>Passwords are not in the backup. Students keep their logins in Supabase. If you ever need to start again, use <b>Reset password</b> to give new temporary passwords.</li>
          <li>This is a safety copy for rebuilding or checking records. It is not a one-click restore button.</li>
        </ul>
      </section>
    </div>
  )
}
