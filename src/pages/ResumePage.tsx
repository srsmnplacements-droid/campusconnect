import { ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Spinner } from '../components/Layout'
import ResumeView from '../components/ResumeView'
import { COLLEGE_NAME } from '../config'
import {
  BLANK, ResumeData, TEMPLATES, TemplateId, emptyResume, mergeResume, validateResume,
} from '../lib/resume'

// ---------- small form helpers ----------
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="mb-1 block text-sm font-medium">{label}</label>{children}</div>
}
function In({ label, value, onChange, max = 120, placeholder, type = 'text' }:
  { label: string; value: string; onChange: (v: string) => void; max?: number; placeholder?: string; type?: string }) {
  return (
    <Field label={label}>
      <input className="input" type={type} value={value} maxLength={max} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} />
    </Field>
  )
}
function Area({ label, value, onChange, max = 500, rows = 3, placeholder }:
  { label: string; value: string; onChange: (v: string) => void; max?: number; rows?: number; placeholder?: string }) {
  return (
    <Field label={label}>
      <textarea className="input" rows={rows} value={value} maxLength={max} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} />
      <div className="mt-0.5 text-right text-xs text-slate-400">{value.length}/{max}</div>
    </Field>
  )
}
function Sect({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="card !p-0" open={open}>
      <summary className="cursor-pointer select-none p-4 font-semibold text-brand-navy">{title}</summary>
      <div className="space-y-3 border-t border-slate-100 p-4">{children}</div>
    </details>
  )
}
function Repeater<T extends object>({ items, onChange, blank, max, addLabel, children }:
  { items: T[]; onChange: (v: T[]) => void; blank: T; max: number; addLabel: string;
    children: (item: T, set: (patch: Partial<T>) => void) => ReactNode }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3">
          {children(it, patch => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x))))}
          <button type="button" className="text-sm text-red-600 underline" onClick={() => onChange(items.filter((_, k) => k !== i))}>
            Remove
          </button>
        </div>
      ))}
      {items.length < max && (
        <button type="button" className="btn-outline" onClick={() => onChange([...items, { ...blank }])}>+ {addLabel}</button>
      )}
    </div>
  )
}

// Shows the A4 page shrunk to fit the screen
function ScaledPreview({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.45)
  const [h, setH] = useState(500)
  useEffect(() => {
    const calc = () => {
      if (!box.current || !inner.current) return
      const w = box.current.clientWidth
      const iw = inner.current.offsetWidth
      if (w > 0 && iw > 0) {
        const s = Math.min(1, w / iw)
        setScale(s)
        setH(inner.current.offsetHeight * s)
      }
    }
    calc()
    const ro = new ResizeObserver(calc)
    if (box.current) ro.observe(box.current)
    if (inner.current) ro.observe(inner.current)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={box} className="w-full overflow-hidden rounded-lg border border-slate-300 bg-white shadow" style={{ height: h }}>
      <div ref={inner} style={{ width: '210mm', transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  )
}

// ---------- the page ----------
export default function ResumePage() {
  const { student } = useAuth()
  const [data, setData] = useState<ResumeData | null>(null)
  const [template, setTemplate] = useState<TemplateId>('green-sidebar')
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')

  useEffect(() => {
    if (!student) return
    supabase.from('student_resumes').select('template, data').eq('student_id', student.id).maybeSingle()
      .then(({ data: row, error }) => {
        if (error) setErr(error.message)
        if (row) {
          setData(mergeResume(row.data))
          if (TEMPLATES.some(t => t.id === row.template)) setTemplate(row.template as TemplateId)
        } else {
          // first time: fill what we already know
          const d = emptyResume()
          d.personal.fullName = student.full_name
          d.personal.email = student.email ?? ''
          d.personal.phone = student.phone ?? ''
          d.education = [{ degree: student.course_name, institution: COLLEGE_NAME + ', Barkur', year: '', score: '' }]
          setData(d)
        }
        setLoading(false)
      })
  }, [student])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (loading || !data || !student) return <Spinner />

  function update(patch: Partial<ResumeData>) {
    setData(d => ({ ...d!, ...patch }))
    setDirty(true); setMsg('')
  }
  const setP = (patch: Partial<ResumeData['personal']>) => update({ personal: { ...data!.personal, ...patch } })
  const setS = (patch: Partial<ResumeData['skills']>) => update({ skills: { ...data!.skills, ...patch } })

  async function save() {
    setErr(''); setMsg('')
    const v = validateResume(data!)
    if (v) { setErr(v); return }
    setSaving(true)
    const { error } = await supabase.from('student_resumes')
      .upsert({ student_id: student!.id, template, data: data! }, { onConflict: 'student_id' })
    setSaving(false)
    if (error) { setErr('Could not save: ' + error.message); return }
    setDirty(false); setMsg('Saved.')
  }

  function download() {
    setErr('')
    if (data!.personal.fullName.trim().length < 2) { setErr('Please enter your full name first.'); return }
    const old = document.title
    document.title = 'Resume - ' + data!.personal.fullName.trim()
    window.addEventListener('afterprint', () => { document.title = old }, { once: true })
    window.print()
  }

  const printRoot = document.getElementById('print-root')

  return (
    <div className="space-y-4">
      <div>
        <Link to="/student" className="text-sm text-brand-green">&larr; My dashboard</Link>
        <h1 className="text-2xl font-bold text-brand-navy">Resume builder</h1>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map(t => (
            <button key={t.id} type="button" onClick={() => { setTemplate(t.id); setDirty(true) }}
              className={'rounded-lg border px-3 py-2 text-left text-sm ' +
                (template === t.id ? 'border-brand-green bg-brand-greenLight font-semibold text-brand-greenDark' : 'border-slate-300 bg-white text-slate-600')}>
              {t.name}<div className="text-xs font-normal text-slate-500">{t.note}</div>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-green" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save resume'}</button>
          <button className="btn-navy" onClick={download}>Download PDF</button>
          {dirty && <span className="text-sm text-amber-700">Unsaved changes</span>}
          {msg && <span className="text-sm text-green-700">{msg}</span>}
        </div>
        <p className="text-xs text-slate-500">
          To get the PDF: tap <b>Download PDF</b>, then choose <b>Save as PDF</b> in the print window.
          Your saved resume can be seen only by you and the Placement Cell.
        </p>
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200 p-1 lg:hidden">
        {(['edit', 'preview'] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={'rounded-md py-2 text-sm font-semibold ' + (tab === t ? 'bg-white text-brand-navy shadow' : 'text-slate-500')}>
            {t === 'edit' ? 'Edit' : 'Preview'}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* ----- EDITOR ----- */}
        <div className={(tab === 'edit' ? '' : 'hidden ') + 'space-y-3 lg:block'}>
          <Sect title="1. Personal details" open>
            <In label="Full name" value={data.personal.fullName} onChange={v => setP({ fullName: v })} max={80} />
            <In label="Headline (optional)" value={data.personal.headline} onChange={v => setP({ headline: v })} max={100} placeholder="e.g. B.Com final year student" />
            <In label="Email" type="email" value={data.personal.email} onChange={v => setP({ email: v })} max={100} />
            <In label="Phone" value={data.personal.phone} onChange={v => setP({ phone: v })} max={15} />
            <In label="Address (optional)" value={data.personal.address} onChange={v => setP({ address: v })} max={150} placeholder="Town, District, State" />
            <In label="LinkedIn or portfolio (optional)" value={data.personal.linkedin} onChange={v => setP({ linkedin: v })} max={150} />
          </Sect>

          <Sect title="2. Career objective">
            <Area label="Two or three lines about your goal" value={data.objective} onChange={v => update({ objective: v })} max={600} rows={4}
              placeholder="A motivated commerce graduate looking for an entry-level role in accounting..." />
          </Sect>

          <Sect title="3. Education and marks">
            <Repeater items={data.education} onChange={v => update({ education: v })} blank={BLANK.education} max={6} addLabel="Add education">
              {(e, set) => (<>
                <In label="Degree or class" value={e.degree} onChange={v => set({ degree: v })} />
                <In label="School / college / university" value={e.institution} onChange={v => set({ institution: v })} max={160} />
                <div className="grid grid-cols-2 gap-2">
                  <In label="Year" value={e.year} onChange={v => set({ year: v })} max={20} placeholder="2024-2027" />
                  <In label="Marks / CGPA" value={e.score} onChange={v => set({ score: v })} max={40} placeholder="CGPA 8.2 or 78%" />
                </div>
              </>)}
            </Repeater>
          </Sect>

          <Sect title="4. Skills and languages">
            <Area label="Technical skills (separate with commas)" value={data.skills.technical} onChange={v => setS({ technical: v })} max={300} rows={2} placeholder="Tally, MS Excel, Typing, Basic Python" />
            <Area label="Soft skills (separate with commas)" value={data.skills.soft} onChange={v => setS({ soft: v })} max={300} rows={2} placeholder="Communication, Teamwork, Time management" />
            <In label="Languages known (separate with commas)" value={data.languages} onChange={v => update({ languages: v })} max={150} placeholder="Kannada, English, Hindi, Tulu" />
          </Sect>

          <Sect title="5. Internships">
            <Repeater items={data.internships} onChange={v => update({ internships: v })} blank={BLANK.internship} max={5} addLabel="Add internship">
              {(x, set) => (<>
                <In label="Organisation" value={x.organisation} onChange={v => set({ organisation: v })} />
                <In label="Role" value={x.role} onChange={v => set({ role: v })} />
                <In label="Duration" value={x.duration} onChange={v => set({ duration: v })} max={30} placeholder="May 2026 - June 2026" />
                <Area label="What you did (one point per line)" value={x.description} onChange={v => set({ description: v })} max={400} rows={3} />
              </>)}
            </Repeater>
          </Sect>

          <Sect title="6. Projects">
            <Repeater items={data.projects} onChange={v => update({ projects: v })} blank={BLANK.project} max={6} addLabel="Add project">
              {(x, set) => (<>
                <In label="Project title" value={x.title} onChange={v => set({ title: v })} max={100} />
                <Area label="Description (one point per line)" value={x.description} onChange={v => set({ description: v })} max={400} rows={3} />
                <In label="Link (optional)" value={x.link} onChange={v => set({ link: v })} max={150} />
              </>)}
            </Repeater>
          </Sect>

          <Sect title="7. Certifications">
            <Repeater items={data.certifications} onChange={v => update({ certifications: v })} blank={BLANK.certification} max={10} addLabel="Add certification">
              {(x, set) => (<>
                <In label="Certificate name" value={x.name} onChange={v => set({ name: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <In label="Issued by" value={x.issuer} onChange={v => set({ issuer: v })} />
                  <In label="Year" value={x.year} onChange={v => set({ year: v })} max={20} />
                </div>
              </>)}
            </Repeater>
          </Sect>

          <Sect title="8. Workshops and training">
            <Repeater items={data.workshops} onChange={v => update({ workshops: v })} blank={BLANK.workshop} max={10} addLabel="Add workshop">
              {(x, set) => (<>
                <In label="Workshop or training name" value={x.name} onChange={v => set({ name: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <In label="Organised by" value={x.organiser} onChange={v => set({ organiser: v })} />
                  <In label="Year" value={x.year} onChange={v => set({ year: v })} max={20} />
                </div>
              </>)}
            </Repeater>
          </Sect>

          <Sect title="9. Achievements and activities">
            <Area label="Achievements (one per line)" value={data.achievements} onChange={v => update({ achievements: v })} max={500} rows={3} />
            <Area label="Extracurricular activities (one per line)" value={data.activities} onChange={v => update({ activities: v })} max={500} rows={3} placeholder="NSS volunteer&#10;College cultural committee member" />
          </Sect>

          <Sect title="10. Declaration (optional)">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={data.declaration.include}
                onChange={e => update({ declaration: { ...data.declaration, include: e.target.checked } })} />
              Include a declaration at the end
            </label>
            {data.declaration.include && (
              <In label="Place" value={data.declaration.place} onChange={v => update({ declaration: { ...data.declaration, place: v } })} max={60} placeholder="Barkur" />
            )}
          </Sect>
        </div>

        {/* ----- PREVIEW ----- */}
        <div className={(tab === 'preview' ? '' : 'hidden ') + 'lg:sticky lg:top-4 lg:block'}>
          <ScaledPreview><ResumeView data={data} template={template} /></ScaledPreview>
          <p className="mt-2 text-xs text-slate-500">Sections you leave empty are left out automatically. Long resumes continue on a second page.</p>
        </div>
      </div>

      {/* hidden full-size copy used only when printing / saving as PDF */}
      {printRoot && createPortal(<ResumeView data={data} template={template} />, printRoot)}
    </div>
  )
}
