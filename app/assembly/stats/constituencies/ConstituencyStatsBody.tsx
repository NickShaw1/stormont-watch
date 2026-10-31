import { getConstituencyMlaRows } from '@/lib/db/queries/constituencies'
import { getLatestExpensesYear } from '@/lib/db/queries'
import { financialYearEnd, groupByConstituency, summarise } from '@/lib/constituencies'
import { constituencySlug } from '@/lib/utils/constituencySlug'
import { partyBorderColor } from '@/lib/format'
import type { Mandate } from '@/lib/constants/mandates'
import statsStyles from '@/app/assembly/stats/statsKit.module.css'
import ConstituencyLeague from './ConstituencyLeague'
import { withOverall, type LeagueRow } from './constituencyMetrics'

const TIED = 'color-mix(in srgb, var(--sw-text-primary) 62%, var(--tile-bg))'

export default async function ConstituencyStatsBody({ mandate, basePath }: { mandate: Mandate; basePath: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const latestFy = await getLatestExpensesYear(mandate.id)
  const rows = await getConstituencyMlaRows(mandate.id, { start: mandate.start, end: mandate.end ?? today })
  const ctx = { mandateStart: mandate.start, questionsEnd: mandate.end ?? today, expensesEnd: financialYearEnd(latestFy) }

  const base: LeagueRow[] = [...groupByConstituency(rows).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, mlas]) => {
      const current = mlas.filter((m) => m.isCurrent)
      const s = summarise(mlas, ctx)
      const counts = new Map<string, number>()
      for (const m of current) if (m.party) counts.set(m.party, (counts.get(m.party) ?? 0) + 1)
      const top = Math.max(0, ...counts.values())
      const leaders = [...counts.entries()].filter(([, n]) => n === top).map(([party]) => party)
      const leader = leaders.length === 1 ? leaders[0] : null
      return {
        name,
        slug: constituencySlug(name),
        current: current.length,
        former: s.formerCount,
        leader,
        leaderColour: leader ? partyBorderColor(leader) : TIED,
        values: {
          attendance: s.pooledAttendance,
          questions: s.questionsPerMlaMonth,
          expenses: s.expensesTotal,
          perSeat: s.currentCount > 0 ? s.expensesTotal / s.currentCount : null,
          former: s.formerCount,
          overall: null,
        },
      }
    })
  const league = withOverall(base)


  return (
    <div className={statsStyles.page}>
      <section className={`${statsStyles.band} ${statsStyles.bandPage}`} aria-labelledby="constituency-stats-title">
        <div className="container">
          <header className={statsStyles.head}>
            <span className={statsStyles.eyebrow}>Statistics</span>
            <h1 className={statsStyles.h1} id="constituency-stats-title">Constituencies</h1>
            <p className={statsStyles.headSub}>
              How the {league.length} constituencies compare on attendance, questions, expenses, MLAs who have left and a fun overall score, across the {mandate.label} mandate. Figures cover every MLA who held a seat, current and former. Choose a measure to rank them and colour the map, then select a constituency for its full page.
            </p>
          </header>
          {league.length > 0 && (
            <div className={statsStyles.tile}>
              <ConstituencyLeague rows={league} basePath={basePath} />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
