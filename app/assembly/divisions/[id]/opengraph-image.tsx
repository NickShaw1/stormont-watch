/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og'
import { getDivisionWithVotes } from '@/lib/db/queries'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import { formatDate } from '@/lib/format'

export const runtime = 'edge'
export const alt = 'Division result'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const INK    = '#16181f'
const TEAL   = '#2d9096'
const PAPER  = '#fafafa'
const FOREST = '#1a7a56'
const CRIMSON = '#b83232'

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
  const data = await getDivisionWithVotes(params.id)

  const raw = data?.division.title ?? data?.division.subject ?? 'Assembly Division'
  const truncated = raw.length > 80 ? `${raw.slice(0, 80)}…` : raw
  const { title } = formatDivisionSubject(truncated)
  const outcome = data?.division.outcome ?? null
  const divisionDate = data?.division.divisionDate
    ? formatDate(data.division.divisionDate.toString())
    : ''

  const passed = outcome ? outcome.toLowerCase().includes('carried') : null
  const pill =
    passed === true  ? { label: 'Passed', bg: FOREST,  color: '#ffffff' } :
    passed === false ? { label: 'Failed', bg: CRIMSON, color: '#ffffff' } :
    null

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

        {/* Glow */}
        <div style={{
          position: 'absolute', right: -180, top: -180,
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(45,144,150,0.15) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '52px 64px', height: '100%' }}>
          <Logo />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {divisionDate ? `Division · ${divisionDate}` : 'Division'}
              </div>
              {pill && (
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  background: pill.bg, color: pill.color,
                  borderRadius: 999, padding: '4px 14px',
                }}>
                  {pill.label}
                </div>
              )}
            </div>

            <div style={{ fontSize: 48, fontWeight: 600, color: PAPER, lineHeight: 1.1, letterSpacing: '-0.03em' }}>
              {title}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
