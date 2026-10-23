'use client'

import { useMemo } from 'react'
import { MessageCircleQuestion, FileText, Mic, TrendingUp, ListChecks } from 'lucide-react'
import { useMandate } from '@/components/MandateContext'
import m from '@/app/assembly/mlas/[id]/mlaDetail.module.css'
import ColumnChart from './ColumnChart'
import { Kpi, RankList, TileHead } from './PartyUi'
import styles from './partyDetail.module.css'

type QuestionStatRow = { personId: string; year: number; month: number; writtenCount: number; oralCount: number }
type QuestionRankingRow = {
  personId: string
  fullName: string
  imgUrl: string | null
  constituency: string | null
  isCurrent: boolean
  total: number
}

interface Props {
  totalQuestions: number
  writtenCount: number
  oralCount: number
  questionStats: QuestionStatRow[]
  questionRanking: QuestionRankingRow[]
  partyColor: string
}

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

export default function PartyQuestionsClient({ totalQuestions, writtenCount, oralCount, questionStats, questionRanking, partyColor }: Props) {
  const { mandate } = useMandate()

  const years = useMemo(() => {
    const totals = new Map<number, number>()
    for (const r of questionStats) totals.set(r.year, (totals.get(r.year) ?? 0) + r.writtenCount + r.oralCount)
    if (totals.size === 0) return []
    const first = Math.min(...totals.keys())
    const last = Math.max(...totals.keys())
    return Array.from({ length: last - first + 1 }, (_, i) => {
      const year = first + i
      const value = totals.get(year)
      return {
        key: String(year),
        label: String(year),
        tick: String(year),
        value: value ?? 0,
        text: value === undefined ? 'No questions recorded' : `${value.toLocaleString()} questions`,
        short: value === undefined ? '' : value.toLocaleString(),
      }
    })
  }, [questionStats])
  const yearMax = Math.max(1, ...years.map((y) => y.value))

  return (
    <div className={m.panelFlat}>
      <TileHead icon={MessageCircleQuestion} tone="tnPurple" title="Questions" panel />
      <div className={m.bento}>
        <Kpi icon={MessageCircleQuestion} tone="tnPurple" label="Total questions" value={totalQuestions.toLocaleString()} sub={`Since ${mandate.start.slice(0, 4)}.`} span={`${m.tThird} ${styles.kpi3}`} />
        <Kpi icon={FileText} tone="tnAmber" label="Written" value={writtenCount.toLocaleString()} sub={`${pct(writtenCount, totalQuestions)}% of total.`} span={`${m.tThird} ${styles.kpi3}`} />
        <Kpi icon={Mic} tone="tnTeal" label="Oral" value={oralCount.toLocaleString()} sub={`${pct(oralCount, totalQuestions)}% of total.`} span={`${m.tThird} ${styles.kpi3}`} />

        <section className={styles.group} aria-labelledby="q-year-heading">
          <div className={m.tileHead}>
            <span className={`${m.iconTile} ${m.tnBlue}`}><TrendingUp size={22} strokeWidth={2} aria-hidden="true" /></span>
            <h3 className={m.tileTitle} id="q-year-heading">Questions by year</h3>
          </div>
          <p className={styles.sectionDesc}>Total written and oral questions submitted to ministers each year since the mandate began in {mandate.startLabel}.</p>
          <ColumnChart items={years} max={yearMax} colour={partyColor} ariaLabel="Questions by year" valueLabel="Questions" showValues />
        </section>

        {questionRanking.length > 0 && (
          <section className={styles.group} aria-labelledby="q-rank-heading">
            <div className={m.tileHead}>
              <span className={`${m.iconTile} ${m.tnIndigo}`}><ListChecks size={22} strokeWidth={2} aria-hidden="true" /></span>
              <h3 className={m.tileTitle} id="q-rank-heading">MLA questions ranking</h3>
            </div>
            <p className={styles.sectionDesc}>Each MLA&apos;s written and oral questions since the mandate began in {mandate.startLabel}, current and former members together.</p>
            <RankList
              colour={partyColor}
              unit="questions"
              items={questionRanking.map((mla) => ({
                personId: mla.personId,
                fullName: mla.fullName,
                imgUrl: mla.imgUrl,
                constituency: mla.constituency,
                value: mla.total,
                display: mla.total.toLocaleString(),
                former: !mla.isCurrent,
              }))}
            />
          </section>
        )}
      </div>
    </div>
  )
}
