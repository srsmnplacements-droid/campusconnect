import { useEffect, useState } from 'react'

const KEY = 'cc-install-dismissed'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true

// Shows an "Install app" bar when the phone allows it. On iPhone it shows the Safari steps.
export default function InstallBanner() {
  const [deferred, setDeferred] = useState<any>(null)
  const [installed, setInstalled] = useState(isStandalone())
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(KEY) === '1' } catch { return false }
  })
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => {
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e) }
    const onInstalled = () => { setInstalled(true); setDeferred(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(KEY, '1') } catch { /* ignore */ }
  }

  async function install() {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  if (installed || dismissed || (!deferred && !ios)) return null

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-3">
      <div className="flex items-center gap-3 rounded-xl border border-brand-green bg-brand-greenLight p-3 text-sm text-brand-navy">
        <div className="flex-1">
          {deferred ? (
            <><b>Install CampusConnect</b> on your phone for quick access.</>
          ) : (
            <><b>Install this app:</b> in Safari tap the Share button, then <b>Add to Home Screen</b>.</>
          )}
        </div>
        {deferred && <button className="btn-green !py-1.5" onClick={install}>Install</button>}
        <button className="px-1 text-xl leading-none text-slate-500" aria-label="Close" onClick={dismiss}>&times;</button>
      </div>
    </div>
  )
}
