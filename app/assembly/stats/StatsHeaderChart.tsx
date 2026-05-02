interface Row { month: string; total_divisions: number }

const W = 220
const H = 140
const PL = 36  // space for y-axis title + labels
const PR = 4
const PT = 8
const PB = 26  // space for x-axis title + labels
const COLOR = '#C41E3A'
const LABEL_COLOR = 'rgba(120,120,120,0.7)'
const AXIS_COLOR = 'rgba(120,120,120,0.25)'
const FONT = '9px ui-monospace, monospace'
const Y_TICKS = 4

export default function StatsHeaderChart({ data }: { data: Row[] }) {
  if (data.length < 2) return null

  const vals = data.map(r => Number(r.total_divisions))
  const max = Math.max(...vals, 1)
  const innerW = W - PL - PR
  const innerH = H - PT - PB

  function px(i: number) { return PL + (i / (vals.length - 1)) * innerW }
  function py(v: number) { return PT + innerH - (v / max) * innerH }

  const linePath = vals.reduce((acc, v, i) => {
    const x = px(i)
    const y = py(v)
    if (i === 0) return `M ${x},${y}`
    const cpx = (px(i - 1) + x) / 2
    return `${acc} C ${cpx},${py(vals[i - 1])} ${cpx},${y} ${x},${y}`
  }, '')

  // Y-axis ticks: 0, max/3, 2*max/3, max (rounded)
  const yTicks = Array.from({ length: Y_TICKS }, (_, i) => Math.round((max * i) / (Y_TICKS - 1)))

  // X-axis: show Jan of each year
  const xLabels: { label: string; i: number }[] = []
  data.forEach((r, i) => {
    const month = r.month.slice(0, 7)
    if (month.endsWith('-01')) {
      xLabels.push({ label: month.slice(0, 4), i })
    }
  })

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {/* Y gridlines + labels */}
      {yTicks.map(v => {
        const y = py(v)
        return (
          <g key={v}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke={AXIS_COLOR} strokeWidth={0.75} />
            <text x={PL - 3} y={y + 3} textAnchor="end" fill={LABEL_COLOR} style={{ font: FONT }}>{v}</text>
          </g>
        )
      })}

      {/* X-axis baseline */}
      <line x1={PL} y1={PT + innerH} x2={W - PR} y2={PT + innerH} stroke={AXIS_COLOR} strokeWidth={0.75} />

      {/* X labels */}
      {xLabels.map(({ label, i }) => (
        <text
          key={label}
          x={px(i)}
          y={H - 14}
          textAnchor="middle"
          fill={LABEL_COLOR}
          style={{ font: FONT }}
        >{label}</text>
      ))}

      {/* X-axis descriptor */}
      <text
        x={PL + innerW / 2}
        y={H - 2}
        textAnchor="middle"
        fill={LABEL_COLOR}
        style={{ font: FONT }}
      >Month</text>

      {/* Y-axis descriptor */}
      <text
        x={6}
        y={PT + innerH / 2}
        textAnchor="middle"
        fill={LABEL_COLOR}
        style={{ font: FONT }}
        transform={`rotate(-90, 6, ${PT + innerH / 2})`}
      >Divisions</text>

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={COLOR}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots */}
      {vals.map((v, i) => (
        v > 0 && (
          <circle key={i} cx={px(i)} cy={py(v)} r={2.5} fill={COLOR} />
        )
      ))}
    </svg>
  )
}
