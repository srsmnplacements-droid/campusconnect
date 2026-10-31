import { useEffect, useState } from 'react'
import Modal from './Modal'
import { callNotify } from '../lib/api'

type ItemType = 'notice' | 'event' | 'drive' | 'resource'

export default function NotifyModal({ itemType, itemId, onClose }: { itemType: ItemType; itemId: string; onClose: () => void }) {
  const [st, setSt] = useState<any>(null)
  const [courseIds, setCourseIds] = useState<string[]>([])
  const [email, setEmail] = useState(true)
  const [push, setPush] = useState(true)
  const [skip, setSkip] = useState(true)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [res, setRes] = useState<any>(null)

  async function load(ids: string[], skipSent: boolean, first = false) {
    setLoading(true); setErr('')
    try {
      const r = await callNotify({ action: 'status', item_type: itemType, item_id: itemId, course_ids: ids, skip_emailed: skipSent })
      setSt(r)
      if (first) { setCourseIds(r.selected_course_ids ?? []); setSubject(r.default_subject) }
      if (r.email && !r.email.configured) setEmail(false)
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }
  useEffect(() => { load([], true, true) }, [])

  function toggleCourse(id: string) {
    const next = courseIds.includes(id) ? courseIds.filter(c => c !== id) : [...courseIds, id]
    setCourseIds(next)
    load(next, skip)
  }

  async function send() {
    setErr(''); setRes(null)
    if (!email && !push) { setErr('Choose email, phone notification, or both.'); return }
    if (!window.confirm('Send this announcement now?')) return
    setBusy(true)
    try {
      setRes(await callNotify({
        action: 'send', item_type: itemType, item_id: itemId, course_ids: courseIds,
        channels: [email ? 'email' : '', push ? 'push' : ''].filter(Boolean),
        subject, message, skip_emailed: skip,
      }))
      load(courseIds, skip)
    } catch (e: any) { setErr(e.message) }
    setBusy(false)
  }

  const c = st?.counts
  const published = st?.item?.status === 'published'
  const quota: number | null = st?.email?.quota ?? null
  const needQuota = c ? c.to_email + Math.ceil(c.to_email / 45) : 0

  return (
    <Modal title="Notify students" onClose={onClose}>
      {loading && !st ? <p className="text-sm text-slate-500">Loading...</p> : (
        <div className="space-y-3">
          {st && <div className="rounded-lg bg-slate-50 p-3 text-sm"><b>{st.content_title}</b></div>}
          {st && !published && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">This item is not published yet. Publish it first.</div>}

          {st && (
            <div>
              <label className="mb-1 block text-sm font-medium">Send to these courses</label>
              <div className="flex flex-wrap gap-2">
                {st.courses.map((co: any) => (
                  <label key={co.id} className={'flex items-center gap-1 rounded-lg border px-2 py-1 text-sm ' + (courseIds.includes(co.id) ? 'border-brand-green bg-brand-greenLight' : 'border-slate-300')}>
                    <input type="checkbox" checked={courseIds.includes(co.id)} onChange={() => toggleCourse(co.id)} /> {co.code}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">Nothing ticked means every course the item is open to.</p>
            </div>
          )}

          {c && (
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <div><b>{c.targeted}</b> active student(s) match.</div>
              <div className="mt-1">Email: <b>{c.with_email}</b> have an email address, <b>{c.without_email}</b> do not{c.already_emailed ? ', ' + c.already_emailed + ' already emailed about this' : ''}.</div>
              <div>Phone notification: <b>{c.push_students}</b> student(s) have notifications turned on.</div>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={email} disabled={!st?.email?.configured} onChange={e => setEmail(e.target.checked)} />
            <span><b>Email</b> from srsmn.placements@gmail.com (addresses are hidden from each other)
              {st && !st.email.configured && <span className="block text-xs text-amber-700">Email is not set up yet. Follow the Gmail setup steps.</span>}
              {st?.email?.configured && quota !== null && (
                <span className={'block text-xs ' + (needQuota > quota ? 'text-amber-700' : 'text-slate-500')}>
                  Gmail can send about {quota} more recipients today{needQuota > quota ? '. This is more than that, so only part will go now. Send the rest tomorrow.' : '.'}
                </span>
              )}
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={push} onChange={e => setPush(e.target.checked)} />
            <span><b>Phone notification</b> for students who turned it on</span>
          </label>

          {email && (
            <>
              <div><label className="mb-1 block text-sm font-medium">Email subject</label>
                <input className="input" value={subject} maxLength={150} onChange={e => setSubject(e.target.value)} /></div>
              <div><label className="mb-1 block text-sm font-medium">Extra message (optional)</label>
                <textarea className="input" rows={3} maxLength={500} value={message} onChange={e => setMessage(e.target.value)} placeholder="Anything extra you want to say..." /></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={skip} onChange={e => { setSkip(e.target.checked); load(courseIds, e.target.checked) }} /> Skip students already emailed about this
              </label>
            </>
          )}

          {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}

          {res && (
            <div className="space-y-1 rounded-lg bg-green-50 p-3 text-sm text-green-900">
              {res.email && <div>Email: <b>{res.email.sent}</b> sent{res.email.not_sent ? ', ' + res.email.not_sent + ' not sent yet' : ''}{res.email.skipped_already_sent ? ', ' + res.email.skipped_already_sent + ' skipped (already emailed)' : ''}.{res.email.stopped && <span className="block text-amber-800">{res.email.stopped}</span>}</div>}
              {res.push && <div>Phone notifications: <b>{res.push.sent}</b> delivered to phones{res.push.failed ? ', ' + res.push.failed + ' failed' : ''}. {res.push.students_without} student(s) have notifications off.</div>}
            </div>
          )}

          <button className="btn-green w-full" disabled={busy || !published || loading} onClick={send}>{busy ? 'Sending... keep this open' : 'Send now'}</button>
        </div>
      )}
    </Modal>
  )
}
