/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'
export const alt = 'Stormont Watch'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

async function fetchBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return `data:image/png;base64,${btoa(binary)}`
  } catch {
    return null
  }
}

export default async function Image() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.stormontwatch.com'

  const logoSrc = await fetchBase64(`${baseUrl}/logotext.png`)

  const dots = Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 6 }, (_, col) => ({ row, col }))
  )

  return new ImageResponse(
    (
      <div
        style={{
          background: '#203F59',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Left accent bar */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: 4, height: '100%', background: '#F6CB2F' }} />

        {/* Decorative circles */}
        <div style={{
          position: 'absolute', right: -100, bottom: -100,
          width: 420, height: 420, borderRadius: '50%',
          border: '40px solid rgba(255,255,255,0.04)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', right: -40, bottom: -40,
          width: 280, height: 280, borderRadius: '50%',
          border: '1px solid rgba(246,203,47,0.15)',
          display: 'flex',
        }} />

        {/* Dot grid */}
        <div style={{ position: 'absolute', top: 44, right: 52, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dots.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 10 }}>
              {row.map((_, ci) => (
                <div key={ci} style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
              ))}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '44px 52px 44px 60px', height: '100%' }}>
          {/* Logo */}
          {logoSrc && (
            <img src={logoSrc} alt="Stormont Watch" height={100} style={{ objectFit: 'contain', objectPosition: 'left', marginBottom: 48 }} />
          )}

          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 'auto' }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
              Northern Ireland Assembly tracker
            </div>
            <div style={{ fontSize: 20, color: '#C8DFF0' }}>
              Every vote. Every bill. Every MLA.
            </div>
            <div style={{ fontSize: 15, color: '#A8C8DF' }}>
              stormontwatch.com
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
