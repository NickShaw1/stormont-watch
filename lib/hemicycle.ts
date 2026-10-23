import { partyBorderColor } from '@/lib/format'

export interface HemicycleParty {
  party: string
  slug: string
  mlaCount: number
}

export const W = 580
export const H = 310
const ROWS = 5
const R_IN = 85
const R_OUT = 225
export const SR = 7.5
const CX = W / 2
const CY = 295
export const VIEW_TOP = 55
export const VIEW_X = 40
export const VIEW_W = 500
export const HIT_RADIUS = 26

export interface Seat {
  x: number
  y: number
  party: string
  color: string
}

export function buildSeats(parties: HemicycleParty[]): Seat[] {
  const total = parties.reduce((s, p) => s + p.mlaCount, 0)

  const radii: number[] = []
  for (let i = 0; i < ROWS; i++) {
    radii.push(R_IN + ((R_OUT - R_IN) * i) / (ROWS - 1))
  }

  const rawCounts = radii.map((r) => Math.round(Math.PI * r / (SR * 2.6)))

  let diff = total - rawCounts.reduce((a, b) => a + b, 0)
  let idx = ROWS - 1
  let guard = 0
  while (diff !== 0 && guard < 5000) {
    if (diff > 0) { rawCounts[idx] += 1; diff -= 1 }
    else if (rawCounts[idx] > 0) { rawCounts[idx] -= 1; diff += 1 }
    idx = (idx - 1 + ROWS) % ROWS
    guard += 1
  }

  const positions: { frac: number; r: number }[] = []
  for (let ri = 0; ri < ROWS; ri++) {
    const count = rawCounts[ri]
    for (let si = 0; si < count; si++) {
      positions.push({ frac: count > 1 ? si / (count - 1) : 0.5, r: radii[ri] })
    }
  }

  positions.sort((a, b) => a.frac - b.frac || a.r - b.r)

  const sequence: string[] = []
  for (const p of parties) {
    for (let i = 0; i < p.mlaCount; i++) sequence.push(p.party)
  }

  return positions.map((pos, i) => {
    const angle = Math.PI + pos.frac * Math.PI
    const x = CX + pos.r * Math.cos(angle)
    const y = CY + pos.r * Math.sin(angle)
    const party = sequence[i] ?? ''
    return { x, y, party, color: partyBorderColor(party) }
  })
}

