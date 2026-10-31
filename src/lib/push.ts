import { supabase } from './supabase'

export type PushState = 'unsupported' | 'blocked' | 'on' | 'off'

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function keyToBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function currentSub(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

async function register(sub: PushSubscription) {
  const j = sub.toJSON()
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth, p_ua: navigator.userAgent,
  })
  if (error) throw new Error(error.message)
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const sub = await currentSub()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

// If this phone already allowed notifications, link it to whoever is signed in now.
export async function syncPush() {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return
    const sub = await currentSub()
    if (sub) await register(sub)
  } catch { /* ignore */ }
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser cannot show notifications. On iPhone, add the app to the Home Screen first.')
  const { data } = await supabase.from('push_settings').select('public_key').eq('id', 1).maybeSingle()
  if (!data?.public_key) throw new Error('Notifications are not ready yet. Please ask the Placement Cell to finish the setup.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications were not allowed. You can allow them in your browser or phone settings for this site.')
  const reg: ServiceWorkerRegistration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('The app is still starting. Please wait a few seconds and try again.')), 8000)),
  ])
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(data.public_key) })
  await register(sub)
}

export async function disablePush() {
  const sub = await currentSub()
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  }
}
