import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BUCKET } from '../lib/content'

export function useSignedUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let off = false
    if (!path) { setUrl(null); return }
    supabase.storage.from(BUCKET).createSignedUrl(path, 3600).then(({ data }) => { if (!off) setUrl(data?.signedUrl ?? null) })
    return () => { off = true }
  }, [path])
  return url
}

export default function CompanyLogo({ path, name, size = 44 }: { path?: string | null; name: string; size?: number }) {
  const url = useSignedUrl(path)
  if (url) return <img src={url} alt={name} className="shrink-0 rounded border border-slate-200 bg-white object-contain" style={{ width: size, height: size }} />
  return (
    <div className="flex shrink-0 items-center justify-center rounded bg-brand-navy font-bold text-white" style={{ width: size, height: size }}>
      {(name || '?').slice(0, 1).toUpperCase()}
    </div>
  )
}
