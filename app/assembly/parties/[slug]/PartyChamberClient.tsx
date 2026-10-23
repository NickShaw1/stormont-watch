'use client'

import { useMemo, useState } from 'react'
import { Landmark, TrendingUp, ListChecks, CalendarCheck, MessagesSquare } from 'lucide-react'
import { useMandate } from '@/components/MandateContext'
import m from '@/app/assembly/mlas/[id]/mlaDetail.module.css'
import ColumnChart from './ColumnChart'
import { Kpi, RankList, TileHead } from './PartyUi'
import styles from './partyDetail.module.css'

interface Props {
  hansardStats: { personId: string; fullName: string; constituency: string | null; imgUrl: string | null; sittings: number; debates: number }[]
  hansardPartyRank: { rank: number; totalParties: number; avgSittings: number } | null
  hansardPartyDebateRank: { rank: number; totalParties: number; avgDebates: number } | null
  hansardSittingsByMonth: { year: number; month: number; totalSittings: number }[]
  partyColor: string
  party: string
}

const activityScale = (rank: number, total: number) => ({ rank, total, highIsBad: false, top: 'Most', bottom: 'Fewest' })

export default function PartyChamberClient({ hansardStats, hansardPartyRank, hansardPartyDebateRank, hansardSittingsByMonth, partyColor, party }: Props) {
  const { mandate } = useMandate()

  const parsed = useMemo(() => hansardStats.map((r) => ({ ...r, sittings: Number(r.sittings), debates: Number(r.debates) })), [hansardStats])
  const [rankBy, setRankBy] = useState<'sittings' | 'debates'>('sittings')

  const bySittings = useMemo(() => [...parsed].sort((a, b) => b.sittings - a.sittings || b.debates - a.debates), [parsed])
  const byDebates = useMemo(() => [...parsed].sort((a, b) => b.debates - a.debates || b.sittings - a.sittings), [parsed])

  const mlaCount = parsed.length

  const months = useMemo(() => {
    const now = new Date()
    const spoken = new Map(hansardSittingsByMonth.map((r) => [`${r.year}-${r.month}`, r.totalSittings]))
    return Array.from({ length: 12 }, (_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1)
      const sittings = spoken.get(`${d.getFullYear()}-${d.getMonth() + 1}`) ?? 0
      const value = mlaCount > 0 ? Math.round((sittings / mlaCount) * 10) / 10 : 0
      return {
        key: `${d.getFullYear()}-${d.getMonth() + 1}`,
        label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        tick: d.toLocaleDateString('en-GB', { month: 'short' }),
        value,
        text: `${value} sittings per MLA`,
        short: String(value),
      }
    })
  }, [hansardSittingsByMonth, mlaCount])
  const monthMax = Math.max(1, ...months.map((x) => x.value))

  return (
    <div className={m.panelFlat}>
      <TileHead icon={Landmark} tone="tnIndigo" title="Chamber" panel />
      <div className={m.bento}>
        <Kpi
          icon={CalendarCheck}
          tone="tnGreen"
          label="Average sittings per current MLA"
          value={hansardPartyRank ? hansardPartyRank.avgSittings.toFixed(1) : '-'}
          sub="Plenary sittings spoken in."
          scale={hansardPartyRank ? activityScale(hansardPartyRank.rank, hansardPartyRank.totalParties) : undefined}
        />
        <Kpi
          icon={MessagesSquare}
          tone="tnCoral"
          label="Average debates per current MLA"
          value={hansardPartyDebateRank ? hansardPartyDebateRank.avgDebates.toFixed(1) : '-'}
          sub="Topics contributed to."
          scale={hansardPartyDebateRank ? activityScale(hansardPartyDebateRank.rank, hansardPartyDebateRank.totalParties) : undefined}
        />

        <section className={styles.group} aria-labelledby="month-heading">
          <div className={m.tileHead}>
            <span className={`${m.iconTile} ${m.tnBlue}`}><TrendingUp size={22} strokeWidth={2} aria-hidden="true" /></span>
            <h3 className={m.tileTitle} id="month-heading">Average sittings per MLA by month</h3>
          </div>
          <p className={styles.sectionDesc}>The average number of plenary sittings spoken in across all {party} MLAs, per month over the last 12 months.</p>
          <ColumnChart items={months} max={monthMax} colour={partyColor} ariaLabel="Average sittings per MLA by month, last 12 months" valueLabel="Average" showValues />
        </section>

        {parsed.length > 1 && (
          <section className={styles.group} aria-labelledby="chamber-rank-heading">
            <div className={m.tileHead}>
              <span className={`${m.iconTile} ${m.tnPurple}`}><ListChecks size={22} strokeWidth={2} aria-hidden="true" /></span>
              <h3 className={m.tileTitle} id="chamber-rank-heading">MLA chamber activity</h3>
              <div className={styles.segTrack} data-pos={rankBy === 'sittings' ? 0 : 1} role="group" aria-label="Rank MLAs by">
                <span className={styles.segThumb} aria-hidden="true" />
                <button type="button" className={styles.segBtn} aria-pressed={rankBy === 'sittings'} onClick={() => setRankBy('sittings')}>
                  <CalendarCheck size={18} strokeWidth={2} aria-hidden="true" />
                  Sittings
                </button>
                <button type="button" className={styles.segBtn} aria-pressed={rankBy === 'debates'} onClick={() => setRankBy('debates')}>
                  <MessagesSquare size={18} strokeWidth={2} aria-hidden="true" />
                  Topics
                </button>
              </div>
            </div>
            <p className={styles.sectionDesc}>
              {rankBy === 'sittings'
                ? `Plenary sittings spoken in since the ${mandate.label} mandate began, highest first. Presiding officers are excluded, as their role is procedural rather than representative.`
                : `Topics contributed to since the ${mandate.label} mandate began, highest first. Presiding officers are excluded, as their role is procedural rather than representative.`}
            </p>
            <RankList
              colour={partyColor}
              unit={rankBy === 'sittings' ? 'sittings' : 'topics'}
              items={(rankBy === 'sittings' ? bySittings : byDebates).map((mla) => {
                const value = rankBy === 'sittings' ? mla.sittings : mla.debates
                return {
                  personId: mla.personId,
                  fullName: mla.fullName,
                  imgUrl: mla.imgUrl,
                  constituency: mla.constituency,
                  value,
                  display: value.toLocaleString(),
                }
              })}
            />
          </section>
        )}
      </div>
    </div>
  )
}
