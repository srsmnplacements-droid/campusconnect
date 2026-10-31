import { useEffect, useState } from 'react'
import { PushState, disablePush, enablePush, getPushState, syncPush } from '../lib/push'

export default function PushToggle() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    getPushState().then(s => { setState(s); if (s === 'on') syncPush() })
  }, [])

  async function turnOn() {
    setErr(''); setBusy(true)
    try { await enablePush(); setState(await getPushState()) } catch (e: any) { setErr(e.message) }
    setBusy(false)
  }
  async function turnOff() {
    setErr(''); setBusy(true)
    try { await disablePush(); setState(await getPushState()) } catch (e: any) { setErr(e.message) }
    setBusy(false)
  }

  if (state === null) return null
  return (
    <div className="card space-y-2">
      <h3 className="font-semibold text-brand-navy">Phone notifications</h3>
      {state === 'unsupported' && (
        <p className="text-sm text-slate-600">This browser cannot show notifications. On an iPhone, add the app to the Home Screen first (Share, then Add to Home Screen) and open it from there.</p>
      )}
      {state === 'blocked' && (
        <p className="text-sm text-slate-600">Notifications are blocked for this site. Allow them in your browser or phone settings, then come back.</p>
      )}
      {state === 'off' && (
        <>
          <p className="text-sm text-slate-600">Get an alert on this phone when the Placement Cell posts a new drive, event or notice.</p>
          <button className="btn-green" disabled={busy} onClick={turnOn}>{busy ? 'Please wait...' : 'Turn on notifications'}</button>
        </>
      )}
      {state === 'on' && (
        <>
          <p className="text-sm text-green-700">Notifications are ON for this phone.</p>
          <button className="btn-outline" disabled={busy} onClick={turnOff}>Turn off</button>
        </>
      )}
      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
    </div>
  )
}
