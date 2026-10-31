'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Gauge, MessageCircleQuestion, PoundSterling, Repeat, Trophy, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import SheetSelect, { type SheetOption } from '@/app/assembly/mlas/[id]/SheetSelect'
import ConstituencyMapLink from '@/app/assembly/constituencies/ConstituencyMapLink'
import statsStyles from '@/app/assembly/stats/statsKit.module.css'
import { displayParty } from '@/lib/format'
import { METRIC_KEYS, METRIC_META, rankRows, type LeagueRow, type MetricKey } from './constituencyMetrics'
import styles from './constituencyStats.module.css'

const LOOK: Record<MetricKey, { Icon: LucideIcon; tone: string; color: string }> = {
  attendance: { Icon: Gauge, tone: statsStyles.tnGreen, color: 'var(--sw-success-solid)' },
  questions: { Icon: MessageCircleQuestion, tone: statsStyles.tnPurple, color: '#8b5cf6' },
  expenses: { Icon: PoundSterling, tone: statsStyles.tnAmber, color: 'var(--sw-accent-warm)' },
  perSeat: { Icon: Wallet, tone: statsStyles.tnIndigo, color: '#6366f1' },
  former: { Icon: Repeat, tone: statsStyles.tnGrey, color: '#656b72' },
  overall: { Icon: Trophy, tone: statsStyles.tnPink, color: '#ec4899' },
}

const FILL = { good: 'var(--sw-success-solid)', warn: 'var(--sw-accent-warm)', bad: 'var(--sw-error-solid)' } as const
const INK = { good: 'var(--band-ink-strong)', warn: 'var(--band-ink-amber)', bad: 'var(--band-ink-strong)' } as const
const NO_DATA = 'color-mix(in srgb, var(--sw-text-primary) 22%, var(--tile-bg))'

export default function ConstituencyLeague({ rows, basePath }: { rows: LeagueRow[]; basePath: string }) {
  const [metric, setMetric] = useState<MetricKey>('attendance')
  const [hover, setHover] = useState<string | null>(null)
  const meta = METRIC_META[metric]
  const look = LOOK[metric]
  const ranked = useMemo(() => rankRows(rows, metric), [rows, metric])
  const top = Math.max(0, ...ranked.map((r) => r.value ?? 0))
  const withValue = ranked.filter((r) => r.value !== null)
  const highest = withValue[0]
  const lowest = withValue[withValue.length - 1]

  const { fills, labelColors } = useMemo(() => {
    const f: Record<string, string> = {}
    const l: Record<string, string> = {}
    for (const r of ranked) {
      if (r.value === null) {
        f[r.row.name] = NO_DATA
      } else if (r.tone) {
        f[r.row.name] = FILL[r.tone]
        l[r.row.name] = INK[r.tone]
      } else {
        const t = top > 0 ? r.value / top : 0
        f[r.row.name] = `color-mix(in srgb, var(--sw-text-secondary) ${Math.round(14 + t * 62)}%, var(--tile-bg))`
        if (t >= 0.55) l[r.row.name] = 'var(--band-ink-strong)'
      }
    }
    return { fills: f, labelColors: l }
  }, [ranked, top])

  const bands = useMemo(() => {
    const counts = { good: 0, warn: 0, bad: 0 }
    for (const r of ranked) if (r.tone) counts[r.tone] += 1
    return counts
  }, [ranked])

  const options = useMemo<SheetOption[]>(
    () => METRIC_KEYS.map((k) => ({ key: k, label: METRIC_META[k].label, icon: LOOK[k].Icon, meta: '', color: LOOK[k].color })),
    [],
  )

  const bandWords = meta.highIsBad
    ? { good: 'Lowest', warn: 'Middle', bad: 'Highest' }
    : { good: 'Top', warn: 'Middle', bad: 'Bottom' }

  return (
    <div className={styles.league}>
      <div className={styles.tabsOnly}>
        <div className={statsStyles.tabs} role="group" aria-label="Rank constituencies by">
          {METRIC_KEYS.map((k) => (
            <button key={k} type="button" className={statsStyles.tabBtn} aria-pressed={metric === k} onClick={() => setMetric(k)}>{METRIC_META[k].label}</button>
          ))}
        </div>
      </div>
      <div className={styles.phoneSelect}>
        <SheetSelect options={options} value={metric} onPick={(key) => setMetric(key as MetricKey)} eyebrow="Rank by" title="Measure" headIcon={look.Icon} hideTriggerMeta />
      </div>

      <div className={styles.stage}>
        <div className={styles.side} role="group" aria-label={`Map of ${meta.label.toLowerCase()}`}>
          <div className={styles.mapPanel}>
            <div className={styles.mapHead}>
              <span className={`${statsStyles.iconTile} ${look.tone}`}><look.Icon size={22} strokeWidth={2} aria-hidden="true" /></span>
              <span className={styles.mapTitle}>{meta.label}</span>
            </div>
            <div className={styles.mapNotes}>
              {meta.blurb.split('\n').map((t) => <p key={t} className={styles.mapNote}>{t}</p>)}
            </div>
            <div className={styles.mapWrap}>
              <ConstituencyMapLink basePath={basePath} fills={fills} labelColors={labelColors} highlighted={hover} onHover={setHover} />
            </div>
            {meta.highIsBad === null ? (
              <div className={styles.scale} aria-hidden="true">
                <span>Fewer</span>
                <span className={styles.scaleBar} />
                <span>More</span>
              </div>
            ) : (
              <ul className={styles.keyList} aria-label="Map key">
                {(['good', 'warn', 'bad'] as const).map((t) => (
                  <li key={t} className={styles.keyItem}>
                    <i style={{ background: FILL[t] }} aria-hidden="true" />
                    <span>{bandWords[t]}<span className={styles.third}> third</span></span>
                    <b>{bands[t]}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {highest && lowest && (
            <ul className={styles.callouts} aria-label={`Highest and lowest ${meta.label.toLowerCase()}`}>
              {[{ label: 'Highest', r: highest }, { label: 'Lowest', r: lowest }].map(({ label, r }) => (
                <li key={label}>
                  <Link href={`${basePath}/assembly/constituencies/${r.row.slug}`} className={styles.callout}>
                    <span className={styles.calloutLabel}>{label}</span>
                    <span className={styles.calloutName}>{r.row.name}</span>
                    <span className={styles.calloutValue} data-tone={r.tone}>
                      {meta.format(r.value as number)}
                      <small>{meta.unit(r.value as number)}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ol className={`${styles.list} ${look.tone}`} aria-label={`Constituencies ranked by ${meta.label.toLowerCase()}`}>
          {ranked.map(({ row, value, rank, of, tone }) => (
            <li
              key={row.slug}
              className={styles.row}
              data-hover={hover === row.name ? '' : undefined}
              onMouseEnter={() => setHover(row.name)}
              onMouseLeave={() => setHover(null)}
            >
              <span className={styles.rank} data-tone={tone}>
                {rank ?? <span aria-hidden="true">-</span>}
                <span className="sr-only">{rank ? ` of ${of}` : 'Not ranked'}</span>
              </span>
              <span className={styles.who}>
                <Link
                  href={`${basePath}/assembly/constituencies/${row.slug}`}
                  className={styles.name}
                  onFocus={() => setHover(row.name)}
                  onBlur={() => setHover(null)}
                >
                  {row.name}
                </Link>
                <span className={styles.sub}>
                  {row.leader ? <><i style={{ background: row.leaderColour }} aria-hidden="true" />{displayParty(row.leader)} largest</> : <><i style={{ background: row.leaderColour }} aria-hidden="true" />Largest parties tied</>}
                </span>
              </span>
              <span className={styles.track} aria-hidden="true">
                {value !== null && top > 0 && <i style={{ width: `${Math.max(2, (value / top) * 100)}%` }} />}
              </span>
              <span className={styles.value}>
                {value === null ? <span className={styles.muted}>n/a</span> : meta.format(value)}
                {value !== null && <small>{meta.unit(value)}</small>}
              </span>
              <ArrowRight className={styles.arrow} size={18} strokeWidth={2} aria-hidden="true" />
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
