import { Link } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { APP_NAME, COLLEGE_ADDRESS, COLLEGE_NAME, COLLEGE_SHORT, CONTACT_EMAIL, CONTACT_PHONE } from '../config'

export function Spinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10 text-slate-500">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-green" />
      <span>{text}</span>
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { session, role, student, signOut } = useAuth()
  const home = role === 'admin' ? '/admin' : role === 'student' ? '/student' : '/'
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-brand-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            {/* Logo area: replace this circle with the college logo later */}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-green text-sm font-bold">
              SR
            </div>
            <div className="leading-tight">
              <div className="text-base font-bold sm:text-lg">{APP_NAME}</div>
              <div className="text-xs text-slate-300 sm:text-sm">{COLLEGE_SHORT} Placement Hub</div>
            </div>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            {session ? (
              <>
                <Link to={home} className="hidden rounded-lg px-3 py-2 hover:bg-white/10 sm:block">
                  {role === 'admin' ? 'Admin' : student?.full_name?.split(' ')[0] ?? 'Dashboard'}
                </Link>
                <button onClick={signOut} className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-lg bg-brand-green px-3 py-2 font-semibold hover:bg-brand-greenDark">
                  Student login
                </Link>
                <Link to="/login?as=admin" className="hidden rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20 sm:block">
                  Admin login
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="bg-brand-navy text-slate-300">
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-6 text-sm">
          <div className="font-semibold text-white">Placement Cell</div>
          <div>{COLLEGE_NAME}</div>
          <div>{COLLEGE_ADDRESS}</div>
          <div>Email: {CONTACT_EMAIL} | Phone: {CONTACT_PHONE}</div>
        </div>
      </footer>
    </div>
  )
}
