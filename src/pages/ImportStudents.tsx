import { ChangeEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import Papa from 'papaparse'
import { callAdmin, RowResult } from '../lib/api'
import { downloadCsv } from '../lib/csv'

const HEADERS = ['register_no', 'full_name', 'course', 'semester', 'batch', 'academic_year', 'email', 'phone']
const REQUIRED = ['register_no', 'full_name', 'course', 'semester']
const MAX_ROWS = 500

function downloadTemplate() {
  downloadCsv('CampusConnect_student_template.csv', HEADERS, [
    ['U12345', 'Sample Student One', 'BCOM', '3', '2024-27', '2026-27', 'sample1@example.com', '9876543210'],
    ['U12346', 'Sample Student Two', 'MSW', '1', '2026-28', '2026-27', '', ''],
  ])
}

type Item = { row: number; data: Record<string, string>; result?: RowResult }

export default function ImportStudents() {
  const [items, setItems] = useState<Item[]>([])
  const [fileName, setFileName] = useState('')
  const [stage, setStage] = useState<'choose' | 'preview' | 'importing' | 'done'>('choose')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg(''); setFileName(file.name)
    if (!file.name.toLowerCase().endsWith('.csv')) { setMsg('Please choose a .csv file.'); return }
    if (file.size > 1_000_000) { setMsg('File is too large (maximum 1 MB).'); return }
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase().replace(/^\ufeff/, ''),
      complete: async res => {
        const cols = res.meta.fields ?? []
        const missing = REQUIRED.filter(c => !cols.includes(c))
        if (missing.length) { setMsg('Missing column(s): ' + missing.join(', ') + '. Use the template.'); return }
        if (res.data.length === 0) { setMsg('The file has no student rows.'); return }
        if (res.data.length > MAX_ROWS) { setMsg('Too many rows. Maximum is ' + MAX_ROWS + ' per file.'); return }
        const list: Item[] = res.data.map((r, i) => {
          const d: Record<string, string> = {}
          HEADERS.forEach(h => { d[h] = String(r[h] ?? '').trim() })
          return { row: i + 2, data: d }
        })
        await validate(list)
      },
      error: err => setMsg('Could not read the file: ' + err.message),
    })
  }

  async function validate(list: Item[]) {
    setBusy(true); setMsg('Checking rows...')
    try {
      const out: Item[] = []
      for (let i = 0; i < list.length; i += 200) {
        const chunk = list.slice(i, i + 200)
        const r = await callAdmin<{ results: RowResult[] }>({ action: 'create_students', dry_run: true, rows: chunk.map(c => c.data) })
        chunk.forEach((c, k) => out.push({ ...c, result: r.results[k] }))
      }
      // catch duplicates spread across chunks
      const seen = new Set<string>()
      out.forEach(o => {
        const key = o.data.register_no.trim().toUpperCase()
        if (o.result?.status === 'ok') {
          if (seen.has(key)) o.result = { ...o.result, status: 'duplicate', message: 'Repeated in this file' }
          seen.add(key)
        }
      })
      setItems(out); setStage('preview'); setMsg('')
    } catch (e: any) { setMsg(e.message) }
    setBusy(false)
  }

  async function runImport() {
    const ok = items.filter(i => i.result?.status === 'ok')
    if (!ok.length) return
    setStage('importing'); setBusy(true)
    const updated = new Map<number, RowResult>()
    for (let i = 0; i < ok.length; i += 40) {
      const chunk = ok.slice(i, i + 40)
      setProgress('Importing ' + Math.min(i + 40, ok.length) + ' of ' + ok.length + '...')
      try {
        const r = await callAdmin<{ results: RowResult[] }>({ action: 'create_students', rows: chunk.map(c => c.data) })
        chunk.forEach((c, k) => updated.set(c.row, r.results[k]))
      } catch (e: any) {
        chunk.forEach(c => updated.set(c.row, { register_no: c.data.register_no, status: 'failed', message: 'Connection problem. Check the Student directory before trying again.' }))
      }
    }
    setItems(prev => prev.map(i => updated.has(i.row) ? { ...i, result: updated.get(i.row) } : i))
    setBusy(false); setStage('done'); setProgress('')
  }

  const count = (s: string) => items.filter(i => i.result?.status === s).length
  const created = items.filter(i => i.result?.status === 'created')

  function downloadLogins() {
    downloadCsv('CampusConnect_login_details_KEEP_PRIVATE.csv',
      ['register_no', 'full_name', 'temporary_password'],
      created.map(i => [i.result!.register_no, i.data.full_name, i.result!.temp_password ?? '']))
  }
  function downloadReport() {
    downloadCsv('CampusConnect_import_report.csv',
      ['row', 'register_no', 'full_name', 'status', 'message'],
      items.map(i => [i.row, i.data.register_no, i.data.full_name, i.result?.status ?? '', i.result?.message ?? '']))
  }
  const badge = (s?: string) => ({
    ok: 'bg-green-100 text-green-800', created: 'bg-green-100 text-green-800',
    duplicate: 'bg-amber-100 text-amber-800', invalid: 'bg-red-100 text-red-700', failed: 'bg-red-100 text-red-700',
  } as Record<string, string>)[s ?? ''] ?? 'bg-slate-100'

  return (
    <div className="space-y-4">
      <Link to="/admin/students" className="text-sm text-brand-green">&larr; Student directory</Link>
      <h1 className="text-2xl font-bold text-brand-navy">Import students from CSV</h1>

      {stage === 'choose' && (
        <div className="card space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Download the template and fill in your students.</li>
            <li>Course must be one of: BCOM, BBA, BA, BSC, BCA, BSW, MSW.</li>
            <li>Choose the file. You will see a preview before anything is saved.</li>
          </ol>
          <button className="btn-outline" onClick={downloadTemplate}>Download CSV template</button>
          <div>
            <label className="mb-1 block text-sm font-medium">Choose your CSV file</label>
            <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} className="block w-full text-sm" />
            {fileName && <p className="mt-1 text-xs text-slate-500">{fileName}</p>}
          </div>
        </div>
      )}

      {msg && <div className={'rounded-lg p-3 text-sm ' + (busy ? 'bg-slate-100 text-slate-700' : 'bg-red-50 text-red-700')}>{msg}</div>}

      {stage !== 'choose' && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Total rows" v={items.length} />
            <Stat label={stage === 'done' ? 'Created' : 'Ready'} v={stage === 'done' ? count('created') : count('ok')} cls="text-brand-green" />
            <Stat label="Duplicates" v={count('duplicate')} cls="text-amber-600" />
            <Stat label={stage === 'done' ? 'Invalid / failed' : 'Invalid'} v={count('invalid') + count('failed')} cls="text-red-600" />
          </div>

          {stage === 'preview' && (
            <div className="flex flex-wrap gap-2">
              <button className="btn-green" disabled={count('ok') === 0 || busy} onClick={runImport}>
                Import {count('ok')} student{count('ok') === 1 ? '' : 's'}
              </button>
              <button className="btn-outline" onClick={() => { setStage('choose'); setItems([]); setFileName('') }}>Choose another file</button>
            </div>
          )}
          {stage === 'importing' && <div className="card">{progress} Please keep this page open.</div>}
          {stage === 'done' && (
            <div className="card space-y-3">
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                <b>Download the login details now.</b> Temporary passwords are shown only once and are not saved anywhere.
                Keep the file private. If you lose it, use "Reset password" in the Student directory.
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-green" disabled={created.length === 0} onClick={downloadLogins}>Download login details</button>
                <button className="btn-outline" onClick={downloadReport}>Download import report</button>
                <Link to="/admin/students" className="btn-navy">Go to directory</Link>
              </div>
            </div>
          )}

          <div className="card overflow-x-auto !p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr><th className="p-2">Row</th><th className="p-2">Reg no</th><th className="p-2">Name</th><th className="p-2">Course</th><th className="p-2">Result</th></tr>
              </thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.row} className="border-t border-slate-100">
                    <td className="p-2">{i.row}</td>
                    <td className="p-2 font-mono">{i.data.register_no}</td>
                    <td className="p-2">{i.data.full_name}</td>
                    <td className="p-2">{i.data.course}</td>
                    <td className="p-2">
                      <span className={'rounded-full px-2 py-0.5 text-xs font-semibold ' + badge(i.result?.status)}>{i.result?.status}</span>
                      <div className="text-xs text-slate-500">{i.result?.message}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, v, cls = 'text-brand-navy' }: { label: string; v: number; cls?: string }) {
  return <div className="card !p-3"><div className="text-xs text-slate-500">{label}</div><div className={'text-2xl font-bold ' + cls}>{v}</div></div>
}
