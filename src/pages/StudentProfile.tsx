import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import PushToggle from '../components/PushToggle'

export default function StudentProfile() {
  const { student, refresh } = useAuth()
  const [email, setEmail] = useState(student?.email ?? '')
  const [phone, setPhone] = useState(student?.phone ?? '')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  if (!student) return null

  async function save(e: FormEvent) {
    e.preventDefault(); setErr(''); setMsg('')
    const em = email.trim(), ph = phone.trim()
    if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { setErr('That email address does not look right.'); return }
    if (ph && !/^[0-9+\- ]{7,15}$/.test(ph)) { setErr('Phone number: use digits, +, - and spaces only (7 to 15 characters).'); return }
    setBusy(true)
    const { error } = await supabase.from('student_profiles')
      .update({ email: em || null, phone: ph || null, profile_completed: !!(em && ph) }).eq('id', student!.id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    await refresh()
    setMsg('Saved.')
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/student" className="text-sm text-brand-green">&larr; My dashboard</Link>
        <h1 className="text-2xl font-bold text-brand-navy">My profile</h1>
      </div>

      <div className="card">
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-500">Name</dt><dd className="font-semibold">{student.full_name}</dd></div>
          <div><dt className="text-slate-500">Register number</dt><dd className="font-semibold">{student.register_no}</dd></div>
          <div><dt className="text-slate-500">Course</dt><dd className="font-semibold">{student.course_code} - {student.course_name}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-slate-500">To change your name, register number or course, please contact the Placement Cell.</p>
      </div>

      <form onSubmit={save} className="card space-y-3">
        <h2 className="font-semibold text-brand-navy">Contact details</h2>
        <p className="text-sm text-slate-600">Add your email so the Placement Cell can send you drive and event announcements.</p>
        <div><label className="mb-1 block text-sm font-medium">Email address</label>
          <input className="input" type="email" inputMode="email" value={email} maxLength={100} onChange={e => setEmail(e.target.value)} placeholder="yourname@gmail.com" /></div>
        <div><label className="mb-1 block text-sm font-medium">Phone number</label>
          <input className="input" inputMode="tel" value={phone} maxLength={15} onChange={e => setPhone(e.target.value)} placeholder="98XXXXXXXX" /></div>
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        {msg && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{msg}</div>}
        <button className="btn-green w-full" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
      </form>

      <PushToggle />
      <Link to="/change-password" className="btn-outline">Change password</Link>
    </div>
  )
}
