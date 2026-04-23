import { ImageResponse } from 'next/og'
import { getPartyBySlug } from '@/lib/db/queries'
import { partyBorderColor, abbreviateParty } from '@/lib/format'

export const runtime = 'edge'
export const alt = 'Party profile'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const INK   = '#16181f'
const TEAL  = '#2d9096'
const PAPER = '#fafafa'

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

export default async function Image({ params }: { params: { slug: string } }) {
  const party = await getPartyBySlug(params.slug)

  const partyName = party?.party ?? 'Party'
  const abbr = party ? abbreviateParty(party.party) : ''
  const mlaCount = party?.mlaCount ?? 0
  const accentColor = party ? partyBorderColor(party.party) : TEAL

  return new ImageResponse(
    (
      <div style={{
        background: INK,
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}>

        {/* Party-coloured accent bar — left */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: 5, height: '100%', background: accentColor }} />

        {/* Party-coloured glow */}
        <div style={{
          position: 'absolute', right: -180, top: -180,
          width: 500, height: 500, borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}26 0%, transparent 70%)`,
          display: 'flex',
        }} />

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '52px 64px', height: '100%' }}>
          <Logo />

          <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex' }}>
                {`Northern Ireland Assembly · ${mlaCount} ${mlaCount === 1 ? 'MLA' : 'MLAs'}`}
              </div>
              <div style={{ fontSize: 72, fontWeight: 600, color: PAPER, lineHeight: 1.0, letterSpacing: '-0.03em', display: 'flex' }}>
                {partyName}
              </div>
              {abbr && abbr !== partyName && (
                <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.4)', letterSpacing: '-0.01em', display: 'flex' }}>
                  {abbr}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
