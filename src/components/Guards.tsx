import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuth, Role } from '../lib/auth'
import { Spinner } from './Layout'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function RequireRole({ role: needed, children }: { role: Exclude<Role, null>; children: ReactNode }) {
  const { session, role, loading, signOut } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  if (role === null) {
    return (
      <div className="card mx-auto mt-10 max-w-md text-center">
        <h2 className="text-lg font-bold text-brand-navy">Account not authorised</h2>
        <p className="mt-2 text-slate-600">
          Your account is not set up for this portal, or it has been deactivated. Please contact the Placement Cell.
        </p>
        <button onClick={signOut} className="btn-navy mt-4">Sign out</button>
      </div>
    )
  }
  if (role !== needed) return <Navigate to={role === 'admin' ? '/admin' : '/student'} replace />
  return <>{children}</>
}
