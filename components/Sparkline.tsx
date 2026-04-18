interface SparklineProps {
  data: number[]
  color?: string
  height?: number
}

export default function Sparkline({ data, color = '#0D9488', height = 60 }: SparklineProps) {
  if (!data || data.length < 2) return null

  const W = 200
  const H = height
  const padX = 1
  const padY = 4

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const pts = data.map((v, i) => ({
    x: padX + (i / (data.length - 1)) * (W - padX * 2),
    y: padY + (H - padY * 2) - ((v - min) / range) * (H - padY * 2),
  }))

  const linePath = `M ${pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ')}`

  const areaPoints = [
    `${pts[0].x.toFixed(2)},${H}`,
    ...pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`),
    `${pts[pts.length - 1].x.toFixed(2)},${H}`,
  ].join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height={H}
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <polygon points={areaPoints} fill={color} fillOpacity={0.12} />
      <path
        d={linePath}
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
