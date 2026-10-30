import { createPortal } from 'react-dom'
import { COLLEGE_NAME } from '../config'

export interface ReportProps {
  title: string
  meta?: string[]
  columns: { label: string; width?: string }[]
  rows: (string | number)[][]
  summary?: string[]
  signatures?: string[]
}

// Opens the print window (choose "Save as PDF"). The file name comes from the page title.
export function printReport(fileTitle: string) {
  const old = document.title
  document.title = fileTitle
  window.addEventListener('afterprint', () => { document.title = old }, { once: true })
  window.print()
}

// A clean A4 table report, drawn into #print-root (only visible when printing).
export default function ReportPrint({ title, meta = [], columns, rows, summary = [], signatures = [] }: ReportProps) {
  const root = document.getElementById('print-root')
  if (!root) return null
  const cell = { border: '1px solid #9ca3af', padding: '3px 5px', verticalAlign: 'top' as const }
  return createPortal(
    <div style={{ width: '210mm', boxSizing: 'border-box', padding: '12mm 12mm 14mm', background: '#fff', color: '#111', fontFamily: 'Calibri, Carlito, Arial, Helvetica, sans-serif', fontSize: '11.5px', lineHeight: 1.35 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', borderBottom: '2px solid #111', paddingBottom: '6px' }}>
        <img src={import.meta.env.BASE_URL + 'logo.png'} alt="" style={{ height: '17mm', width: '17mm', objectFit: 'contain' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>{COLLEGE_NAME}, Barkur</div>
          <div style={{ fontSize: '12px' }}>Placement Cell</div>
        </div>
      </div>
      <h1 style={{ margin: '10px 0 4px', fontSize: '16px' }}>{title}</h1>
      {meta.map((m, i) => <div key={i} style={{ fontSize: '11.5px' }}>{m}</div>)}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
        <thead style={{ display: 'table-header-group' }}>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{ ...cell, background: '#e5e7eb', textAlign: 'left', width: c.width }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={columns.length} style={{ ...cell, textAlign: 'center' }}>No records</td></tr>}
          {rows.map((r, i) => (
            <tr key={i} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              {r.map((v, k) => <td key={k} style={{ ...cell, height: '17px' }}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {summary.length > 0 && (
        <div style={{ marginTop: '8px', fontWeight: 700, breakInside: 'avoid' }}>{summary.join('   |   ')}</div>
      )}
      <div style={{ marginTop: signatures.length ? '26px' : '10px', display: 'flex', justifyContent: 'space-between', gap: '20px', breakInside: 'avoid' }}>
        {signatures.map((s, i) => (
          <div key={i} style={{ borderTop: '1px solid #111', paddingTop: '3px', minWidth: '45mm', textAlign: 'center' }}>{s}</div>
        ))}
      </div>
      <div style={{ marginTop: '10px', fontSize: '10px', color: '#555' }}>Generated from CampusConnect on {new Date().toLocaleString('en-IN')}</div>
    </div>,
    root,
  )
}
