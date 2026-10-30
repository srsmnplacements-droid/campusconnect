import Papa from 'papaparse'

// Stops spreadsheet programs from running text that starts with = or @ as a formula.
function safeCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /^[=@]|^[+\-][^0-9\s]/.test(s) ? "'" + s : s
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return Papa.unparse({ fields: header, data: rows.map(r => r.map(safeCell)) })
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  downloadBlob(filename, new Blob(['\ufeff' + toCsv(header, rows)], { type: 'text/csv;charset=utf-8' }))
}
