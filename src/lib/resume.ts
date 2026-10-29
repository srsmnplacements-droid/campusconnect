// Resume data model and small helpers (no personal data is hard-coded here)
export type TemplateId = 'green-sidebar' | 'navy-classic' | 'plain-ats'

export const TEMPLATES: { id: TemplateId; name: string; note: string }[] = [
  { id: 'green-sidebar', name: 'Green sidebar', note: 'Modern, two columns' },
  { id: 'navy-classic', name: 'Navy classic', note: 'Header band, one column' },
  { id: 'plain-ats', name: 'Plain (ATS-friendly)', note: 'Simple black and white' },
]

export interface Education { degree: string; institution: string; year: string; score: string }
export interface Project { title: string; description: string; link: string }
export interface Internship { organisation: string; role: string; duration: string; description: string }
export interface Certification { name: string; issuer: string; year: string }
export interface Workshop { name: string; organiser: string; year: string }

export interface ResumeData {
  personal: { fullName: string; headline: string; email: string; phone: string; address: string; linkedin: string }
  objective: string
  education: Education[]
  skills: { technical: string; soft: string }
  projects: Project[]
  internships: Internship[]
  certifications: Certification[]
  workshops: Workshop[]
  achievements: string // one per line
  activities: string // one per line
  languages: string // comma separated
  declaration: { include: boolean; place: string }
}

export const BLANK = {
  education: { degree: '', institution: '', year: '', score: '' } as Education,
  project: { title: '', description: '', link: '' } as Project,
  internship: { organisation: '', role: '', duration: '', description: '' } as Internship,
  certification: { name: '', issuer: '', year: '' } as Certification,
  workshop: { name: '', organiser: '', year: '' } as Workshop,
}

export function emptyResume(): ResumeData {
  return {
    personal: { fullName: '', headline: '', email: '', phone: '', address: '', linkedin: '' },
    objective: '',
    education: [],
    skills: { technical: '', soft: '' },
    projects: [],
    internships: [],
    certifications: [],
    workshops: [],
    achievements: '',
    activities: '',
    languages: '',
    declaration: { include: false, place: '' },
  }
}

// Combine saved data with defaults so older saves never break newer versions
export function mergeResume(saved: any): ResumeData {
  const base = emptyResume()
  if (!saved || typeof saved !== 'object') return base
  return {
    ...base, ...saved,
    personal: { ...base.personal, ...(saved.personal ?? {}) },
    skills: { ...base.skills, ...(saved.skills ?? {}) },
    declaration: { ...base.declaration, ...(saved.declaration ?? {}) },
    education: Array.isArray(saved.education) ? saved.education : [],
    projects: Array.isArray(saved.projects) ? saved.projects : [],
    internships: Array.isArray(saved.internships) ? saved.internships : [],
    certifications: Array.isArray(saved.certifications) ? saved.certifications : [],
    workshops: Array.isArray(saved.workshops) ? saved.workshops : [],
  }
}

export const has = (s?: string | null) => !!s && s.trim().length > 0
export const splitList = (s?: string) => (s ?? '').split(/[,\n]/).map(x => x.trim()).filter(Boolean)
export const splitLines = (s?: string) => (s ?? '').split('\n').map(x => x.trim()).filter(Boolean)

export const MAX_BYTES = 55000 // the database accepts under 60,000
export const sizeOf = (d: ResumeData) => new Blob([JSON.stringify(d)]).size

export function validateResume(d: ResumeData): string | null {
  const p = d.personal
  if (p.fullName.trim().length < 2) return 'Please enter your full name.'
  if (has(p.email) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email.trim())) return 'The email address is not valid.'
  if (has(p.phone) && !/^[0-9+\- ]{7,15}$/.test(p.phone.trim())) return 'The phone number is not valid (digits, +, - and spaces only).'
  if (sizeOf(d) > MAX_BYTES) return 'The resume has too much text. Please shorten some sections.'
  return null
}
