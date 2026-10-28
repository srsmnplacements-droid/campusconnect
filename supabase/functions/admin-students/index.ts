// CampusConnect - Edge Function "admin-students"
// Runs on Supabase's servers (NOT in the browser), so it may safely use the
// secret service-role key. Only a signed-in ADMIN can use it.
//   action "create_students": validate (dry_run) or create student logins
//   action "reset_password" : give a student a new temporary password
import { createClient } from 'npm:@supabase/supabase-js@2'

// Must match STUDENT_EMAIL_DOMAIN in src/config.ts
const STUDENT_EMAIL_DOMAIN = 'students.srsmn-placement.in'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...cors, 'Content-Type': 'application/json' } })

// No look-alike characters (0/O, 1/l/I)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
function tempPassword(len = 10): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}
const norm = (s: unknown) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const loginEmail = (reg: string) => reg.toLowerCase() + '@' + STUDENT_EMAIL_DOMAIN

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1) Who is calling? Must be a signed-in administrator.
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: userData } = await userClient.auth.getUser()
    const caller = userData?.user
    if (!caller) return json({ ok: false, error: 'Please sign in again.' })

    // Check the caller's role using THEIR OWN login (no secret key needed).
    const { data: roleRow, error: roleErr } = await userClient
      .from('user_roles').select('role').eq('user_id', caller.id).maybeSingle()
    if (roleErr) return json({ ok: false, error: 'Could not check your role: ' + roleErr.message })
    if (roleRow?.role !== 'admin') return json({ ok: false, error: 'Administrators only.' })

    // Server-side client with the secret key (never leaves Supabase's servers).
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const { error: svcErr } = await admin.from('courses').select('id').limit(1)
    if (svcErr) return json({ ok: false, error: 'Server key problem: ' + svcErr.message })

    const body = await req.json()

    // ------------------------------------------------------------------
    if (body.action === 'reset_password') {
      const { data: sp } = await admin
        .from('student_profiles').select('id, user_id, register_no').eq('id', body.student_id).maybeSingle()
      if (!sp) return json({ ok: false, error: 'Student not found.' })
      if (!sp.user_id) return json({ ok: false, error: 'This student has no login account.' })
      const custom = String(body.temp_password ?? '').trim()
      if (custom && (custom.length < 8 || custom.length > 64))
        return json({ ok: false, error: 'Temporary password must be 8 to 64 characters.' })
      const pw = custom || tempPassword()
      const { error } = await admin.auth.admin.updateUserById(sp.user_id, { password: pw })
      if (error) return json({ ok: false, error: error.message })
      await admin.from('student_profiles').update({ must_change_password: true }).eq('id', sp.id)
      await admin.from('protected_admin_audit_logs').insert({
        admin_user_id: caller.id, admin_email: caller.email, action: 'reset_student_password',
        details: { register_no: sp.register_no },
      })
      return json({ ok: true, register_no: sp.register_no, temp_password: pw })
    }

    // ------------------------------------------------------------------
    if (body.action === 'create_students') {
      const rows: any[] = Array.isArray(body.rows) ? body.rows : []
      const dryRun = body.dry_run === true
      if (rows.length === 0) return json({ ok: false, error: 'No rows received.' })
      if (rows.length > 200) return json({ ok: false, error: 'Send at most 200 rows at a time.' })

      const [{ data: courses }, { data: years }] = await Promise.all([
        admin.from('courses').select('id, code, name, total_semesters, is_active'),
        admin.from('academic_years').select('id, label, is_current'),
      ])
      const courseMap = new Map<string, any>()
      for (const c of courses ?? []) { courseMap.set(norm(c.code), c); courseMap.set(norm(c.name), c) }
      const yearMap = new Map<string, any>((years ?? []).map((y: any) => [y.label, y]))
      const currentYear = (years ?? []).find((y: any) => y.is_current)

      // existing register numbers
      const regs = rows.map((r) => String(r.register_no ?? '').trim().toUpperCase().replace(/\s+/g, ''))
      const { data: existing } = await admin
        .from('student_profiles').select('register_no').in('register_no', regs.filter(Boolean))
      const existingSet = new Set((existing ?? []).map((e: any) => e.register_no))
      const seen = new Set<string>()

      const results: any[] = []
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const errs: string[] = []
        const reg = regs[i]
        const name = String(r.full_name ?? '').trim().replace(/\s+/g, ' ')
        const email = String(r.email ?? '').trim()
        const phone = String(r.phone ?? '').trim()
        const batch = String(r.batch ?? '').trim()
        const customPw = String(r.temp_password ?? '').trim()
        const course = courseMap.get(norm(r.course))
        const sem = parseInt(String(r.semester ?? ''), 10)
        const yl = String(r.academic_year ?? '').trim()
        const year = yl ? yearMap.get(yl) : currentYear

        if (!/^[A-Z0-9_-]{3,30}$/.test(reg)) errs.push('Register number must be 3-30 letters or numbers')
        if (name.length < 2 || name.length > 100) errs.push('Full name is required')
        if (!course) errs.push('Unknown course "' + String(r.course ?? '') + '"')
        else if (!course.is_active) errs.push('Course is inactive')
        if (!Number.isInteger(sem) || sem < 1 || (course && sem > course.total_semesters))
          errs.push('Semester must be 1 to ' + (course ? course.total_semesters : 12))
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.push('Invalid email address')
        if (phone && !/^[0-9+\- ]{7,15}$/.test(phone)) errs.push('Invalid phone number')
        if (batch.length > 20) errs.push('Batch text is too long')
        if (customPw && (customPw.length < 8 || customPw.length > 64)) errs.push('Temporary password must be 8 to 64 characters')
        if (!year) errs.push(yl ? 'Academic year "' + yl + '" not found' : 'No current academic year is set')

        if (errs.length) { results.push({ register_no: reg, status: 'invalid', message: errs.join('; ') }); continue }
        if (existingSet.has(reg)) { results.push({ register_no: reg, status: 'duplicate', message: 'Register number already exists' }); continue }
        if (seen.has(reg)) { results.push({ register_no: reg, status: 'duplicate', message: 'Repeated in this file' }); continue }
        seen.add(reg)

        if (dryRun) { results.push({ register_no: reg, status: 'ok', message: 'Ready to import' }); continue }

        // ---- create login, profile and year record (undo if anything fails)
        const pw = customPw || tempPassword()
        const { data: created, error: ue } = await admin.auth.admin.createUser({
          email: loginEmail(reg), password: pw, email_confirm: true,
        })
        if (ue || !created?.user) {
          results.push({ register_no: reg, status: 'failed', message: ue?.message ?? 'Could not create login' })
          continue
        }
        const { data: prof, error: pe } = await admin.from('student_profiles').insert({
          user_id: created.user.id, register_no: reg, full_name: name, course_id: course.id,
          email: email || null, phone: phone || null, must_change_password: true,
        }).select('id').single()
        if (pe || !prof) {
          await admin.auth.admin.deleteUser(created.user.id)
          results.push({ register_no: reg, status: 'failed', message: pe?.message ?? 'Could not save profile' })
          continue
        }
        const { error: re } = await admin.from('student_academic_records').insert({
          student_id: prof.id, academic_year_id: year.id, course_id: course.id, semester: sem, batch: batch || null,
        })
        if (re) {
          await admin.from('student_profiles').delete().eq('id', prof.id)
          await admin.auth.admin.deleteUser(created.user.id)
          results.push({ register_no: reg, status: 'failed', message: re.message })
          continue
        }
        await admin.from('user_roles').insert({ user_id: created.user.id, role: 'student' })
        results.push({ register_no: reg, status: 'created', message: 'Created', temp_password: pw })
      }

      if (!dryRun) {
        await admin.from('protected_admin_audit_logs').insert({
          admin_user_id: caller.id, admin_email: caller.email, action: 'create_students',
          details: {
            created: results.filter((x) => x.status === 'created').length,
            failed: results.filter((x) => x.status === 'failed').length,
          },
        })
      }
      return json({ ok: true, results })
    }

    return json({ ok: false, error: 'Unknown action.' })
  } catch (e) {
    return json({ ok: false, error: 'Server error: ' + (e instanceof Error ? e.message : String(e)) })
  }
})
