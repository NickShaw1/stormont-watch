import { buildSeats, H, SR, VIEW_TOP, VIEW_W, VIEW_X, type HemicycleParty } from '@/lib/hemicycle'

export default function HeadArt({ parties, className }: { parties: HemicycleParty[]; className?: string }) {
  const seats = buildSeats(parties)
  return (
    <svg className={className} viewBox={`${VIEW_X} ${VIEW_TOP} ${VIEW_W} ${H - VIEW_TOP}`} aria-hidden="true" focusable="false">
      {seats.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={SR} fill={s.color} opacity="0.95" />
      ))}
    </svg>
  )
}
