/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og'
import { getMemberById } from '@/lib/db/queries'
import { abbreviateParty } from '@/lib/format'

export const alt = 'MLA profile'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

async function fetchBase64(url: string, mime = 'image/png'): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return `data:${mime};base64,${btoa(binary)}`
  } catch {
    return null
  }
}

export default async function Image({ params }: { params: { id: string } }) {
  const member = await getMemberById(params.id)

  const name = member?.fullName ?? 'MLA'
  const party = member ? abbreviateParty(member.party) : ''
  const constituency = member?.constituency ?? ''

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const [logoSrc, photoSrc] = await Promise.all([
    fetchBase64(`${baseUrl}/logotext.png`),
    member?.personId
      ? fetchBase64(`${baseUrl}/mla-images/${member.personId}.jpg`, 'image/jpeg')
      : Promise.resolve(null),
  ])

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
            <img src={logoSrc} alt="Stormont Watch" height={100} style={{ objectFit: 'contain', objectPosition: 'left', marginBottom: 32 }} />
          )}

          {/* Two-column layout */}
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 48 }}>
            {/* Left: text */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: '0 1 680px', gap: 16 }}>
              <div style={{ fontSize: 24, color: '#F6CB2F', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Member of the Legislative Assembly
              </div>
              <div style={{ fontSize: 80, fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>
                {name}
              </div>
              {party && (
                <div style={{ fontSize: 40, color: '#7BAFD4' }}>
                  {party}
                </div>
              )}
              {constituency && (
                <div style={{ fontSize: 30, color: '#5A8FAE' }}>
                  {`${constituency} constituency`}
                </div>
              )}
            </div>

            {/* Right: photo — vertically centred in the column */}
            {photoSrc && (
              <div style={{ display: 'flex', alignSelf: 'center', flexShrink: 0, justifyContent: 'flex-start' }}>
                <img
                  src={photoSrc}
                  alt={name}
                  width={195}
                  height={195}
                  style={{
                    borderRadius: '50%',
                    border: '5px solid #F6CB2F',
                    objectFit: 'cover',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
