/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og'
import { getMemberById } from '@/lib/db/queries'
import { abbreviateParty } from '@/lib/format'

export const runtime = 'edge'
export const alt = 'MLA profile'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const INK   = '#16181f'
const TEAL  = '#2d9096'
const PAPER = '#fafafa'

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

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 88, height: 88, borderRadius: 24,
        background: 'rgba(255,255,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
          <path d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z" strokeLinejoin="round"/>
          <circle cx="12" cy="12" r="4"/>
          <circle cx="12" cy="12" r="2" fill="white" stroke="none"/>
        </svg>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 44, fontWeight: 600, color: PAPER, letterSpacing: '-0.03em' }}>Stormont</span>
        <span style={{ fontSize: 44, fontWeight: 400, color: 'rgba(255,255,255,0.45)', letterSpacing: '-0.03em' }}>Watch</span>
      </div>
    </div>
  )
}

export default async function Image({ params }: { params: { id: string } }) {
  const member = await getMemberById(params.id)

  const name = member?.fullName ?? 'MLA'
  const party = member ? abbreviateParty(member.party) : ''
  const constituency = member?.constituency ?? ''

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.stormontwatch.com'

  const photoSrc = member?.personId
    ? await fetchBase64(`${baseUrl}/mla-images/${member.personId}.jpg`, 'image/jpeg')
    : null

  return new ImageResponse(
    (
      <div style={{
        background: INK,
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}>

        {/* Teal accent bar — left */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: 5, height: '100%', background: TEAL }} />

        {/* Subtle teal glow */}
        <div style={{
          position: 'absolute', right: -180, top: -180,
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(45,144,150,0.15) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '52px 64px', height: '100%' }}>
          <Logo />

          <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 56 }}>
            {/* Left: text */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: '1', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Member of the Legislative Assembly
              </div>
              <div style={{ fontSize: 72, fontWeight: 600, color: PAPER, lineHeight: 1.0, letterSpacing: '-0.03em' }}>
                {name}
              </div>
              {party && (
                <div style={{ fontSize: 32, color: 'rgba(255,255,255,0.55)', letterSpacing: '-0.01em' }}>
                  {party}
                </div>
              )}
              {constituency && (
                <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.35)' }}>
                  {constituency}
                </div>
              )}
            </div>

            {/* Right: photo */}
            {photoSrc && (
              <div style={{ display: 'flex', flexShrink: 0 }}>
                <img
                  src={photoSrc}
                  alt={name}
                  width={200}
                  height={200}
                  style={{
                    borderRadius: 16,
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    border: `3px solid ${TEAL}`,
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
