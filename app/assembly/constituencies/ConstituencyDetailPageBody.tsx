import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Banknote, CalendarDays, Gauge, Landmark, MessageCircleQuestion, PoundSterling, Repeat, UserMinus, Users, Wallet } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import LineChart, { type LineItem } from '@/app/assembly/parties/[slug]/LineChart'
import { getConstituencyMlaRows, getExpenseYearRows, getFamilyEmployedIds, getMonthlyAttendanceRows, getMonthlyQuestionRows } from '@/lib/db/queries/constituencies'
import { getAllCommitteeChairs, getAllMemberRoleHistories, getAllMembers, getAllMinisters, getAverageAttendance, getLatestExpensesYear } from '@/lib/db/queries'
import { apiRoleToSalaryRole, calculateMandateEarnings, getCurrentAnnualSalary, salaryRatesPublished, type RoleInterval } from '@/lib/salaries'
import { sittingAdjective, type Mandate } from '@/lib/constants/mandates'
import { attendanceFloor, gradeAttendance, type AttendanceGrade } from '@/lib/attendance'
import {
  attendancePct,
  attendanceTrend,
  financialYearEnd,
  findConstituency,
  groupByConstituency,
  isQuestionEligible,
  isServingSpeaker,
  MIN_EXPENSE_MONTHS,
  MIN_QUESTION_MONTHS,
  MIN_SITTING_QUESTIONS,
  mlaFigures,
  monthsInOffice,
  ordinal,
  questionTrend,
  rankIn,
  rankTone,
  recentMonths,
  roundedPct,
  shortFinancialYear,
  summarise,
  type ConstituencyMla,
  type ConstituencySummary,
  type MlaFigures,
  type Rank,
  type TrendPoint,
} from '@/lib/constituencies'
import { abbreviateParty, displayParty, formatDate, formatMemberName, formatRoleTitle, gbp, orderedParties, partyBorderColor } from '@/lib/format'
import statsStyles from '@/app/assembly/stats/statsKit.module.css'
import ConstituencyMapLink from './ConstituencyMapLink'
import styles from './constituency.module.css'

const GRADE_TEXT: Record<AttendanceGrade, string> = {
  good: 'at or above average',
  low: 'below average',
  poor: 'far below average',
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const decimal = (n: number) => n.toFixed(1)

function roleLabel(m: ConstituencyMla): string | null {
  if (!m.assemblyRole || m.assemblyRoleEnd) return null
  return m.assemblyRole.replace('Principal Deputy Speaker', 'Pr. Dep. Speaker').replace('Deputy Speaker', 'Dep. Speaker')
}

function tenureText(m: ConstituencyMla, mandate: Mandate): string {
  const took = m.mandateStart && m.mandateStart > mandate.start
    ? `Took seat ${formatDate(m.mandateStart)}`
    : `Elected ${mandate.startLabel}`
  return m.mandateEnd ? `${took} · Left ${formatDate(m.mandateEnd)}` : took
}

export default async function ConstituencyDetailPageBody({
  slug,
  mandate,
  basePath,
}: {
  slug: string
  mandate: Mandate
  basePath: string
}) {
  const today = new Date().toISOString().slice(0, 10)
  const monthEnd = mandate.end ?? today
  const monthSpan = (+monthEnd.slice(0, 4) - +mandate.start.slice(0, 4)) * 12 + (+monthEnd.slice(5, 7) - +mandate.start.slice(5, 7)) + 1
  const months = recentMonths(monthEnd, Math.max(6, monthSpan))
  const latestExpensesYear = await getLatestExpensesYear(mandate.id)
  const fyFirst = +mandate.start.slice(0, 4)
  const fyLast = +latestExpensesYear.slice(0, 4)
  const fyList = Number.isFinite(fyLast) && fyLast >= fyFirst ? Array.from({ length: fyLast - fyFirst + 1 }, (_, i) => `${fyFirst + i}-${fyFirst + i + 1}`) : [latestExpensesYear]
  const [rows, averageAttendance, monthlyAttendance, monthlyQuestions, yearRows, allMembers, roleHistories, ministers, chairs, familyIds] = await Promise.all([
    getConstituencyMlaRows(mandate.id, { start: mandate.start, end: mandate.end ?? today }),
    getAverageAttendance(mandate.id),
    getMonthlyAttendanceRows(mandate.id, months[0].start),
    getMonthlyQuestionRows(mandate.id, months[0].start),
    getExpenseYearRows(mandate.id, fyList),
    getAllMembers(mandate.id),
    getAllMemberRoleHistories(mandate.id),
    getAllMinisters(mandate.id),
    getAllCommitteeChairs(mandate.id),
    getFamilyEmployedIds(mandate.id),
  ])

  const name = findConstituency(rows, slug)
  if (!name) notFound()

  const mlas = groupByConstituency(rows).get(name) ?? []
  const ctx = {
    mandateStart: mandate.start,
    questionsEnd: mandate.end ?? today,
    expensesEnd: financialYearEnd(latestExpensesYear),
  }
  const here = summarise(mlas, ctx)
  const assembly = summarise(rows, ctx)
  const constituencyCount = groupByConstituency(rows).size
  const averageConstituencyExpenses = constituencyCount > 0 ? assembly.expensesTotal / constituencyCount : null

  const floor = attendanceFloor(
    rows.filter((r) => r.isCurrent).map((r) => ({ assembly_role: r.assemblyRole, assembly_role_end: r.assemblyRoleEnd, attendance_pct: roundedPct(r) })),
    averageAttendance,
  )

  const adjective = sittingAdjective(mandate)
  const current = mlas.filter((m) => m.isCurrent).sort((a, b) => a.fullName.localeCompare(b.fullName))
  const former = mlas
    .filter((m) => !m.isCurrent)
    .sort((a, b) => (b.mandateEnd ?? '').localeCompare(a.mandateEnd ?? ''))

  const partyRows = orderedParties(mlas).map((party) => {
    const seats = current.filter((m) => m.party === party).length
    const left = former.filter((m) => m.party === party).length
    return { party, value: seats, meta: left > 0 ? `${left} former` : undefined }
  })

  const seated = partyRows.filter((r) => r.value > 0)
  const topSeats = Math.max(0, ...seated.map((r) => r.value))
  const leaders = seated.filter((r) => r.value === topSeats)
  const leadColour = leaders.length === 1 ? partyBorderColor(leaders[0].party) : 'color-mix(in srgb, var(--sw-text-primary) 22%, var(--tile-bg))'

  const expensesLabel = ctx.expensesEnd ? `to March ${ctx.expensesEnd.slice(0, 4)}` : ''

  const peers = [...groupByConstituency(rows).entries()].map(([peer, ms]) => ({ name: peer, s: summarise(ms, ctx) }))
  const summaries = peers.map((p) => p.s)
  const constituencyRank = (get: (s: ConstituencySummary) => number | null): Rank | null => {
    const mine = get(here)
    if (mine === null) return null
    return rankIn(summaries.map(get).filter((v): v is number => v !== null), mine)
  }
  const perSeat = (s: ConstituencySummary) => (s.currentCount > 0 ? s.expensesTotal / s.currentCount : null)
  const ranks = {
    attendance: constituencyRank((s) => s.pooledAttendance),
    questions: constituencyRank((s) => s.questionsPerMlaMonth),
    expenses: constituencyRank((s) => s.expensesTotal),
    perSeat: constituencyRank(perSeat),
    former: constituencyRank((s) => s.formerCount),
  }
  const expenseShare = assembly.expensesTotal > 0 ? (here.expensesTotal * 100) / assembly.expensesTotal : null

  const allCurrent = rows.filter((r) => r.isCurrent)
  const figuresOf = new Map<string, MlaFigures>(rows.map((r) => [r.personId, mlaFigures(r, mandate.start, ctx.expensesEnd)]))
  const poolOf = (key: keyof MlaFigures) =>
    allCurrent.map((r) => figuresOf.get(r.personId)?.[key] ?? null).filter((v): v is number => v !== null)

  const hereAttendance = attendanceTrend(months, monthlyAttendance, mlas, 'pooled')
  const allAttendance = attendanceTrend(months, monthlyAttendance, rows, 'pooled')
  const hereQuestions = questionTrend(months, monthlyQuestions, mlas, ctx.questionsEnd)
  const allQuestions = questionTrend(months, monthlyQuestions, rows, ctx.questionsEnd)

  const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10)
  const toItems = (own: TrendPoint[], all: TrendPoint[]): LineItem[] =>
    months.map((mo, i) => ({
      key: mo.key,
      label: mo.label,
      tick: i === 0 || mo.key.endsWith('-01') ? `'${mo.key.slice(2, 4)}` : '',
      value: round1(own[i].value),
      benchmark: round1(all[i].value),
    }))
  const attendanceItems = toItems(hereAttendance, allAttendance)
  const monthTotals = new Map<string, number>()
  for (const r of monthlyQuestions) monthTotals.set(r.month, (monthTotals.get(r.month) ?? 0) + r.count)
  const questionItems = toItems(hereQuestions, allQuestions).map((it) =>
    (monthTotals.get(it.key) ?? 0) >= MIN_SITTING_QUESTIONS ? it : { ...it, value: null, benchmark: null },
  )

  const idsHere = new Set(mlas.map((m) => m.personId))
  const sumYear = (fy: string, only: boolean) =>
    yearRows.filter((r) => r.financialYear === fy && (!only || idsHere.has(r.personId))).reduce((a, r) => a + r.total, 0)
  const groupIds = [...groupByConstituency(rows).values()].map((ms) => new Set(ms.map((m) => m.personId)))
  const yearRank = (fy: string, mine: number) =>
    rankIn(groupIds.map((ids) => yearRows.filter((r) => r.financialYear === fy && ids.has(r.personId)).reduce((a, r) => a + r.total, 0)), mine)
  const yearsData = fyList
    .map((fy) => {
      const total = sumYear(fy, true)
      return { fy, label: shortFinancialYear(fy), here: total, avg: peers.length > 0 ? sumYear(fy, false) / peers.length : null, rank: yearRank(fy, total) }
    })
    .filter((y) => y.here > 0 || (y.avg ?? 0) > 0)
    .map((y, i, all) => {
      const before = i > 0 ? all[i - 1].here : 0
      return { ...y, change: before > 0 ? ((y.here - before) * 100) / before : null, first: i === 0 }
    })
  const yearScale = Math.max(1, ...yearsData.flatMap((y) => [y.here, y.avg ?? 0])) * 1.08
  const lastYear = yearsData.length > 1 ? yearsData[yearsData.length - 1] : null

  const stripFor = (get: (s: ConstituencySummary) => number | null, show: (v: number) => string, what: string) => {
    const vals = peers
      .flatMap((p) => {
        const v = get(p.s)
        return v === null ? [] : [{ name: p.name, v }]
      })
      .sort((a, b) => b.v - a.v || a.name.localeCompare(b.name))
    if (vals.length === 0) return null
    const max = vals[0].v
    const min = vals[vals.length - 1].v
    const items = vals.map((x) => ({ name: x.name, own: x.name === name, h: Math.round(max === min ? 55 : 18 + ((x.v - min) / (max - min)) * 82) }))
    const top = vals[0]
    const bottom = vals[vals.length - 1]
    const mine = vals.findIndex((x) => x.name === name)
    return {
      items,
      top: `${top.name} ${show(top.v)}`,
      bottom: `${bottom.name} ${show(bottom.v)}`,
      summary: `${what} across ${vals.length} constituencies, highest first. ${mine >= 0 ? `${name} is ${ordinal(mine + 1)}. ` : ''}Highest: ${top.name}, ${show(top.v)}. Lowest: ${bottom.name}, ${show(bottom.v)}.`,
    }
  }

  const attendanceAbout = assembly.pooledAttendance === null ? '' : `Assembly ${decimal(assembly.pooledAttendance)}%`
  const assemblyPerSeat = assembly.currentCount > 0 ? assembly.expensesTotal / assembly.currentCount : null
  const board = [
    {
      key: 'attendance',
      label: 'Attendance',
      Icon: Gauge,
      tone: statsStyles.tnGreen,
      figure: here.pooledAttendance === null ? '-' : `${decimal(here.pooledAttendance)}%`,
      rank: ranks.attendance,
      highIsBad: false as boolean | null,
      bars: stripFor((s) => s.pooledAttendance, (v) => `${decimal(v)}%`, 'Division attendance'),
      note: [`Current MLAs ${here.currentMeanAttendance === null ? '-' : `${decimal(here.currentMeanAttendance)}%`}`, attendanceAbout].filter(Boolean).join('. '),
    },
    {
      key: 'questions',
      label: 'Questions',
      Icon: MessageCircleQuestion,
      tone: statsStyles.tnPurple,
      figure: here.questionTotal.toLocaleString('en-GB'),
      rank: ranks.questions,
      highIsBad: false as boolean | null,
      bars: stripFor((s) => s.questionsPerMlaMonth, decimal, 'Questions per MLA per month'),
      note: `Ranked on ${here.questionsPerMlaMonth === null ? '-' : decimal(here.questionsPerMlaMonth)} per MLA a month${assembly.questionsPerMlaMonth === null ? '' : `. Assembly ${decimal(assembly.questionsPerMlaMonth)}`}`,
    },
    {
      key: 'expenses',
      label: 'Expenses',
      Icon: PoundSterling,
      tone: statsStyles.tnAmber,
      figure: gbp(here.expensesTotal),
      rank: ranks.expenses,
      highIsBad: true as boolean | null,
      bars: stripFor((s) => s.expensesTotal, (v) => gbp(Math.round(v)), 'Total expenses'),
      note: `${expenseShare === null ? '-' : `${decimal(expenseShare)}%`} of all expenses${expensesLabel ? ` ${expensesLabel}` : ''}${averageConstituencyExpenses === null ? '' : `. Average constituency ${gbp(averageConstituencyExpenses)}`}`,
    },
    {
      key: 'seat',
      label: 'Expenses per seat',
      Icon: Wallet,
      tone: statsStyles.tnIndigo,
      figure: here.currentCount > 0 ? gbp(here.expensesTotal / here.currentCount) : '-',
      rank: ranks.perSeat,
      highIsBad: true as boolean | null,
      bars: stripFor(perSeat, (v) => gbp(Math.round(v)), 'Expenses per seat'),
      note: `Total divided by ${count(here.currentCount, 'seat', 'seats')}${assemblyPerSeat === null ? '' : `. Assembly ${gbp(assemblyPerSeat)}`}`,
    },
    {
      key: 'left',
      label: 'MLAs who have left',
      Icon: Repeat,
      tone: statsStyles.tnGrey,
      figure: String(here.formerCount),
      rank: ranks.former,
      highIsBad: null as boolean | null,
      bars: stripFor((s) => s.formerCount, String, 'MLAs who have left'),
      note: 'Left the Assembly this mandate',
    },
  ]

  const rankFig = (r: Rank | null, noun: string, highIsBad: boolean | null) =>
    r && (
      <span className={styles.rankFig}>
        <span className={styles.rankFigLabel}>Rank</span>
        <span className={styles.rankFigNum} data-tone={highIsBad === null ? undefined : rankTone(r.rank, r.of, highIsBad)}>
          {r.rank}<small>/{r.of}</small>
          <span className="sr-only"> {noun}</span>
        </span>
      </span>
    )

  const sideStat = (label: string, value: string, tone?: string) => (
    <span className={styles.rankFig}>
      <span className={styles.rankFigLabel}>{label}</span>
      <span className={styles.rankFigNum} data-tone={tone}>{value}</span>
    </span>
  )

  const hasAttendance = attendanceItems.some((i) => i.value !== null)
  const hasQuestions = questionItems.some((i) => i.value !== null)

  type RankingKey = keyof MlaFigures
  const rankings: { key: RankingKey; title: string; Icon: typeof Gauge; tone: string; highIsBad: boolean; sub: string; show: (v: number) => string; unit?: string }[] = [
    { key: 'attendance', title: 'Attendance', Icon: Gauge, tone: statsStyles.tnGreen, highIsBad: false, sub: 'Share of divisions each MLA took part in.', show: (v) => `${decimal(v)}%` },
    { key: 'questions', title: 'Questions', Icon: MessageCircleQuestion, tone: statsStyles.tnPurple, highIsBad: false, sub: 'Written and oral questions per month in office.', show: (v) => decimal(v), unit: 'a month' },
    { key: 'expenses', title: 'Monthly expenses', Icon: Wallet, tone: statsStyles.tnAmber, highIsBad: true, sub: 'Expenses and staff costs per month in office.', show: (v) => gbp(Math.round(v)), unit: 'a month' },
  ]

  const unrankedReason = (m: ConstituencyMla, key: RankingKey) => {
    if (key === 'attendance') return isServingSpeaker(m) ? 'Speaker' : 'No divisions'
    if (key === 'questions') return `Under ${MIN_QUESTION_MONTHS} months counted`
    return m.expenses === null ? 'None published' : `Under ${MIN_EXPENSE_MONTHS} months of expenses published`
  }

  const renderFormer = (m: ConstituencyMla) => {
    const pct = attendancePct(m)
    const person = formatMemberName(m.fullName)
    const facts = [
      { key: 'time', Icon: CalendarDays, tone: statsStyles.tnIndigo, label: 'Time in office', value: spanText(monthsInOffice(m, mandate.start, m.mandateEnd ?? ctx.questionsEnd)), sub: null as string | null },
      {
        key: 'attendance',
        Icon: Gauge,
        tone: statsStyles.tnGreen,
        label: 'Attendance',
        value: pct === null ? 'n/a' : `${Math.round(pct)}%`,
        sub: pct === null ? null : `Took part in ${m.present.toLocaleString('en-GB')} of ${m.total.toLocaleString('en-GB')} divisions`,
      },
      { key: 'questions', Icon: MessageCircleQuestion, tone: statsStyles.tnPurple, label: 'Questions', value: isQuestionEligible(m) ? (m.written + m.oral).toLocaleString('en-GB') : 'n/a', sub: null as string | null },
      { key: 'expenses', Icon: PoundSterling, tone: statsStyles.tnAmber, label: 'Expenses', value: m.expenses === null ? 'None published' : gbp(m.expenses), sub: null as string | null },
    ]
    return (
      <li key={m.personId} className={styles.mcCard}>
        <div className={styles.mcHead}>
          <span className={styles.mcPhoto}>
            <MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={256} decorative square personId={m.personId} />
          </span>
          <div className={styles.mcIdText}>
            <h4 className={styles.mcName}>{person}</h4>
            {m.party && (
              <span className={styles.mcParty}>
                <i style={{ background: partyBorderColor(m.party) }} aria-hidden="true" />
                {displayParty(m.party)}
              </span>
            )}
            <span className={styles.mcSince}>{tenureText(m, mandate)}</span>
          </div>
          <div className={styles.mcActions}>
            <Link href={`${basePath}/assembly/mlas/${m.personId}`} className={styles.mcBtn}>
              View profile<span className="sr-only"> of {person}</span>
              <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <ul className={styles.mcFacts} aria-label={`${person} figures`}>
          {facts.map((f) => (
            <li key={f.key} className={styles.mcFact}>
              <span className={`${statsStyles.iconTile} ${f.tone}`}><f.Icon size={18} strokeWidth={2} aria-hidden="true" /></span>
              <span className={styles.mcFactText}>
                <span className={styles.mcFactLabel}>{f.label}</span>
                <span className={styles.mcFactValue}>{f.value}</span>
                {f.sub && <span className={styles.mcFactSub}>{f.sub}</span>}
              </span>
            </li>
          ))}
        </ul>
      </li>
    )
  }

  const designationOf = new Map(allMembers.map((m) => [m.personId, m.designation]))
  const ministerOf = new Map(
    ministers.map((m) => {
      const title = formatRoleTitle(m.roleTitle ?? m.department)
      const dept = m.department
      const withDept = dept && !title.toLowerCase().includes(dept.toLowerCase()) && !/first minister/i.test(title)
      return [m.personId, withDept ? `${title}, ${dept}` : title] as const
    }),
  )
  const chairOf = new Map(chairs.map((c) => [c.personId, c.committeeName]))
  const historyOf = new Map<string, typeof roleHistories>()
  for (const r of roleHistories) historyOf.set(r.personId, [...(historyOf.get(r.personId) ?? []), r])
  const ratesPublished = salaryRatesPublished(mandate.id)

  const spanText = (monthCount: number) => {
    const total = Math.max(0, Math.round(monthCount))
    const years = Math.floor(total / 12)
    const rest = total % 12
    return [years > 0 ? count(years, 'yr', 'yrs') : null, rest > 0 || years === 0 ? count(rest, 'mth', 'mths') : null].filter(Boolean).join(' ')
  }

  const pickGlance = (m: ConstituencyMla, key: RankingKey) => {
    const v = figuresOf.get(m.personId)?.[key] ?? null
    return v === null ? null : rankIn(poolOf(key), v)
  }

  const renderCard = (m: ConstituencyMla) => {
    const intervals: RoleInterval[] = (historyOf.get(m.personId) ?? []).flatMap((r) => {
      const salaryRole = apiRoleToSalaryRole(r.roleType, r.role, r.organisation ?? '')
      return salaryRole ? [{ salaryRole, startDate: r.startDate, endDate: r.endDate ?? null }] : []
    })
    const salary = ratesPublished ? getCurrentAnnualSalary(intervals, today, mandate.id) : null
    const earned = ratesPublished ? calculateMandateEarnings(intervals, today, mandate.id) : null
    const roles = [roleLabel(m), ministerOf.get(m.personId) ?? null, chairOf.has(m.personId) ? `Chair, ${chairOf.get(m.personId)}` : null].filter((x): x is string => !!x)
    const designation = designationOf.get(m.personId)
    const family = familyIds.has(m.personId)
    const fig = figuresOf.get(m.personId)
    const pct = attendancePct(m)
    const grade = pct !== null ? gradeAttendance(pct, averageAttendance, floor) : null
    const person = formatMemberName(m.fullName)
    const metrics = [
      {
        key: 'attendance' as const,
        label: 'Attendance',
        Icon: Gauge,
        tone: statsStyles.tnGreen,
        value: pct === null ? <span className={styles.rkMuted}>{isServingSpeaker(m) ? 'n/a' : 'None'}</span> : (
          <span className={grade ? styles.attInk : undefined}>
            {Math.round(pct)}%
            {grade && <span className="sr-only"> ({GRADE_TEXT[grade]})</span>}
          </span>
        ),
        sub: pct === null ? (isServingSpeaker(m) ? 'Presiding officer' : 'No divisions yet') : `Took part in ${m.present.toLocaleString('en-GB')} of ${m.total.toLocaleString('en-GB')} divisions`,
      },
      {
        key: 'questions' as const,
        label: 'Questions',
        Icon: MessageCircleQuestion,
        tone: statsStyles.tnPurple,
        value: isQuestionEligible(m) ? (m.written + m.oral).toLocaleString('en-GB') : <span className={styles.rkMuted}>n/a</span>,
        sub: fig?.questions != null ? `Ranked on ${decimal(fig.questions)} a month` : `Under ${MIN_QUESTION_MONTHS} months counted`,
      },
      {
        key: 'expenses' as const,
        label: 'Expenses',
        Icon: PoundSterling,
        tone: statsStyles.tnAmber,
        value: m.expenses === null ? <span className={styles.rkMuted}>None</span> : gbp(m.expenses),
        sub: fig?.expenses != null ? `Ranked on ${gbp(Math.round(fig.expenses))} a month` : m.expenses === null ? 'None published' : `Under ${MIN_EXPENSE_MONTHS} months of expenses published`,
      },
    ]
    return (
      <li key={m.personId} className={styles.mcCard}>
        <div className={styles.mcHead}>
          <span className={styles.mcPhoto}>
            <MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={256} decorative square personId={m.personId} />
          </span>
          <div className={styles.mcIdText}>
            <h4 className={styles.mcName}>{person}</h4>
            {m.party && (
              <span className={styles.mcParty}>
                <i style={{ background: partyBorderColor(m.party) }} aria-hidden="true" />
                {displayParty(m.party)}
              </span>
            )}
            {roles.length > 0 && (
              <span className={styles.mcRoles}>
                {roles.map((role) => <span key={role}>{role}</span>)}
              </span>
            )}
          </div>
          <div className={styles.mcActions}>
            <Link href={`${basePath}/assembly/mlas/${m.personId}`} className={styles.mcBtn}>
              View profile<span className="sr-only"> of {person}</span>
              <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <ul className={styles.mcMetrics} aria-label={`${person} figures`}>
          {metrics.map((s) => {
            const rank = pickGlance(m, s.key)
            const highIsBad = s.key === 'expenses'
            const pos = rank && rank.of > 1 ? ((rank.of - rank.rank) / (rank.of - 1)) * 100 : 100
            const tone = rank ? rankTone(rank.rank, rank.of, highIsBad) : undefined
            return (
              <li key={s.key} className={styles.mcMetric} data-ranked={rank ? '' : undefined}>
                <span className={styles.mcMetricHead}>
                  <span className={`${statsStyles.iconTile} ${s.tone}`}><s.Icon size={20} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={styles.cmpLabel}>{s.label}</span>
                </span>
                <span className={styles.mcFigure}>{s.value}</span>
                <span className={styles.mcSub}>{s.sub}</span>
                {rank ? (
                  <>
                    <span className={styles.mcRankLine}>
                      <span className={styles.mcRankLabel}>Rank</span>
                      <span className={styles.mcRankNum} data-tone={tone}>
                        {rank.rank}<small>/{rank.of}</small>
                        <span className="sr-only"> of {adjective} MLAs</span>
                      </span>
                    </span>
                    <span className={styles.mcTrack} data-scale={highIsBad ? 'bad-right' : 'good-right'} aria-hidden="true">
                      <i data-tone={tone} style={{ left: `${pos}%` }} />
                    </span>
                    <span className={styles.mcEnds} aria-hidden="true">
                      <span>Lowest</span>
                      <span>Highest</span>
                    </span>
                  </>
                ) : (
                  <span className={styles.mcRankLabel}>Not ranked</span>
                )}
              </li>
            )
          })}
        </ul>

        <ul className={styles.mcFacts} aria-label={`${person} details`}>
          <li className={styles.mcFact}>
            <span className={`${statsStyles.iconTile} ${statsStyles.tnIndigo}`}><CalendarDays size={18} strokeWidth={2} aria-hidden="true" /></span>
            <span className={styles.mcFactText}>
              <span className={styles.mcFactLabel}>Time in office</span>
              <span className={styles.mcFactValue}>{spanText(monthsInOffice(m, mandate.start, ctx.questionsEnd))}</span>
              <span className={styles.mcFactSub}>{tenureText(m, mandate)}</span>
            </span>
          </li>
          {ratesPublished && (
            <li className={styles.mcFact}>
              <span className={`${statsStyles.iconTile} ${statsStyles.tnGreen}`}><Banknote size={18} strokeWidth={2} aria-hidden="true" /></span>
              <span className={styles.mcFactText}>
                <span className={styles.mcFactLabel}>Salary</span>
                <span className={styles.mcFactValue}>{salary === null ? 'n/a' : `${gbp(salary)} a year`}</span>
                {earned !== null && <span className={styles.mcFactSub}>{gbp(earned)} estimated this mandate</span>}
              </span>
            </li>
          )}
          <li className={styles.mcFact}>
            <span className={`${statsStyles.iconTile} ${statsStyles.tnCoral}`}><Users size={18} strokeWidth={2} aria-hidden="true" /></span>
            <span className={styles.mcFactText}>
              <span className={styles.mcFactLabel}>Family employed</span>
              <span className={styles.mcFactValue} data-family={family ? 'yes' : 'no'}>{family ? 'Yes' : 'No'}</span>
            </span>
          </li>
          {designation && (
            <li className={styles.mcFact}>
              <span className={`${statsStyles.iconTile} ${statsStyles.tnGrey}`}><Landmark size={18} strokeWidth={2} aria-hidden="true" /></span>
              <span className={styles.mcFactText}>
                <span className={styles.mcFactLabel}>Designation</span>
                <span className={styles.mcFactValue}>{designation}</span>
              </span>
            </li>
          )}
        </ul>
      </li>
    )
  }

  return (
    <div className={statsStyles.page}>
      <section className={`${statsStyles.band} ${statsStyles.bandPage}`} aria-labelledby="constituency-title">
        <div className="container">
          <div className={styles.detailHero} style={{ ['--lead' as string]: leadColour }}>
            <div className={styles.heroText}>
              <header className={`${statsStyles.head} ${styles.heroHead}`}>
                <span className={statsStyles.eyebrow}>Constituency</span>
                <h1 className={statsStyles.h1} id="constituency-title">{name}</h1>
                <p className={statsStyles.headSub}>
                  {count(here.mlaCount, 'MLA', 'MLAs')} held {count(here.currentCount, 'seat', 'seats')} here during the {mandate.label} mandate: {here.currentCount} {adjective}
                  {here.formerCount > 0 ? ` and ${here.formerCount} former` : ''}.
                </p>
              </header>
              {current.length > 0 && (
                <div className={styles.heroFaces} aria-hidden="true">
                  {current.map((m) => (
                    <span key={m.personId} className={styles.heroFace}>
                      <MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={128} decorative square personId={m.personId} />
                    </span>
                  ))}
                </div>
              )}
              <ul className={styles.heroParties} aria-label={`${adjective[0].toUpperCase()}${adjective.slice(1)} seats by party`}>
                {partyRows.filter((r) => r.value > 0).map((r) => (
                  <li key={r.party} className="party-pill" data-party={abbreviateParty(r.party)}>
                    {displayParty(r.party)} <b>{r.value}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.detailHeroMap}>
              <ConstituencyMapLink basePath={basePath} fills={{ [name]: leadColour }} locator interactive={false} />
            </div>
          </div>

        </div>
      </section>

      <section className={`${statsStyles.band} ${statsStyles.bandTint}`} aria-labelledby="constituency-board-heading">
        <div className="container">
          <header className={statsStyles.sectionHead}>
            <span className={statsStyles.eyebrow}>Comparison</span>
            <h2 className={statsStyles.h2} id="constituency-board-heading">{name} against all {peers.length} constituencies</h2>
            <p className={statsStyles.sectionSub}>Constituencies ranked from highest to lowest, with {name} highlighted. Figures cover every MLA who held a seat, current and former.</p>
          </header>

          <section className={`${statsStyles.tile} ${styles.board}`} aria-label={`${name} headline figures`}>
            <ul className={styles.boardList}>
              {board.map((b) => (
                <li key={b.key} className={`${styles.boardRow} ${b.tone}`}>
                  <span className={styles.boardLead}>
                    <span className={`${statsStyles.iconTile} ${b.tone} ${styles.boardIcon}`}><b.Icon size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <span className={styles.boardText}>
                      <span className={styles.boardLabel}>{b.label}</span>
                      <span className={styles.boardFigure}>{b.figure}</span>
                    </span>
                  </span>
                  <span className={styles.boardStrip}>
                    {b.bars ? (
                      <>
                        <span className={styles.stripBars} role="img" aria-label={b.bars.summary}>
                          {b.bars.items.map((it) => (
                            <i key={it.name} data-own={it.own ? '' : undefined} style={{ height: `${it.h}%` }} />
                          ))}
                        </span>
                        <span className={styles.stripEnds} aria-hidden="true">
                          <span>Highest: {b.bars.top}</span>
                          <span>Lowest: {b.bars.bottom}</span>
                        </span>
                      </>
                    ) : (
                      <span className={styles.boardNote}>No figures to rank.</span>
                    )}
                  </span>
                  <span className={styles.boardSide}>
                    {rankFig(b.rank, 'of constituencies', b.highIsBad)}
                    <span className={styles.boardNote}>{b.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      <section className={`${statsStyles.band} ${statsStyles.bandPlain}`} aria-labelledby="constituency-time-heading">
        <div className="container">
          <header className={statsStyles.sectionHead}>
            <span className={statsStyles.eyebrow}>Over time</span>
            <h2 className={statsStyles.h2} id="constituency-time-heading">{name} across the mandate</h2>
            <p className={statsStyles.sectionSub}>Month by month across the {mandate.label} mandate, against the whole Assembly measured the same way. A gap is a month with nothing to measure, not a zero.</p>
          </header>

          <div className={styles.timeStack}>
            {hasAttendance && (
              <section className={`${statsStyles.tile} ${statsStyles.tnGreen}`} aria-labelledby="constituency-time-attendance">
                <div className={`${statsStyles.tileHead} ${styles.timeHead}`}>
                  <span className={`${statsStyles.iconTile} ${statsStyles.tnGreen}`}><Gauge size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <div className={`${statsStyles.tileTitles} ${styles.timeTitles}`}>
                    <h3 className={statsStyles.tileTitle} id="constituency-time-attendance">Attendance, month by month</h3>
                    <p className={statsStyles.tileSub}>Share of divisions each month that {name}&apos;s MLAs took part in (solid line) against every MLA in the Assembly (dotted line). The Speaker is left out while presiding.</p>
                  </div>
                  <div className={styles.timeSides}>
                    {here.pooledAttendance !== null && sideStat('Mandate average', `${decimal(here.pooledAttendance)}%`)}
                    {assembly.pooledAttendance !== null && sideStat('Assembly', `${decimal(assembly.pooledAttendance)}%`)}
                  </div>
                </div>
                <LineChart items={attendanceItems} colour="var(--sw-success-solid)" ariaLabel={`Attendance by month for ${name}, against the Assembly`} seriesLabel={name} benchmarkLabel="Assembly" />
              </section>
            )}

            {hasQuestions && (
              <section className={`${statsStyles.tile} ${statsStyles.tnPurple}`} aria-labelledby="constituency-time-questions">
                <div className={`${statsStyles.tileHead} ${styles.timeHead}`}>
                  <span className={`${statsStyles.iconTile} ${statsStyles.tnPurple}`}><MessageCircleQuestion size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <div className={`${statsStyles.tileTitles} ${styles.timeTitles}`}>
                    <h3 className={statsStyles.tileTitle} id="constituency-time-questions">Questions, month by month</h3>
                    <p className={statsStyles.tileSub}>Written and oral questions asked per MLA each month, for {name} (solid line) and the whole Assembly (dotted line).</p>
                  </div>
                  <div className={styles.timeSides}>
                    {here.questionsPerMlaMonth !== null && sideStat('Mandate average', decimal(here.questionsPerMlaMonth))}
                    {assembly.questionsPerMlaMonth !== null && sideStat('Assembly', decimal(assembly.questionsPerMlaMonth))}
                  </div>
                </div>
                <LineChart items={questionItems} colour="var(--c-purple)" ariaLabel={`Questions per MLA by month for ${name}, against the Assembly`} seriesLabel={name} benchmarkLabel="Assembly" unit="" domain="count" emptyLabel="Not sitting" thinLabels />
              </section>
            )}

            {yearsData.length > 0 && (
              <section className={`${statsStyles.tile} ${statsStyles.tnAmber}`} aria-labelledby="constituency-time-expenses">
                <div className={`${statsStyles.tileHead} ${styles.timeHead}`}>
                  <span className={`${statsStyles.iconTile} ${statsStyles.tnAmber}`}><PoundSterling size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <div className={`${statsStyles.tileTitles} ${styles.timeTitles}`}>
                    <h3 className={statsStyles.tileTitle} id="constituency-time-expenses">Expenses, year on year</h3>
                    <p className={statsStyles.tileSub}>Published expenses and staff costs of every MLA who held a seat in {name}, current and former, by financial year (April to March). The marker is the average constituency, and the rank is among all constituencies that year, highest spend first.</p>
                  </div>
                  <div className={styles.timeSides}>
                    {lastYear && lastYear.change !== null && sideStat(`${lastYear.label} change`, `${lastYear.change > 0 ? '+' : ''}${decimal(lastYear.change)}%`, lastYear.change > 0 ? 'bad' : 'good')}
                  </div>
                </div>
                <ul className={styles.yearList} aria-label={`${name} expenses by financial year`}>
                  {yearsData.map((y) => (
                    <li key={y.fy} className={styles.yearItem}>
                      <span className={styles.yearName}>
                        <b>{y.label}</b>
                        {y.avg !== null && <small>Average constituency {gbp(y.avg)}</small>}
                      </span>
                      <span className={styles.yearTrack} aria-hidden="true">
                        <i style={{ width: `${(y.here / yearScale) * 100}%` }} />
                        {y.avg !== null && <b style={{ left: `${(y.avg / yearScale) * 100}%` }} />}
                      </span>
                      <span className={styles.yearAmount}>{gbp(y.here)}</span>
                      <span className={styles.yearChange} data-tone={y.change === null ? undefined : y.change > 0 ? 'bad' : 'good'}>
                        {y.change === null ? (y.first ? 'First year' : '-') : <>{y.change > 0 ? '+' : ''}{decimal(y.change)}%<span className="sr-only"> on the year before</span></>}
                      </span>
                      <span className={styles.yearRank}>{rankFig(y.rank, 'of constituencies that year', true)}</span>
                    </li>
                  ))}
                </ul>
                <p className={styles.timeNote}>The first year starts at the {mandate.startLabel} election.</p>
              </section>
            )}
          </div>
        </div>
      </section>

      <section className={`${statsStyles.band} ${statsStyles.bandTint}`} aria-labelledby="constituency-mlas-heading">
        <div className="container">
          <header className={statsStyles.sectionHead}>
            <span className={statsStyles.eyebrow}>Representatives</span>
            <h2 className={statsStyles.h2} id="constituency-mlas-heading">Who has held the seats</h2>
          </header>

          <div className={styles.groups}>
            <section className={statsStyles.tile} aria-labelledby="constituency-current-heading">
              <div className={statsStyles.tileHead}>
                <span className={`${statsStyles.iconTile} ${statsStyles.tnBlue}`}><Users size={22} strokeWidth={2} aria-hidden="true" /></span>
                <h3 className={statsStyles.tileTitle} id="constituency-current-heading">{adjective[0].toUpperCase()}{adjective.slice(1)} MLAs</h3>
                <span className={`${statsStyles.pill} ${styles.groupCount}`} data-tone="neutral">{count(current.length, 'MLA', 'MLAs')}</span>
              </div>
              {current.length > 0 ? (
                <ul className={styles.mcList} aria-label={`${adjective[0].toUpperCase()}${adjective.slice(1)} MLAs for ${name}`}>{current.map(renderCard)}</ul>
              ) : (
                <p className={styles.empty}>No {adjective} MLAs.</p>
              )}
            </section>

            {former.length > 0 && (
              <section className={statsStyles.tile} aria-labelledby="constituency-former-heading">
                <div className={statsStyles.tileHead}>
                  <span className={`${statsStyles.iconTile} ${statsStyles.tnGrey}`}><UserMinus size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <h3 className={statsStyles.tileTitle} id="constituency-former-heading">Former MLAs</h3>
                  <span className={`${statsStyles.pill} ${styles.groupCount}`} data-tone="neutral">{count(former.length, 'MLA', 'MLAs')}</span>
                </div>
                <ul className={styles.mcList} aria-label={`Former MLAs for ${name}`}>{former.map(renderFormer)}</ul>
              </section>
            )}
          </div>
        </div>
      </section>

      {current.length > 0 && (
        <section className={`${statsStyles.band} ${statsStyles.bandPlain}`} aria-labelledby="constituency-rankings-heading">
          <div className="container">
            <header className={statsStyles.sectionHead}>
              <span className={statsStyles.eyebrow}>Rankings</span>
              <h2 className={statsStyles.h2} id="constituency-rankings-heading">How the {adjective} MLAs rank</h2>
              <p className={statsStyles.sectionSub}>
                Each {adjective} MLA for {name} ranked against every {adjective} MLA in the Assembly who can be ranked on that measure, highest first. Colours show the top, middle and bottom third; for expenses the highest are red.
              </p>
            </header>

            <div className={styles.groups}>
              {rankings.map((r) => {
                const pool = poolOf(r.key)
                const mean = r.key === 'attendance' ? averageAttendance : pool.length ? pool.reduce((a, b) => a + b, 0) / pool.length : null
                const listed = current
                  .map((m) => ({ m, v: figuresOf.get(m.personId)?.[r.key] ?? null }))
                  .sort((a, b) => (b.v ?? -1) - (a.v ?? -1) || a.m.fullName.localeCompare(b.m.fullName))
                const headingId = `constituency-rank-${r.key}`
                return (
                  <section key={r.key} className={statsStyles.tile} aria-labelledby={headingId}>
                    <div className={statsStyles.tileHead}>
                      <span className={`${statsStyles.iconTile} ${r.tone}`}><r.Icon size={22} strokeWidth={2} aria-hidden="true" /></span>
                      <div className={statsStyles.tileTitles}>
                        <h3 className={statsStyles.tileTitle} id={headingId}>{r.title}</h3>
                        <p className={statsStyles.tileSub}>
                          {r.sub}
                          {mean !== null && ` Average ${adjective} MLA: ${r.show(mean)}.`}
                        </p>
                      </div>
                    </div>
                    <ul className={styles.rows} aria-label={`${r.title} ranking of ${adjective} MLAs for ${name}`}>
                      {listed.map(({ m, v }) => {
                        const rank = v === null ? null : rankIn(pool, v)
                        const pct = r.key === 'attendance' ? attendancePct(m) : null
                        const grade = pct !== null ? gradeAttendance(pct, averageAttendance, floor) : null
                        return (
                          <li key={m.personId} className={styles.rkRow} data-grade={grade ?? undefined}>
                            <span className={styles.rkRank} data-tone={rank ? rankTone(rank.rank, rank.of, r.highIsBad) : undefined}>
                              {rank ? <>{rank.rank}<small>/{rank.of}</small><span className="sr-only"> of {adjective} MLAs</span></> : <span aria-hidden="true">-</span>}
                            </span>
                            <span className={statsStyles.rankPhoto}>
                              <MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={128} decorative square personId={m.personId} />
                            </span>
                            <span className={styles.who}>
                              <Link href={`${basePath}/assembly/mlas/${m.personId}`} className={styles.name}>{formatMemberName(m.fullName)}</Link>
                              <span className={styles.tags}>
                                {m.party && <span className="party-pill" data-party={abbreviateParty(m.party)}>{displayParty(m.party)}</span>}
                              </span>
                            </span>
                            <span className={styles.rkValue}>
                              {v === null ? (
                                <span className={styles.rkMuted}>n/a</span>
                              ) : (
                                <span className={grade ? styles.attInk : undefined}>
                                  {r.show(v)}
                                  {grade && <span className="sr-only"> ({GRADE_TEXT[grade]})</span>}
                                </span>
                              )}
                              <small>{v === null ? unrankedReason(m, r.key) : r.unit ?? `${m.present.toLocaleString('en-GB')} of ${m.total.toLocaleString('en-GB')} divisions`}</small>
                            </span>
                            <ArrowRight className={`${styles.arrow} ${styles.rowArrow}`} size={18} strokeWidth={2} aria-hidden="true" />
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <section className={`${statsStyles.band} ${statsStyles.bandTint}`} aria-labelledby="constituency-method-heading">
        <div className="container">
          <div className={statsStyles.tile}>
            <div className={statsStyles.tileHead}>
              <span className={`${statsStyles.iconTile} ${statsStyles.tnGrey}`}><Gauge size={22} strokeWidth={2} aria-hidden="true" /></span>
              <h2 className={statsStyles.tileTitle} id="constituency-method-heading">How these figures are worked out</h2>
            </div>
            <div className={`${styles.notes} ${styles.notesWide}`}>
              <p className={styles.note}>
                Attendance counts every division from the day an MLA took their seat to the day they left, pooled across all of them. The Speaker is left out while presiding.
              </p>
              <p className={styles.note}>
                Questions are per MLA per month in office, so a seat that changed hands is not marked down for months when nobody held it. Months when an MLA was a minister or the Speaker are left out, as are months with fewer than {MIN_SITTING_QUESTIONS} questions across the whole Assembly, which is how a month when the Assembly did not sit is recognised. Expenses are the total of every published figure for each MLA who held a seat, including costs paid after they left, {expensesLabel}.
              </p>
              <p className={styles.note}>
                Assembly figures use the same method across all {assembly.mlaCount} MLAs of the mandate, current and former, unless a section says current MLAs only. Assembly attendance pools every MLA who held a seat, so it differs from the homepage average, which is the mean of current MLAs.
              </p>
              <p className={styles.note}>
                Constituencies are ranked, highest first, on attendance pooled across every MLA who held a seat, questions per MLA per month, total expenses, expenses per current seat and the number of MLAs who have left. Each expenses year is ranked on its own.
              </p>
              <p className={styles.note}>
                MLAs are ranked on questions only with at least {MIN_QUESTION_MONTHS} months counted, and on monthly expenses only with at least {MIN_EXPENSE_MONTHS} months in office within the published expenses ({expensesLabel}), so a recent arrival can have over a year in office and still not be ranked. Time in office runs from the day an MLA took their seat to today. Salary is the published annual rate for the highest-paid role held today, and earnings are estimated from role history. Family employed shows whether the Register of Interests has an entry for family members who benefit from Office Cost Expenditure.
              </p>
              <p className={styles.note}>
                The monthly charts pool every MLA who held a seat in that month.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
