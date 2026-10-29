import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type Role = 'admin' | 'student' | null

export interface StudentInfo {
  id: string
  register_no: string
  full_name: string
  email: string | null
  phone: string | null
  must_change_password: boolean
  profile_completed: boolean
  course_id: string
  course_code: string
  course_name: string
}

interface AuthState {
  session: Session | null
  role: Role
  student: StudentInfo | null
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState>({
  session: null, role: null, student: null, loading: true,
  refresh: async () => {}, signOut: async () => {},
})

export function useAuth() {
  return useContext(Ctx)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role>(null)
  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const uidRef = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      uidRef.current = data.session?.user.id ?? null
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      const newUid = s?.user.id ?? null
      if (newUid && newUid !== uidRef.current) setLoading(true)
      uidRef.current = newUid
      setSession(s)
      if (!s) {
        setRole(null)
        setStudent(null)
        setLoading(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadProfile = useCallback(async (uid: string, silent = false) => {
    if (!silent) setLoading(true)
    const { data: r } = await supabase
      .from('user_roles').select('role').eq('user_id', uid).maybeSingle()
    if (r?.role === 'admin') {
      setRole('admin'); setStudent(null); setLoading(false)
      return
    }
    const { data: s } = await supabase
      .from('student_profiles')
      .select('id, register_no, full_name, email, phone, must_change_password, profile_completed, status, course_id, courses(code, name)')
      .eq('user_id', uid).maybeSingle()
    if (s && (s as any).status === 'active') {
      const c: any = (s as any).courses
      const course = Array.isArray(c) ? c[0] : c
      setRole('student')
      setStudent({
        id: (s as any).id,
        register_no: (s as any).register_no,
        full_name: (s as any).full_name,
        email: (s as any).email,
        phone: (s as any).phone,
        must_change_password: (s as any).must_change_password,
        profile_completed: (s as any).profile_completed,
        course_id: (s as any).course_id,
        course_code: course?.code ?? '',
        course_name: course?.name ?? '',
      })
    } else {
      setRole(null); setStudent(null)
    }
    setLoading(false)
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    if (uid) loadProfile(uid)
  }, [uid, loadProfile])

  const refresh = useCallback(async () => {
    if (uid) await loadProfile(uid, true)
  }, [uid, loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <Ctx.Provider value={{ session, role, student, loading, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  )
}
