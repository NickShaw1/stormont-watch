'use client'

import { PoundSterling, Wallet, Users, MapPin, ListChecks } from 'lucide-react'
import { gbp } from '@/lib/format'
import type { PartyExpenseStats, PartyMandateMlaExpense } from '@/lib/db/queries'
import { useMandate } from '@/components/MandateContext'
import m from '@/app/assembly/mlas/[id]/mlaDetail.module.css'
import { Kpi, RankList, TileHead, rankTone } from './PartyUi'
import styles from './partyDetail.module.css'

interface PartyExpensesProps {
  expenses: PartyExpenseStats
  mandateExpenses: { mandateTotal: number; mandateAvgPerMla: number; mlaCount: number; rankTotal: number; rankAvg: number; partyCount: number } | null
  mandateMlas: PartyMandateMlaExpense[]
  partyColor: string
}

// Rank 1 is the highest spend, so a high rank reads as the worst end of the scale, as on the MLA pages.
const spendScale = (rank: number, total: number) => ({ rank, total, highIsBad: true, top: 'Highest', bottom: 'Lowest' })

const ordinal = (n: number) => {
  const v = n % 100
  const suffix = ['th', 'st', 'nd', 'rd']
  return `${n}${suffix[(v - 20) % 10] || suffix[v] || suffix[0]}`
}

const spendRank = (rank: number, total: number) => (rank === 1 ? `Highest of ${total} parties` : `${ordinal(rank)} highest of ${total} parties`)

function Rank({ rank, total, tone, spoken }: { rank: number; total: number; tone?: 'good' | 'warn' | 'bad'; spoken: string }) {
  return (
    <span className={m.kpiRank}>
      <span className={m.kpiRankLabel} aria-hidden="true">Rank</span>
      <span className={`${m.kpiRankNum}${tone ? ` ${m[`tone_${tone}`]}` : ''}`} aria-hidden="true">{rank}<small>/{total}</small></span>
      <span className="sr-only">{spoken}</span>
    </span>
  )
}

export default function PartyExpensesClient({ expenses, mandateExpenses, mandateMlas, partyColor }: PartyExpensesProps) {
  const { mandate } = useMandate()
  const list = mandateMlas.length > 0 ? mandateMlas : []

  const totalTone = rankTone(expenses.rankTotal, expenses.partyCount, true)
  const avgTone = rankTone(expenses.rankAvg, expenses.partyCount, true)
  const visitsTone = rankTone(expenses.rankVisits, expenses.partyCount, true)

  return (
    <div className={m.panelFlat}>
      <TileHead icon={Wallet} tone="tnGreen" title="Expenses" panel />
      <div className={m.bento}>
        {mandateExpenses && (
          <>
            <Kpi
              big
              icon={Wallet}
              tone="tnGreen"
              label={`Total claimed, ${mandate.startLabel} to present`}
              value={gbp(mandateExpenses.mandateTotal)}
              sub="All published years."
              scale={spendScale(mandateExpenses.rankTotal, mandateExpenses.partyCount)}
            />
            <Kpi
              big
              icon={Users}
              tone="tnBlue"
              label="Average per MLA this mandate"
              value={gbp(mandateExpenses.mandateAvgPerMla)}
              sub={`Across ${mandateExpenses.mlaCount} MLA${mandateExpenses.mlaCount !== 1 ? 's' : ''} (current and former) with published data.`}
              scale={spendScale(mandateExpenses.rankAvg, mandateExpenses.partyCount)}
            />
          </>
        )}

        <section className={styles.group} aria-labelledby="exp-year-heading">
          <div className={m.tileHead}>
            <span className={`${m.iconTile} ${m.tnTeal}`}><PoundSterling size={22} strokeWidth={2} aria-hidden="true" /></span>
            <h3 className={m.tileTitle} id="exp-year-heading">Latest published year</h3>
          </div>
          <p className={styles.sectionDesc}>All claims for {expenses.period}, with the party&apos;s position among all {expenses.partyCount} parties. The average is per MLA who claimed.</p>
          <div className={styles.yearCells}>
            <div className={styles.yearCell}>
              <div className={m.tileHead}>
                <span className={`${m.iconTile} ${m.tnTeal}`}><PoundSterling size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={m.tileLabel}>Total expenses</span>
              </div>
              <div className={`${m.kpiTop} ${styles.kpiTopAligned}`}>
                <span className={styles.yearFigure}>{gbp(expenses.partyTotal)}</span>
                <Rank rank={expenses.rankTotal} total={expenses.partyCount} tone={totalTone} spoken={spendRank(expenses.rankTotal, expenses.partyCount)} />
              </div>
            </div>

            <div className={styles.yearCell}>
              <div className={m.tileHead}>
                <span className={`${m.iconTile} ${m.tnPurple}`}><Users size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={m.tileLabel}>Average per MLA</span>
              </div>
              <div className={`${m.kpiTop} ${styles.kpiTopAligned}`}>
                <span className={styles.yearFigure}>{gbp(expenses.avgPerMla)}</span>
                <Rank rank={expenses.rankAvg} total={expenses.partyCount} tone={avgTone} spoken={spendRank(expenses.rankAvg, expenses.partyCount)} />
              </div>
            </div>

          </div>
        </section>

        <section className={styles.group} aria-labelledby="exp-visits-heading">
          <div className={m.tileHead}>
            <span className={`${m.iconTile} ${m.tnCoral}`}><MapPin size={22} strokeWidth={2} aria-hidden="true" /></span>
            <h3 className={m.tileTitle} id="exp-visits-heading">Declared visits</h3>
          </div>
          <p className={styles.sectionDesc}>Visits declared on the Register of Interests since {mandate.startLabel}, with the party&apos;s position among all {expenses.partyCount} parties. This counts the whole mandate, not only the latest year.</p>
          <div className={styles.yearCells}>
            <div className={styles.yearCell}>
              <div className={m.tileHead}>
                <span className={`${m.iconTile} ${m.tnCoral}`}><MapPin size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={m.tileLabel}>Visits declared</span>
              </div>
              <div className={`${m.kpiTop} ${styles.kpiTopAligned}`}>
                <span className={styles.yearFigure}>{expenses.visitCount}</span>
                {expenses.visitCount === 0
                  ? <span className={m.kpiSub}>None declared</span>
                  : <Rank rank={expenses.rankVisits} total={expenses.partyCount} tone={visitsTone} spoken={`${ordinal(expenses.rankVisits)} of ${expenses.partyCount} parties`} />}
              </div>
            </div>
          </div>
        </section>

        {list.length > 0 && (
          <section className={styles.group} aria-labelledby="exp-rank-heading">
            <div className={m.tileHead}>
              <span className={`${m.iconTile} ${m.tnPurple}`}><ListChecks size={22} strokeWidth={2} aria-hidden="true" /></span>
              <h3 className={m.tileTitle} id="exp-rank-heading">MLA expenses, ranked highest to lowest</h3>
            </div>
            <p className={styles.sectionDesc}>All current and former {list.length} MLAs who claimed expenses since the mandate began in {mandate.startLabel}, ranked by the total claimed over the whole mandate.</p>
            <RankList
              colour={partyColor}
              items={list.map((mla) => ({
                personId: mla.personId,
                fullName: mla.fullName,
                imgUrl: mla.imgUrl,
                constituency: mla.constituency,
                value: mla.total,
                display: gbp(mla.total),
                former: !mla.isCurrent,
              }))}
            />
          </section>
        )}
      </div>
    </div>
  )
}
