import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, configMissing } from '../lib/supabase'
import { studentLoginEmail } from '../config'
import { useAuth } from '../lib/auth'
import { Spinner } from '../components/Layout'

export default function Login() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'student' | 'admin'>(params.get('as') === 'admin' ? 'admin' : 'student')
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { session, role, loading, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (role === 'admin') navigate('/admin', { replace: true })
    else if (role === 'student') navigate('/student', { replace: true })
  }, [role, loading, navigate])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (configMissing) { setError('The website is not connected to Supabase yet.'); return }
    if (!id.trim() || !password) { setError('Please fill in both fields.'); return }
    setBusy(true)
    const email = tab === 'student' ? studentLoginEmail(id) : id.trim()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (err) {
      setError(err.message.toLowerCase().includes('invalid')
        ? 'Wrong ID or password. Please try again, or ask the Placement Cell to reset your password.'
        : err.message)
    }
  }

  if (session && loading) return <Spinner text="Signing you in..." />

  if (session && !loading && role === null) {
    return (
      <div className="card mx-auto mt-6 max-w-md text-center">
        <h2 className="text-lg font-bold text-brand-navy">Account not authorised</h2>
        <p className="mt-2 text-slate-600">This account is not set up for the portal or has been deactivated. Please contact the Placement Cell.</p>
        <button onClick={signOut} className="btn-navy mt-4">Sign out</button>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-4 max-w-md">
      <div className="card">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          {(['student', 'admin'] as const).map(t => (
            <button key={t} type="button"
              onClick={() => { setTab(t); setError(''); setId('') }}
              className={'rounded-md py-2 text-sm font-semibold ' +
                (tab === t ? 'bg-white text-brand-navy shadow' : 'text-slate-500')}>
              {t === 'student' ? 'Student' : 'Administrator'}
            </button>
          ))}
        </div>

        <h1 className="text-xl font-bold text-brand-navy">
          {tab === 'student' ? 'Student login' : 'Administrator login'}
        </h1>

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              {tab === 'student' ? 'Register number' : 'Email address'}
            </label>
            <input className="input" value={id} onChange={e => setId(e.target.value)}
              autoComplete="username" inputMode={tab === 'admin' ? 'email' : 'text'}
              placeholder={tab === 'student' ? 'e.g. U12345' : 'you@example.com'} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input className="input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <button className="btn-green w-full" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        </form>

        {tab === 'student' && (
          <p className="mt-4 text-xs text-slate-500">
            Forgot your password? Contact the Placement Cell. The coordinator will reset it for you.
          </p>
        )}
      </div>
    </div>
  )
}
