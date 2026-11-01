import { ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'

const KEY = 'cc-checklist'
function load(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}

function Checklist({ group, items }: { group: string; items: string[] }) {
  const [ticks, setTicks] = useState<Record<string, boolean>>(load())
  function toggle(id: string) {
    const next = { ...ticks, [id]: !ticks[id] }
    setTicks(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }
  const done = items.filter((_, i) => ticks[group + i]).length
  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-500">{done} of {items.length} done (saved on this device)</div>
      {items.map((t, i) => (
        <label key={i} className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={!!ticks[group + i]} onChange={() => toggle(group + i)} />
          <span className={ticks[group + i] ? 'text-slate-400 line-through' : ''}>{t}</span>
        </label>
      ))}
    </div>
  )
}

function Sec({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="card !p-0" open={open}>
      <summary className="cursor-pointer select-none p-4 font-semibold text-brand-navy">{title}</summary>
      <div className="space-y-2 border-t border-slate-100 p-4 text-sm text-slate-700">{children}</div>
    </details>
  )
}

export default function AdminGuide() {
  return (
    <div className="space-y-3">
      <div>
        <Link to="/admin" className="text-sm text-brand-green">&larr; Dashboard</Link>
        <h1 className="text-2xl font-bold text-brand-navy">Admin guide and checklists</h1>
        <p className="text-sm text-slate-600">Tick items as you finish them. Ticks are saved on this device only.</p>
      </div>

      <Sec title="Before real students log in" open>
        <Checklist group="launch" items={[
          'Delete the test students, test drives, events, notices and offer letters.',
          'Check the academic year: the current year should be 2026-27 (or the year you are running).',
          'Import the real students from the CSV file (Student directory, then Import CSV).',
          'Download the login-details CSV and keep it private. Give each student their own temporary password.',
          'Tell students to: log in, set a new password, open My profile and add their email and phone, and turn on notifications.',
          'Ask students to install the app (Chrome menu, then Install app).',
          'Make your first backup (Backup everything) and keep it on a pen drive. After that, once a year is enough.',
        ]} />
      </Sec>

      <Sec title="Security checklist">
        <Checklist group="security" items={[
          'Turn on 2-step verification for your GitHub, Supabase and srsmn.placements@gmail.com accounts.',
          'Use a long, unique password for the admin login. Do not share it. Sign out on shared computers.',
          'In Supabase, Authentication, Sign In / Providers: "Allow new users to sign up" must stay OFF.',
          'In Supabase, Storage: the buckets campus-files and offer-letters must NOT be Public.',
          'Never paste the Supabase "service_role" or "secret" key into GitHub, chat or any website. Only the "anon/publishable" key is used by the website.',
          'Give every student a different temporary password, or use the auto-generated ones. Students must change it at first login.',
          'Store backup and archive ZIP files only on devices the Placement Coordinators control. They contain personal data.',
          'Check that a student cannot see another student: log in as two students and confirm each sees only their own resume, registrations and offer letters.',
          'If you think a password or the Gmail script secret has leaked: change that password now. For the script secret, change SECRET in the Google script settings and in the Supabase secret APPS_SCRIPT_SECRET.',
        ]} />
      </Sec>

      <Sec title="Final testing checklist">
        <Checklist group="test" items={[
          'Student login and logout; the forced password change at first login.',
          'Password change; admin Reset password gives a new temporary password.',
          'Admin login works; a student cannot open admin pages.',
          'Add a student from each course: BCOM, BBA, BA, BSC, BCA, BSW and MSW.',
          'CSV import shows duplicates and wrong rows in the preview before saving.',
          'A student cannot change their own course or register number.',
          'Create, publish, archive and delete a notice and a resource (with and without an attachment).',
          'Create an event, register as a student, mark attendance, export CSV and PDF.',
          'Create a drive for one course only: other courses must not see it. Register, withdraw and re-register.',
          'Change applicant status, export the applicant list as CSV and PDF.',
          'Upload an offer letter for one student and a common PDF for several: only those students can open it.',
          'Build a resume with each template and save it as PDF. Check page breaks on a long resume.',
          'Notify students by email and by phone notification.',
          'Install the app on an Android phone and open it from the home screen.',
          'Practice the archive and deletion on a test year (2027-28), then check the Storage dashboard.',
          'Make a full backup and open the ZIP.',
        ]} />
      </Sec>

      <Sec title="Every year: backup">
        <Checklist group="yearly" items={[
          'At the end of the academic year (June or July), open Backup everything and create the ZIP.',
          'Copy the ZIP to a pen drive, and keep a second copy somewhere else (for example a second pen drive at home).',
          'Make an extra backup before you ever delete a year in Academic year archive.',
          'Optional but wise: one extra backup after the real students are imported and the first drives are finished.',
        ]} />
      </Sec>

      <Sec title="Quick checks (a few minutes)">
        <Checklist group="checks" items={[
          'Log in to the site at least once a week, so Supabase does not pause the project.',
          'Look at the Storage dashboard a few times a year. If a bar is above 70%, plan to archive an old year.',
        ]} />
      </Sec>

      <Sec title="Every academic year">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Make the yearly backup first (Backup everything).</li>
          <li>In <b>Academic years</b>, add the new year (for example 2027-28) and make it current.</li>
          <li>Download an <b>archive ZIP</b> of the oldest year you no longer need, check it, and only then delete it (Academic year archive). Keep the ZIP safe; check with the Principal about the retention rules first.</li>
          <li>Add the new first-year students with Import CSV.</li>
          <li>Students already in the college must also be enrolled in the new year with their new semester. <b>This is not automatic yet</b>: ask for the "enrol existing students in a new year" tool before the new year starts.</li>
          <li>Deactivate students who have left (Student directory, Deactivate).</li>
        </ol>
      </Sec>

      <Sec title="If something goes wrong">
        <ul className="list-disc space-y-2 pl-5">
          <li><b>The site shows an error or no data after some quiet weeks.</b> The free Supabase project may be paused. Open supabase.com, open the project, and click <b>Restore project</b>. It takes a few minutes. Your data is kept.</li>
          <li><b>A student forgot the password.</b> Student directory, then <b>Reset password</b> on their card. There are no reset emails.</li>
          <li><b>You forgot the admin password.</b> In Supabase, Authentication, Users, open your admin user and set a new password.</li>
          <li><b>Email says the daily limit is reached.</b> The free Gmail script sends to about 100 recipients a day. Send the rest tomorrow ("skip already emailed" is on by default) or send by course.</li>
          <li><b>The website did not update after an upload.</b> Open GitHub, Actions. A green tick means it is live. A red cross means the build failed: click it and send the error to your developer.</li>
          <li><b>You see a red message in the app.</b> Take a clear photo and note which button you pressed.</li>
        </ul>
      </Sec>

      <Sec title="Moving to another host later">
        <p>Nothing here ties you to GitHub Pages. The website is a normal static site:</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Keep the code in your GitHub repository.</li>
          <li>On Cloudflare Pages (or Netlify), choose "Connect to Git" and pick the repository.</li>
          <li>Build command: <code>npm run build</code>. Output folder: <code>dist</code>.</li>
          <li>Add two variables: <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (the same values you gave GitHub).</li>
          <li>The data, logins, files and server functions stay in Supabase, so they do not move.</li>
        </ol>
      </Sec>

      <Sec title="Free plan limits to remember">
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase: 500 MB database, 1 GB file storage, no automatic backups, and the project can pause after a week of inactivity. Limits can change, so check Supabase's pricing page now and then.</li>
          <li>Gmail script: about 100 email recipients a day, 50 per message.</li>
          <li>Database, files, bandwidth and logins are separate limits. Deleting data does not reset them.</li>
        </ul>
      </Sec>
    </div>
  )
}
