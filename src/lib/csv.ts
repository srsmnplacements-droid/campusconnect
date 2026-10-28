import Papa from 'papaparse'

// Stops spreadsheet programs from running text that starts with = or @ as a formula.
function safeCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /^[=@]|^[+\-][^0-9\s]/.test(s) ? "'" + s : s
}

export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const csv = Papa.unparse({ fields: header, data: rows.map(r => r.map(safeCell)) })
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
