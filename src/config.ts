// Easy-to-edit details. Change the text below to update the website.
export const COLLEGE_NAME =
  'Smt. Rukmini Shedthi Memorial National Government First Grade College and PG Study Center'
export const COLLEGE_SHORT = 'SRSMN GFGC Barkur'
export const APP_NAME = 'CampusConnect'
export const COLLEGE_ADDRESS = 'Barkur, Udupi District, Karnataka, India'

// Placement Cell contact details (shown in the footer)
export const CONTACT_EMAIL = 'srsmn.placements@gmail.com'
export const COORDINATORS: { name: string; phone: string }[] = [
  { name: 'Mr. Anil Kumar K Y', phone: '8197238553' },
  { name: 'Mr. Lakshith Poojary', phone: '9743124835' },
]

// Students log in with their register number. Behind the scenes it becomes
// registerno@this-domain. No emails are ever sent to it.
export const STUDENT_EMAIL_DOMAIN = 'students.srsmn-placement.in'

export function studentLoginEmail(registerNo: string): string {
  return registerNo.trim().toLowerCase().replace(/\s+/g, '') + '@' + STUDENT_EMAIL_DOMAIN
}
