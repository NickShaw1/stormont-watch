'use client'

import Link from 'next/link'
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import MlaPhoto from '@/components/MlaPhoto'
import { formatMemberName, formatConstituency } from '@/lib/format'
import { useMandate } from '@/components/MandateContext'
import m from '@/app/assembly/mlas/[id]/mlaDetail.module.css'
import styles from './partyDetail.module.css'

export type Tone = 'good' | 'warn' | 'bad'

// Rank 1 is the best unless highIsBad (spending), in which case rank 1 is the worst.
export function rankTone(rank: number, total: number, highIsBad: boolean): Tone {
  const pctile = total > 1 ? (rank - 1) / (total - 1) : 0
  const tone: Tone = pctile <= 0.33 ? 'good' : pctile <= 0.66 ? 'warn' : 'bad'
  if (!highIsBad) return tone
  return tone === 'good' ? 'bad' : tone === 'bad' ? 'good' : 'warn'
}

export type KpiScale = { rank: number; total: number; highIsBad: boolean; top: string; bottom: string }

export function TileHead({ icon: IconCmp, tone, title, action, panel }: { icon: LucideIcon; tone: string; title: string; action?: ReactNode; panel?: boolean }) {
  return (
    <div className={`${m.tileHead}${panel ? ` ${m.panelHead}` : ''}`}>
      <span className={`${m.iconTile} ${m[tone]}`}><IconCmp size={22} strokeWidth={2} aria-hidden="true" /></span>
      <h3 className={m.tileTitle}>{title}</h3>
      {action}
    </div>
  )
}

export function Kpi({ icon: IconCmp, tone, label, value, sub, span, scale, big }: {
  icon: LucideIcon
  tone: string
  label: string
  value: ReactNode
  sub?: ReactNode
  span?: string
  scale?: KpiScale
  big?: boolean
}) {
  const pos = scale && scale.total > 1 ? ((scale.total - scale.rank) / (scale.total - 1)) * 100 : 100
  const rankTn = scale ? rankTone(scale.rank, scale.total, scale.highIsBad) : null
  return (
    <div className={`${m.tile} ${span ?? m.tHalf}`}>
      <div className={m.tileHead}>
        <span className={`${m.iconTile} ${m[tone]}`}><IconCmp size={22} strokeWidth={2} aria-hidden="true" /></span>
        <span className={m.tileLabel}>{label}</span>
      </div>
      <div className={m.kpiStack}>
        <div className={`${m.kpiTop} ${styles.kpiTopAligned}`}>
          <span className={`${m.figValue}${big ? ` ${styles.figBig}` : ''}`}>{value}</span>
          {scale && rankTn && (
            <span className={m.kpiRank}>
              <span className={m.kpiRankLabel}>Rank</span>
              <span className={`${m.kpiRankNum} ${m[`tone_${rankTn}`]}`}>{scale.rank}<small>/{scale.total}</small></span>
            </span>
          )}
        </div>
        {sub && <p className={m.kpiSub}>{sub}</p>}
        {scale && rankTn && (
          <div className={m.hScale}>
            <span className={`${m.hTrack} ${styles.scaleVisual}`} data-scale={scale.highIsBad ? 'bad-right' : 'good-right'} aria-hidden="true">
              <span className={m.hMark} data-tone={rankTn} style={{ left: `${pos}%` }} />
            </span>
            <span className={`${m.hEnds} ${styles.scaleVisual}`} aria-hidden="true">
              <span>{scale.bottom}</span>
              <span>{scale.top}</span>
            </span>
            <span className="sr-only">Ranked {scale.rank} of {scale.total}, between {scale.bottom.toLowerCase()} and {scale.top.toLowerCase()}</span>
          </div>
        )}
      </div>
    </div>
  )
}

type PersonCardProps = {
  personId: string
  fullName: string
  imgUrl: string | null
  constituency: string | null
  role?: string | null
  title?: string | null
  aside?: ReactNode
  asideLabel?: string
}

// A whole-card link in the MLAs-page row layout. The optional title (department or committee) sits above.
export function PersonCard({ personId, fullName, imgUrl, constituency, role, title, aside, asideLabel }: PersonCardProps) {
  const { basePath } = useMandate()
  return (
    <li className={`${styles.row}${title ? ` ${styles.unit}` : ''}`}>
      {title && <p className={styles.unitTitle}>{title}</p>}
      <div className={styles.person}>
        <div className={styles.photo}>
          <MlaPhoto name={fullName} imgUrl={imgUrl ?? ''} size={128} decorative square personId={personId} />
        </div>
        <div className={styles.info}>
          <Link href={`${basePath}/assembly/mlas/${personId}`} className={styles.name} aria-label={`View profile for ${formatMemberName(fullName)}`}>
            {formatMemberName(fullName)}
          </Link>
          {constituency && <span className={styles.constituency}>{formatConstituency(constituency)}</span>}
          {role && <span className={styles.tags}><span className={styles.rolePill}>{role}</span></span>}
        </div>
        {aside && <div className={styles.att} data-grade={asideLabel}>{aside}</div>}
      </div>
      <ArrowRight className={styles.arrow} size={18} strokeWidth={2} aria-hidden="true" />
    </li>
  )
}

type StatRowProps = {
  personId: string
  fullName: string
  imgUrl: string | null
  constituency: string | null
  value: string
  sub?: string
  former?: boolean
  label: string
  tone: 'good' | 'bad' | 'neutral' | 'party'
  barPct?: number
  colour?: string
}

// A spotlight card for a "highest" or "lowest" MLA: tinted by tone, big photo, the figure in the tone colour and a bar.
export function StatRow({ personId, fullName, imgUrl, constituency, value, sub, label, tone, barPct, colour }: StatRowProps) {
  const { basePath } = useMandate()
  const up = /^(Highest|Most)$/i.test(label)
  const down = /^(Lowest|Fewest)$/i.test(label)
  const width = Math.max(0, Math.min(100, barPct ?? 0))
  return (
    <Link href={`${basePath}/assembly/mlas/${personId}`} className={styles.spot} data-tone={tone} style={colour ? ({ '--party': colour } as CSSProperties) : undefined}>
      <span className={styles.spotPhoto}>
        <MlaPhoto name={fullName} imgUrl={imgUrl ?? ''} size={160} decorative square personId={personId} />
      </span>
      <span className={styles.spotMain}>
        <span className={styles.spotLabel}>
          {up && <TrendingUp size={14} strokeWidth={2.5} aria-hidden="true" />}
          {down && <TrendingDown size={14} strokeWidth={2.5} aria-hidden="true" />}
          {label}
        </span>
        <span className={styles.spotName}>{formatMemberName(fullName)}</span>
        <span className={styles.spotPlace}>
          {constituency && <span className={styles.constituency}>{formatConstituency(constituency)}</span>}
        </span>
        <span className={styles.spotFigures}>
          <span className={styles.spotFigure}>{value}</span>
          {sub && <span className={styles.spotSub}>{sub}</span>}
        </span>
        {barPct !== undefined && (
          <span className={styles.spotTrack} aria-hidden="true">
            <span className={styles.spotFill} style={{ width: `${width}%` }} />
          </span>
        )}
      </span>
      <ArrowRight className={styles.spotArrow} size={18} strokeWidth={2} aria-hidden="true" />
    </Link>
  )
}

type RankRowProps = {
  rank: number
  personId: string
  fullName: string
  imgUrl: string | null
  constituency: string | null
  value: string
  unit?: string
  former?: boolean
  colour: string
}

// A compact ranked row for places four and below: rank, photo, name, and the value in a party-tinted pill.
export function RankRow({ rank, personId, fullName, imgUrl, constituency, value, unit, colour }: RankRowProps) {
  const { basePath } = useMandate()
  return (
    <li>
      <Link href={`${basePath}/assembly/mlas/${personId}`} className={styles.rankCard} style={{ '--party': colour } as CSSProperties}>
        <span className={styles.rankNum}><span className="sr-only">Rank </span>{rank}</span>
        <span className={styles.rankPhoto}>
          <MlaPhoto name={fullName} imgUrl={imgUrl ?? ''} size={96} decorative square personId={personId} />
        </span>
        <span className={styles.rankMain}>
          <span className={styles.rankName}>{formatMemberName(fullName)}</span>
          <span className={styles.rankMeta}>
            {constituency && <span className={styles.constituency}>{formatConstituency(constituency)}</span>}
          </span>
        </span>
        <span className={styles.rankPill}>{value}{unit && <span className={styles.rankUnit}> {unit}</span>}</span>
        <ArrowRight className={styles.rankArrow} size={18} strokeWidth={2} aria-hidden="true" />
      </Link>
    </li>
  )
}

export type RankItem = {
  personId: string
  fullName: string
  imgUrl: string | null
  constituency: string | null
  value: number
  display: string
  former?: boolean
}

const ORDINALS = ['1st', '2nd', '3rd']

// A leaderboard: the top three as spotlight cards, everyone else as compact rows.
export function RankList({ items, colour, unit }: { items: RankItem[]; colour: string; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  const podium = items.slice(0, 3)
  const rest = items.slice(3)
  const row = (it: RankItem, rank: number) => (
    <RankRow
      key={it.personId}
      rank={rank}
      personId={it.personId}
      fullName={it.fullName}
      imgUrl={it.imgUrl}
      constituency={it.constituency}
      value={it.display}
      unit={unit}
      former={it.former}
      colour={colour}
    />
  )
  return (
    <>
      <ol className={styles.rankListPhone}>{items.map((it, i) => row(it, i + 1))}</ol>
      <ol className={styles.podium}>
        {podium.map((it, i) => (
          <li key={it.personId}>
            <StatRow
              personId={it.personId}
              fullName={it.fullName}
              imgUrl={it.imgUrl}
              constituency={it.constituency}
              former={it.former}
              value={it.display}
              sub={unit}
              label={ORDINALS[i]}
              tone="party"
              colour={colour}
              barPct={(it.value / max) * 100}
            />
          </li>
        ))}
      </ol>
      {rest.length > 0 && (
        <ol className={`${styles.rankList} ${styles.rankListRest}`} start={4}>
          {rest.map((it, i) => (
            <RankRow
              key={it.personId}
              rank={i + 4}
              personId={it.personId}
              fullName={it.fullName}
              imgUrl={it.imgUrl}
              constituency={it.constituency}
              value={it.display}
              unit={unit}
              former={it.former}
              colour={colour}
            />
          ))}
        </ol>
      )}
    </>
  )
}
