import { FormEvent, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function ChangePassword() {
  const [params] = useSearchParams()
  const first = params.get('first') === '1'
  const { role, student, refresh } = useAuth()
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (pw.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (pw !== pw2) { setError('The two passwords do not match.'); return }
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password: pw })
    if (err) { setBusy(false); setError(err.message); return }
    if (role === 'student' && student) {
      await supabase.from('student_profiles').update({ must_change_password: false }).eq('id', student.id)
      await refresh()
    }
    setBusy(false)
    setDone(true)
    setTimeout(() => navigate(role === 'admin' ? '/admin' : '/student', { replace: true }), 1200)
  }

  return (
    <div className="mx-auto mt-4 max-w-md">
      <div className="card">
        <h1 className="text-xl font-bold text-brand-navy">{first ? 'Set your new password' : 'Change password'}</h1>
        {first && (
          <p className="mt-2 text-sm text-slate-600">
            For your safety, please choose a new password before continuing.
          </p>
        )}
        {done ? (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-green-800">Password changed successfully.</div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">New password</label>
              <input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Type it again</label>
              <input className="input" type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" />
            </div>
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <button className="btn-green w-full" disabled={busy}>{busy ? 'Saving...' : 'Save new password'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
