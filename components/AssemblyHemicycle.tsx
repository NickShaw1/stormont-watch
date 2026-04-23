'use client'

import React, { useRef, useState } from 'react'
import { partyBorderColor } from '@/lib/format'

interface HemicycleProps {
  parties: { party: string; mlaCount: number }[]
}

const W = 580
const H = 310
const ROWS = 5
const R_IN = 85
const R_OUT = 225
const SR = 7.5
const CX = W / 2
const CY = 295

interface Seat {
  x: number
  y: number
  party: string
  color: string
}

interface TooltipState {
  visible: boolean
  x: number
  y: number
  party: string
  count: number
  color: string
}

function buildSeats(parties: { party: string; mlaCount: number }[]): Seat[] {
  const total = parties.reduce((s, p) => s + p.mlaCount, 0)

  // Build row radii and raw seat counts
  const radii: number[] = []
  for (let i = 0; i < ROWS; i++) {
    radii.push(R_IN + ((R_OUT - R_IN) * i) / (ROWS - 1))
  }

  const rawCounts = radii.map((r) => Math.round(Math.PI * r / (SR * 2.6)))

  // Adjust to hit total exactly
  let diff = total - rawCounts.reduce((a, b) => a + b, 0)
  let idx = ROWS - 1
  while (diff !== 0) {
    rawCounts[idx] += diff > 0 ? 1 : -1
    diff += diff > 0 ? -1 : 1
    idx = (idx - 1 + ROWS) % ROWS
  }

  // Generate positions sorted by angular fraction
  const positions: { frac: number; r: number; rowIdx: number }[] = []
  for (let ri = 0; ri < ROWS; ri++) {
    const count = rawCounts[ri]
    for (let si = 0; si < count; si++) {
      positions.push({ frac: si / (count - 1), r: radii[ri], rowIdx: ri })
    }
  }

  // Sort by frac ascending, then r ascending
  positions.sort((a, b) => a.frac - b.frac || a.r - b.r)

  // Assign parties in sequence
  const sequence: string[] = []
  for (const p of parties) {
    for (let i = 0; i < p.mlaCount; i++) sequence.push(p.party)
  }

  return positions.map((pos, i) => {
    const angle = Math.PI + pos.frac * Math.PI // left to right: π → 2π (0)
    const x = CX + pos.r * Math.cos(angle)
    const y = CY + pos.r * Math.sin(angle)
    const party = sequence[i] ?? ''
    return { x, y, party, color: partyBorderColor(party) }
  })
}

export default function AssemblyHemicycle({ parties }: HemicycleProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, party: '', count: 0, color: '',
  })

  const seats = buildSeats(parties)
  const countByParty = Object.fromEntries(parties.map((p) => [p.party, p.mlaCount]))

  function handleEnter(e: React.MouseEvent, party: string, color: string) {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      party,
      count: countByParty[party] ?? 0,
      color,
    })
  }

  function handleMove(e: React.MouseEvent) {
    if (!tooltip.visible) return
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip((t) => ({ ...t, x: e.clientX - rect.left, y: e.clientY - rect.top }))
  }

  function handleLeave() {
    setTooltip((t) => ({ ...t, visible: false }))
  }

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', userSelect: 'none' }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <table style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        <caption>Assembly seat distribution by party</caption>
        <thead><tr><th scope="col">Party</th><th scope="col">Seats</th></tr></thead>
        <tbody>
          {parties.map((p) => (
            <tr key={p.party}><td>{p.party}</td><td>{p.mlaCount}</td></tr>
          ))}
        </tbody>
      </table>
      <svg
        viewBox={`0 55 ${W} ${H - 55}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        aria-hidden="true"
      >
        {seats.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={SR}
            fill={s.color}
            opacity={0.92}
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => handleEnter(e, s.party, s.color)}
          />
        ))}
      </svg>

      {tooltip.visible && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            background: '#fff',
            border: '0.5px solid #d0d0d0',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 10,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: tooltip.color,
              flexShrink: 0,
            }}
          />
          <span>{tooltip.party}</span>
          <span style={{ color: '#888', marginLeft: 4 }}>{tooltip.count} seats</span>
        </div>
      )}
    </div>
  )
}
