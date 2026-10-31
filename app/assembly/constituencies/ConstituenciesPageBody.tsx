import { getConstituencyMlaRows, getExpenseYearRows, getMonthlyAttendanceRows, getMonthlyQuestionRows } from '@/lib/db/queries/constituencies'
import { getAverageAttendance, getLatestExpensesYear } from '@/lib/db/queries'
import { sittingAdjective, type Mandate } from '@/lib/constants/mandates'
import { attendanceFloor, gradeAttendance } from '@/lib/attendance'
import { attendancePct, attendanceTrend, financialYearEnd, groupByConstituency, MIN_QUESTION_MONTHS, monthsInOffice, previousFinancialYear as previousYear, questionTrend, recentMonths, roundedPct, shortFinancialYear as shortYear, summarise, type ConstituencyMla, type ExpenseYearRow } from '@/lib/constituencies'
import { constituencySlug } from '@/lib/utils/constituencySlug'
import { loadConstituencyGeo } from '@/lib/constituencyGeo'
import { orderedParties } from '@/lib/format'
import ConstituencyExplorer, { type ExplorerAssembly, type ExplorerCard } from './ConstituencyExplorer'
import statsStyles from '@/app/assembly/stats/statsKit.module.css'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const monthYear = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${iso.slice(0, 4)}`

const yearsOf = (mlas: ConstituencyMla[], rows: ExpenseYearRow[], latest: string, prior: string) => {
  const ids = new Set(mlas.map((m) => m.personId))
  const sum = (fy: string) => rows.filter((r) => r.financialYear === fy && ids.has(r.personId)).reduce((acc, r) => acc + r.total, 0)
  return { latest: sum(latest), prior: sum(prior) }
}

const basisOf = (all: ConstituencyMla[], s: ReturnType<typeof summarise>) => ({
  mlas: all.length,
  expenseMlas: all.filter((m) => m.expenses !== null).length,
  questions: s.questionsCounted,
  questionMlas: s.questionMlaCount,
  questionMonths: s.questionMonthTotal,
  present: s.presentVotes,
  possible: s.possibleVotes,
})

export default async function ConstituenciesPageBody({ mandate, basePath }: { mandate: Mandate; basePath: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const months = recentMonths(mandate.end ?? today)
  const latestFy = await getLatestExpensesYear(mandate.id)
  const priorFy = previousYear(latestFy)
  const [rows, averageAttendance, monthlyAttendance, monthlyQuestions, yearRows] = await Promise.all([
    getConstituencyMlaRows(mandate.id, { start: mandate.start, end: mandate.end ?? today }),
    getAverageAttendance(mandate.id),
    getMonthlyAttendanceRows(mandate.id, months[0].start),
    getMonthlyQuestionRows(mandate.id, months[0].start),
    getExpenseYearRows(mandate.id, priorFy ? [latestFy, priorFy] : [latestFy]),
  ])
  const adjective = sittingAdjective(mandate)
  const expensesEnd = financialYearEnd(latestFy)
  const ctx = { mandateStart: mandate.start, questionsEnd: mandate.end ?? today, expensesEnd }
  const expensesThrough = expensesEnd ? `${MONTHS[Number(expensesEnd.slice(5, 7)) - 1]} ${expensesEnd.slice(0, 4)}` : null

  const floor = attendanceFloor(
    rows.filter((r) => r.isCurrent).map((r) => ({ assembly_role: r.assemblyRole, assembly_role_end: r.assemblyRoleEnd, attendance_pct: roundedPct(r) })),
    averageAttendance,
  )

  const cards: ExplorerCard[] = [...groupByConstituency(rows).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, mlas]) => {
      const current = mlas.filter((m) => m.isCurrent)
      const summary = summarise(mlas, ctx)
      return {
        name,
        slug: constituencySlug(name),
        current: current.length,
        former: mlas.length - current.length,
        parties: orderedParties(current).map((party) => ({ party, seats: current.filter((m) => m.party === party).length })),
        mlas: [
          ...current.sort((a, b) => a.fullName.localeCompare(b.fullName)),
          ...mlas.filter((m) => !m.isCurrent).sort((a, b) => (b.mandateEnd ?? '').localeCompare(a.mandateEnd ?? '')),
        ].map((m) => {
          return {
            personId: m.personId,
            name: m.fullName,
            party: m.party,
            current: m.isCurrent,
            imgUrl: m.imgUrl,
            attendance: attendancePct(m),
            questions: m.questionMonths >= MIN_QUESTION_MONTHS ? m.questionCount / m.questionMonths : null,
            expenses: m.expenses,
            served: `${m.mandateStart && m.mandateStart > mandate.start ? monthYear(m.mandateStart) : mandate.startLabel}${m.mandateEnd ? ` to ${monthYear(m.mandateEnd)}` : ''}`,
            leftOn: m.mandateEnd,
            expenseMonths: expensesEnd && m.expenses !== null ? Math.round(monthsInOffice(m, ctx.mandateStart, expensesEnd) * 10) / 10 : 0,
            present: m.present,
            possible: m.total,
            tenure: m.mandateEnd
              ? `Left ${monthYear(m.mandateEnd)}`
              : m.mandateStart && m.mandateStart > mandate.start
                ? `Since ${monthYear(m.mandateStart)}`
                : `Since ${mandate.startLabel}`,
          }
        }),
        attendance: summary.pooledAttendance,
        grade: summary.pooledAttendance === null ? null : gradeAttendance(summary.pooledAttendance, averageAttendance, floor),
        questions: summary.questionsPerMlaMonth,
        expenses: summary.expensesTotal,
        basis: basisOf(mlas, summary),
        trend: {
          attendance: attendanceTrend(months, monthlyAttendance, mlas, 'pooled'),
          questions: questionTrend(months, monthlyQuestions, mlas, ctx.questionsEnd),
        },
        expenseYears: priorFy ? yearsOf(mlas, yearRows, latestFy, priorFy) : null,
      }
    })

  const geo = loadConstituencyGeo()
  const all = summarise(rows, ctx)
  const assembly: ExplorerAssembly = {
    constituencies: cards.length,
    seats: cards.reduce((a, c) => a + c.current, 0),
    former: cards.reduce((a, c) => a + c.former, 0),
    attendance: all.pooledAttendance,
    questions: all.questionsPerMlaMonth,
    expenses: all.expensesTotal,
    basis: basisOf(rows, all),
    trend: {
      attendance: attendanceTrend(months, monthlyAttendance, rows, 'currentMean'),
      questions: questionTrend(months, monthlyQuestions, rows, ctx.questionsEnd),
    },
    expenseYears: priorFy ? yearsOf(rows, yearRows, latestFy, priorFy) : null,
    expenseYearLabels: priorFy ? { latest: shortYear(latestFy), prior: shortYear(priorFy) } : null,
    recentFrom: months[0].start,
    priorFrom: recentMonths(months[0].start, 7)[0].start,
  }

  return (
    <div className={statsStyles.page}>
      {geo && (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
          <defs>
            {geo.regions.map((r) => (
              <path key={r.slug} id={`nir-${r.slug}`} d={r.d} />
            ))}
            <g id="nir-all">
              {geo.regions.map((r) => (
                <use key={r.slug} href={`#nir-${r.slug}`} />
              ))}
            </g>
          </defs>
        </svg>
      )}
      <ConstituencyExplorer
        basePath={basePath}
        adjective={adjective}
        mandateLabel={mandate.label}
        expensesThrough={expensesThrough}
        attendanceBands={{ average: averageAttendance, floor }}
        cards={cards}
        assembly={assembly}
        geoSize={geo ? { width: geo.width, height: geo.height } : null}
      />
    </div>
  )
}
