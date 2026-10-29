import { ReactNode } from 'react'
import { ResumeData, TemplateId, has, splitLines, splitList } from '../lib/resume'

// A4 page: 210mm wide. Fixed pixel sizes so preview and PDF look identical.
const FONT = 'Calibri, Carlito, "Segoe UI", Arial, Helvetica, sans-serif'
const avoid = { breakInside: 'avoid' as const, pageBreakInside: 'avoid' as const }

function Lines({ text }: { text: string }) {
  const lines = splitLines(text)
  if (lines.length === 0) return null
  if (lines.length === 1) return <p style={{ margin: '2px 0' }}>{lines[0]}</p>
  return (
    <ul style={{ margin: '2px 0', paddingLeft: '16px' }}>
      {lines.map((l, i) => <li key={i} style={{ margin: '1px 0' }}>{l}</li>)}
    </ul>
  )
}

function Section({ title, accent, children }: { title: string; accent: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: '14px' }}>
      <h2 style={{
        margin: '0 0 6px', paddingBottom: '2px', fontSize: '13.5px', letterSpacing: '0.6px',
        textTransform: 'uppercase', color: accent, borderBottom: '1.5px solid ' + accent,
        breakAfter: 'avoid', pageBreakAfter: 'avoid',
      }}>{title}</h2>
      {children}
    </section>
  )
}

function Row({ left, right }: { left: ReactNode; right?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <div>{left}</div>
      {has(right) && <div style={{ whiteSpace: 'nowrap', color: '#4b5563' }}>{right}</div>}
    </div>
  )
}

function MainSections({ data, accent, skillsInMain }: { data: ResumeData; accent: string; skillsInMain: boolean }) {
  const edu = data.education.filter(e => has(e.degree) || has(e.institution))
  const proj = data.projects.filter(x => has(x.title))
  const intern = data.internships.filter(x => has(x.organisation) || has(x.role))
  const certs = data.certifications.filter(x => has(x.name))
  const works = data.workshops.filter(x => has(x.name))
  const tech = splitList(data.skills.technical)
  const soft = splitList(data.skills.soft)
  const langs = splitList(data.languages)
  const today = new Date().toLocaleDateString('en-IN')

  return (
    <>
      {has(data.objective) && (
        <Section title="Career Objective" accent={accent}><p style={{ margin: 0 }}>{data.objective.trim()}</p></Section>
      )}

      {edu.length > 0 && (
        <Section title="Education" accent={accent}>
          {edu.map((e, i) => (
            <div key={i} style={{ ...avoid, marginBottom: '6px' }}>
              <Row left={<b>{e.degree}</b>} right={e.year} />
              {has(e.institution) && <div>{e.institution}</div>}
              {has(e.score) && <div style={{ color: '#4b5563' }}>{e.score}</div>}
            </div>
          ))}
        </Section>
      )}

      {intern.length > 0 && (
        <Section title="Internships" accent={accent}>
          {intern.map((x, i) => (
            <div key={i} style={{ ...avoid, marginBottom: '6px' }}>
              <Row left={<b>{x.role}{has(x.role) && has(x.organisation) ? ', ' : ''}{x.organisation}</b>} right={x.duration} />
              <Lines text={x.description} />
            </div>
          ))}
        </Section>
      )}

      {proj.length > 0 && (
        <Section title="Projects" accent={accent}>
          {proj.map((x, i) => (
            <div key={i} style={{ ...avoid, marginBottom: '6px' }}>
              <b>{x.title}</b>{has(x.link) && <span style={{ color: '#4b5563' }}> ({x.link})</span>}
              <Lines text={x.description} />
            </div>
          ))}
        </Section>
      )}

      {skillsInMain && (tech.length > 0 || soft.length > 0) && (
        <Section title="Skills" accent={accent}>
          {tech.length > 0 && <div><b>Technical: </b>{tech.join(', ')}</div>}
          {soft.length > 0 && <div><b>Soft skills: </b>{soft.join(', ')}</div>}
        </Section>
      )}

      {certs.length > 0 && (
        <Section title="Certifications" accent={accent}>
          {certs.map((x, i) => (
            <div key={i} style={avoid}>
              <Row left={<span><b>{x.name}</b>{has(x.issuer) ? ' - ' + x.issuer : ''}</span>} right={x.year} />
            </div>
          ))}
        </Section>
      )}

      {works.length > 0 && (
        <Section title="Workshops and Training" accent={accent}>
          {works.map((x, i) => (
            <div key={i} style={avoid}>
              <Row left={<span><b>{x.name}</b>{has(x.organiser) ? ' - ' + x.organiser : ''}</span>} right={x.year} />
            </div>
          ))}
        </Section>
      )}

      {splitLines(data.achievements).length > 0 && (
        <Section title="Achievements" accent={accent}><Lines text={data.achievements} /></Section>
      )}

      {splitLines(data.activities).length > 0 && (
        <Section title="Extracurricular Activities" accent={accent}><Lines text={data.activities} /></Section>
      )}

      {skillsInMain && langs.length > 0 && (
        <Section title="Languages Known" accent={accent}><p style={{ margin: 0 }}>{langs.join(', ')}</p></Section>
      )}

      {data.declaration.include && (
        <Section title="Declaration" accent={accent}>
          <div style={avoid}>
            <p style={{ margin: '0 0 8px' }}>I hereby declare that the information given above is true and correct to the best of my knowledge.</p>
            <Row left={<span>Place: {data.declaration.place}<br />Date: {today}</span>} right={data.personal.fullName} />
          </div>
        </Section>
      )}
    </>
  )
}

function contactItems(p: ResumeData['personal']) {
  return [p.phone, p.email, p.address, p.linkedin].filter(has).map(s => s.trim())
}

export default function ResumeView({ data, template }: { data: ResumeData; template: TemplateId }) {
  const p = data.personal
  const base = {
    width: '210mm', minHeight: '296mm', boxSizing: 'border-box' as const, background: '#ffffff',
    fontFamily: FONT, fontSize: '12.5px', lineHeight: 1.45, color: '#1f2937', display: 'flow-root' as const,
    WebkitPrintColorAdjust: 'exact' as const, printColorAdjust: 'exact' as const,
  }

  if (template === 'green-sidebar') {
    const GREEN = '#166534'
    const tech = splitList(data.skills.technical)
    const soft = splitList(data.skills.soft)
    const langs = splitList(data.languages)
    const contacts = contactItems(p)
    const sideHead = {
      margin: '16px 0 6px', paddingBottom: '2px', fontSize: '12.5px', letterSpacing: '0.7px',
      textTransform: 'uppercase' as const, borderBottom: '1px solid rgba(255,255,255,0.55)',
      breakAfter: 'avoid' as const,
    }
    return (
      <div style={{ ...base, background: `linear-gradient(to right, ${GREEN} 0, ${GREEN} 68mm, #ffffff 68mm)` }}>
        <aside style={{ float: 'left', width: '68mm', boxSizing: 'border-box', padding: '12mm 6mm', color: '#ffffff', fontSize: '12px' }}>
          {contacts.length > 0 && (<>
            <h3 style={{ ...sideHead, marginTop: 0 }}>Contact</h3>
            {contacts.map((c, i) => <div key={i} style={{ margin: '3px 0', wordBreak: 'break-word' }}>{c}</div>)}
          </>)}
          {tech.length > 0 && (<>
            <h3 style={sideHead}>Technical skills</h3>
            {tech.map((s, i) => <div key={i} style={{ margin: '2px 0' }}>&bull; {s}</div>)}
          </>)}
          {soft.length > 0 && (<>
            <h3 style={sideHead}>Soft skills</h3>
            {soft.map((s, i) => <div key={i} style={{ margin: '2px 0' }}>&bull; {s}</div>)}
          </>)}
          {langs.length > 0 && (<>
            <h3 style={sideHead}>Languages</h3>
            {langs.map((s, i) => <div key={i} style={{ margin: '2px 0' }}>&bull; {s}</div>)}
          </>)}
        </aside>
        <main style={{ marginLeft: '68mm', padding: '12mm 10mm 12mm 9mm' }}>
          <h1 style={{ margin: 0, fontSize: '28px', lineHeight: 1.15, color: GREEN }}>{p.fullName || 'Your Name'}</h1>
          {has(p.headline) && <div style={{ marginTop: '3px', fontSize: '14px', color: '#4b5563' }}>{p.headline}</div>}
          <MainSections data={data} accent={GREEN} skillsInMain={false} />
        </main>
      </div>
    )
  }

  if (template === 'navy-classic') {
    const NAVY = '#0b2545'
    const contacts = contactItems(p)
    return (
      <div style={base}>
        <header style={{ background: NAVY, color: '#ffffff', padding: '11mm 12mm 8mm' }}>
          <h1 style={{ margin: 0, fontSize: '28px', lineHeight: 1.15 }}>{p.fullName || 'Your Name'}</h1>
          {has(p.headline) && <div style={{ marginTop: '3px', fontSize: '14px', color: '#cbd5e1' }}>{p.headline}</div>}
          {contacts.length > 0 && <div style={{ marginTop: '8px', fontSize: '12px', color: '#e2e8f0' }}>{contacts.join('  |  ')}</div>}
        </header>
        <div style={{ padding: '2mm 12mm 12mm' }}>
          <MainSections data={data} accent={NAVY} skillsInMain />
        </div>
      </div>
    )
  }

  const contacts = contactItems(p)
  return (
    <div style={{ ...base, padding: '12mm', color: '#111111' }}>
      <h1 style={{ margin: 0, fontSize: '26px', lineHeight: 1.15, textAlign: 'center' }}>{p.fullName || 'Your Name'}</h1>
      {has(p.headline) && <div style={{ marginTop: '2px', textAlign: 'center', fontSize: '13.5px' }}>{p.headline}</div>}
      {contacts.length > 0 && <div style={{ marginTop: '4px', textAlign: 'center', fontSize: '12px' }}>{contacts.join('  |  ')}</div>}
      <MainSections data={data} accent="#111111" skillsInMain />
    </div>
  )
}
