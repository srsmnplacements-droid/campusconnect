import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import CompanyLogo from '../components/CompanyLogo'
import { Spinner } from '../components/Layout'
import { isHttpUrl, removeAttachment, uploadAttachment, MAX_FILE } from '../lib/content'

export default function CompaniesAdmin() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<any | null | undefined>(undefined)
  const [reload, setReload] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    supabase.from('companies').select('*').order('name').limit(500).then(({ data, error: e }) => {
      setError(e ? e.message : ''); setRows(data ?? []); setLoading(false)
    })
  }, [reload])

  async function remove(r: any) {
    if (!window.confirm('Delete "' + r.name + '"?')) return
    setError('')
    const { count } = await supabase.from('campus_drives').select('*', { count: 'exact', head: true }).eq('company_id', r.id)
    if ((count ?? 0) > 0) { setError('This company has ' + count + ' drive(s). Delete or change those drives first.'); return }
    try {
      if (r.logo_path) await removeAttachment(r.logo_path)
      const { error: e } = await supabase.from('companies').delete().eq('id', r.id)
      if (e) throw new Error(e.message)
      setReload(n => n + 1)
    } catch (ex: any) { setError(ex.message) }
  }

  const shown = rows.filter(r => !search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to="/admin" className="text-sm text-brand-green">&larr; Dashboard</Link>
          <h1 className="text-2xl font-bold text-brand-navy">Companies</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/drives" className="btn-outline">Recruitment drives</Link>
          <button className="btn-green" onClick={() => setEditing(null)}>+ Add company</button>
        </div>
      </div>
      <input className="input" placeholder="Search companies" value={search} onChange={e => setSearch(e.target.value)} />
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <Spinner /> : shown.length === 0 ? <div className="card text-slate-500">No companies yet.</div> : (
        <div className="space-y-2">
          {shown.map(r => (
            <div key={r.id} className="card flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CompanyLogo path={r.logo_path} name={r.name} />
                <div>
                  <div className="font-semibold text-brand-navy">{r.name}</div>
                  {r.website && isHttpUrl(r.website) && <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-green underline">{r.website}</a>}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-outline !py-1.5" onClick={() => setEditing(r)}>Edit</button>
                <button className="btn !py-1.5 border border-red-300 bg-white text-red-700 hover:bg-red-50" onClick={() => remove(r)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing !== undefined && <CompanyEditor row={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setReload(n => n + 1) }} />}
    </div>
  )
}

function CompanyEditor({ row, onClose, onSaved }: { row: any | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(row?.name ?? '')
  const [website, setWebsite] = useState(row?.website ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  function pick(f: File | null) {
    setErr('')
    if (f && f.size > MAX_FILE) { setErr('Logo is too large (maximum 5 MB). Please use a smaller image.'); return }
    if (f && !['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) { setErr('Logo must be a PNG, JPG or WEBP image.'); return }
    setFile(f)
  }

  async function save() {
    setErr('')
    if (name.trim().length < 2) { setErr('Company name is required.'); return }
    if (website.trim() && !isHttpUrl(website.trim())) { setErr('Website must start with http:// or https://'); return }
    setBusy(true)
    const id: string = row?.id ?? crypto.randomUUID()
    const oldPath: string | null = row?.logo_path ?? null
    let newPath = oldPath
    let uploaded = false
    try {
      if (file) { newPath = await uploadAttachment(file, 'companies', id, null, ''); uploaded = true }
      else if (removeLogo) newPath = null
      const payload = { name: name.trim(), website: website.trim() || null, logo_path: newPath }
      let dbErr: any
      if (row) ({ error: dbErr } = await supabase.from('companies').update(payload).eq('id', id))
      else ({ error: dbErr } = await supabase.from('companies').insert({ ...payload, id }))
      if (dbErr) {
        if (uploaded && newPath) await removeAttachment(newPath).catch(() => {})
        throw new Error(dbErr.code === '23505' ? 'A company with this name already exists.' : dbErr.message)
      }
      if (oldPath && oldPath !== newPath) await removeAttachment(oldPath).catch(() => {})
      onSaved()
    } catch (ex: any) { setErr(ex.message) }
    setBusy(false)
  }

  return (
    <Modal title={row ? 'Edit company' : 'Add company'} onClose={onClose}>
      <div className="space-y-3">
        <div><label className="mb-1 block text-sm font-medium">Company name</label>
          <input className="input" value={name} maxLength={120} onChange={e => setName(e.target.value)} /></div>
        <div><label className="mb-1 block text-sm font-medium">Website (optional)</label>
          <input className="input" value={website} maxLength={200} placeholder="https://..." onChange={e => setWebsite(e.target.value)} /></div>
        <div>
          <label className="mb-1 block text-sm font-medium">Logo (optional)</label>
          {row?.logo_path && !removeLogo && !file && (
            <div className="mb-1 flex items-center gap-3 text-sm">
              <CompanyLogo path={row.logo_path} name={name} size={36} />
              <button type="button" className="text-red-600 underline" onClick={() => setRemoveLogo(true)}>Remove logo</button>
            </div>
          )}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm" onChange={e => pick(e.target.files?.[0] ?? null)} />
          <p className="mt-1 text-xs text-slate-500">Small square image works best. Keep it under 1 MB to save storage.</p>
        </div>
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <button className="btn-green w-full" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save company'}</button>
      </div>
    </Modal>
  )
}
