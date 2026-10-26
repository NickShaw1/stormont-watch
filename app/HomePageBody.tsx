import Link from 'next/link'
import Image from 'next/image'
import {
  Scale, FileText, Vote, Users, MapPin, Trophy, TrendingDown, PoundSterling, MessageCircleQuestion, Telescope,
  CalendarDays, CalendarOff, CheckCircle2, ArrowRight, BarChart3, Milestone, XCircle,
} from 'lucide-react'
import {
  getHomepageStats,
  getAverageAttendance,
  getLeastEngagedMLA,
  getMostEngagedMLA,
  getLatestDivisions,
  getInProgressBills,
  getActiveBillsCount,
  getDivisionsPerMonth,
  getBillsPassedPerMonth,
  getWeeklyDiary,
  getAllMlasByConstituency,
  getSittingDays,
  getOverallAgreementRate,
  getTotalExpensesPerMember,
  getQuestionTotalsAllMembers,
} from '@/lib/db/queries'
import Facts from './components/homepage/Facts'
import MlaFinder from './components/homepage/MlaFinder'
import Schedule, { type ScheduleDay, type ScheduleEntry } from './components/homepage/Schedule'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import { formatDate, dayMonthOrdinalParts, abbreviateParty } from '@/lib/format'
import type { Mandate } from '@/lib/constants/mandates'
import s from './homePage.module.css'

const BILL_ID_RE = /\s*\(NIA Bill [^)]*\)?$/

function formatLondonTime(input: string): string {
  const date = new Date(input.replace(' ', 'T').replace(/\+00$/, '+00:00'))
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London',
  }).formatToParts(date)
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
  const m = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`
}

type Bar = { label: string; full: string; value: number }

function BarChart({ data, tone, title, unit }: { data: Bar[]; tone: string; title: string; unit: [string, string] }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div
      className={s.bars}
      style={{ '--tone': tone } as React.CSSProperties}
      role="img"
      aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}
    >
      {data.map((d, i) => (
        <div key={i} className={s.barCol} aria-hidden="true">
          <span className={s.barTrack}>
            <span
              className={`${s.barFill} ${i === data.length - 1 ? s.barNow : ''}`}
              style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
            />
          </span>
          <span className={s.barLabel}>{d.label.charAt(0)}</span>
          <span
            className={s.barTip}
            data-align={i < 2 ? 'start' : i > data.length - 3 ? 'end' : undefined}
          >
            <span className={s.tipHead}>{d.full}</span>
            <span className={s.tipRow}>{d.value === 1 ? unit[0] : unit[1]}<b>{d.value}</b></span>
          </span>
        </div>
      ))}
    </div>
  )
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, pct))
  return (
    <svg className={s.ring} viewBox="0 0 128 128" role="img" aria-label={label}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--sw-surface-subtle)" strokeWidth="12" />
      <circle
        cx="64" cy="64" r={r} fill="none" stroke="var(--sw-success-solid)" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${(c * p) / 100} ${c}`} transform="rotate(-90 64 64)"
      />
    </svg>
  )
}

// Shared by the live route and the archive route; mandate/basePath vary per route.
export default async function HomePageBody({ mandate, basePath }: { mandate: Mandate; basePath: string }) {
  const now = new Date()
  const weekStartDate = new Date(now)
  weekStartDate.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7))
  const weekStart = weekStartDate.toISOString().slice(0, 10)

  const [stats, avgAttendance, leastEngaged, mostEngaged, latestDivisions, inProgressBills,
    inProgressBillsCount, divisionsPerMonth, billsPassedPerMonth, weeklyDiary, mlasByConstituency,
    sittingDays, overallAgreementRate, totalExpensesData, questionTotalsRaw] =
    await Promise.all([
      getHomepageStats(mandate.id),
      getAverageAttendance(mandate.id),
      getLeastEngagedMLA(mandate.id),
      getMostEngagedMLA(mandate.id),
      getLatestDivisions(4, mandate.id),
      getInProgressBills(5, mandate.id),
      getActiveBillsCount(mandate.id),
      getDivisionsPerMonth(mandate.id),
      getBillsPassedPerMonth(mandate.id),
      getWeeklyDiary(weekStart),
      getAllMlasByConstituency(mandate.id),
      getSittingDays(mandate.id),
      getOverallAgreementRate(mandate.id),
      getTotalExpensesPerMember(mandate.id),
      getQuestionTotalsAllMembers(mandate.id),
    ])

  const lastSat = dayMonthOrdinalParts(stats.lastSat)
  const totalExpensesClaimed = totalExpensesData.reduce((sum, r) => sum + parseFloat(r.totalExpenses), 0)
  const totalQuestionCount = questionTotalsRaw.reduce((sum, r) => sum + Number(r.total), 0)

  const monthLabel = (m: string | Date) => new Date(m).toLocaleString('en-GB', { month: 'short' })
  const monthFull = (m: string | Date) => new Date(m).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
  const divisionsBars: Bar[] = divisionsPerMonth.slice(-12).map((r) => ({ label: monthLabel(r.month), full: monthFull(r.month), value: Number(r.total_divisions) }))
  const billsBars: Bar[] = billsPassedPerMonth.slice(-12).map((r) => ({ label: monthLabel(r.month), full: monthFull(r.month), value: Number(r.bills_passed) }))
  const divisionsThisMonth = divisionsPerMonth.at(-1)?.total_divisions ?? 0
  const divisionsLastMonth = divisionsPerMonth.at(-2)?.total_divisions ?? 0
  const currentMonthName = new Date().toLocaleString('en-GB', { month: 'short' })
  const divisionsDelta = Number(divisionsThisMonth) - Number(divisionsLastMonth)
  const thisYear = now.getFullYear()
  const billsThisYear = billsPassedPerMonth
    .filter(r => new Date(r.month).getFullYear() === thisYear)
    .reduce((sum, r) => sum + Number(r.bills_passed), 0)
  const billsLastYear = billsPassedPerMonth
    .filter(r => new Date(r.month).getFullYear() === thisYear - 1)
    .reduce((sum, r) => sum + Number(r.bills_passed), 0)
  const billsYearDelta = billsThisYear - billsLastYear

  const scheduleDays: ScheduleDay[] = weeklyDiary
    .filter((d) => d.weekday !== 'Saturday' && d.weekday !== 'Sunday')
    .filter((d) => d.plenary !== null || d.agenda.length > 0 || d.billStages.length > 0 || d.committees.length > 0)
    .map((day) => {
      const dayDate = new Date(`${day.date}T12:00:00Z`)
      const startTime = day.plenary?.startTime ? formatLondonTime(day.plenary.startTime) : null

      const agendaEntries: ScheduleEntry[] = day.agenda.map((item) => {
        const colonIdx = item.title.indexOf(':')
        const type = colonIdx > -1
          ? item.title.slice(0, colonIdx).trim()
          : item.title.includes(' - Amendment') ? 'Amendment'
          : item.plenaryTypeId === '5' ? 'Debate' : 'Motion'
        const rawTitle = colonIdx > -1 ? item.title.slice(colonIdx + 1).trim() : item.title
        const billIdMatch = rawTitle.match(/\(NIA Bill (\d+\/\d{2}-\d{2,4})\)$/)
        const slug = billIdMatch ? `nia-bill-${billIdMatch[1]}`.toLowerCase().replace(/\//g, '-') : null
        return {
          key: item.documentId,
          title: rawTitle.replace(BILL_ID_RE, '').trim(),
          type,
          href: slug ? `${basePath}/assembly/bills/${slug}` : null,
          procedural: type === 'Motion' || type === 'Debate',
        }
      })

      const stageEntries: ScheduleEntry[] = day.billStages.map((bs) => ({
        key: `${bs.billId}-${bs.stage}`,
        title: bs.shortTitle,
        type: bs.stage,
        href: `${basePath}/assembly/bills/${bs.billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')}`,
        procedural: false,
      }))

      return {
        date: day.date,
        weekday: new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(dayDate).toUpperCase(),
        dayNum: dayDate.getUTCDate(),
        month: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(dayDate),
        isToday: day.isToday,
        isPast: day.isPast,
        sitting: day.plenary !== null ? `${day.isPast ? 'Assembly sat' : 'Assembly sitting'}${startTime ? ` · ${startTime}` : ''}` : null,
        entries: [...agendaEntries, ...stageEntries],
        meetings: day.committees.map((c) => ({ name: c.organisationName, time: c.startTime ? formatLondonTime(c.startTime) : null })),
      }
    })


  const divisions = latestDivisions.map((div) => {
    const t = div.title ?? ''
    const sub = div.subject ?? ''
    const isStatutory = /^The draft /i.test(t) || /^Prayer of Annulment:/i.test(t) || /^Applicability Motion/i.test(t)
    const isBill = !isStatutory && (/NIA Bill/i.test(sub) || /(?:First|Second|Committee|Consideration|Further Consideration|Final) Stage:/i.test(sub))
    const d = div.divisionDate ? new Date(div.divisionDate) : null
    return {
      id: div.documentId,
      title: formatDivisionSubject(div.title ?? div.subject).title.trim(),
      category: isStatutory ? 'Regulations' : isBill ? 'Bill' : null,
      CategoryIcon: isStatutory ? FileText : Scale,
      isRegs: isStatutory,
      passed: /carried|passed|agreed/i.test(div.outcome ?? ''),
      day: d ? String(d.getDate()) : '-',
      month: d ? d.toLocaleString('en', { month: 'short' }) : '',
    }
  })
  const mlaCount = Object.values(mlasByConstituency).reduce((sum, list) => sum + list.length, 0)
  const constituencyCount = Object.keys(mlasByConstituency).length

  const delta = (n: number, unit: string) => (
    <span className={`${s.delta} ${n > 0 ? s.deltaUp : n < 0 ? s.deltaDown : ''}`}>
      {n > 0 ? `↑ ${n} vs last ${unit}` : n < 0 ? `↓ ${Math.abs(n)} vs last ${unit}` : `No change vs last ${unit}`}
    </span>
  )

  const voter = (m: NonNullable<typeof mostEngaged>, kind: 'top' | 'low') => (
    <Link
      href={`${basePath}/assembly/mlas/${m.personId}`}
      className={`${s.tile} ${s.tileLink} ${kind === 'top' ? s.tTop : s.tLow}`}
    >
      <span className={s.cardHead}>
        <span className={`${s.iconTile} ${kind === 'top' ? s.tnAmber : s.tnGrey}`}>
          {kind === 'top'
            ? <Trophy size={22} strokeWidth={2} aria-hidden="true" />
            : <TrendingDown size={22} strokeWidth={2} aria-hidden="true" />}
        </span>
        <span className={s.tileLabel}>{kind === 'top' ? 'Top Voter' : 'Lowest Voter'}</span>
      </span>
      <span className={s.voterMain}>
        <span className={s.voterPhoto}>
          {m.imgUrl && <Image src={m.imgUrl} alt="" fill sizes="88px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />}
        </span>
        <span className={s.voterInfo}>
          <span className={s.voterName}>{m.fullName}</span>
          {m.constituency && <span className={s.voterSub}>{m.constituency}</span>}
          <span className="party-pill" data-party={abbreviateParty(m.party)}>{abbreviateParty(m.party)}</span>
        </span>
      </span>
      <span className={s.meter}>
        <span className={s.meterBar} aria-hidden="true">
          <span className={kind === 'top' ? s.meterTop : s.meterLow} style={{ width: `${Math.max(0, Math.min(100, Number(m.attendancePct)))}%` }} />
        </span>
        <span className={s.meterFoot}>
          <span className={s.meterPct}>{m.attendancePct}% attendance*</span>
          <span className={s.mono}>{m.attended}/{m.total}</span>
        </span>
      </span>
      <span className={s.note}>* Excludes the Speaker.</span>
      <ArrowRight className={s.linkArrow} size={22} strokeWidth={2} aria-hidden="true" />
    </Link>
  )

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Stormont Watch',
    url: 'https://www.stormontwatch.com',
    description: `Stormont Watch tracks every vote, bill and expense in the Northern Ireland Assembly. See how your MLA votes, explore the full voting record and follow legislation since the ${mandate.label} mandate.`,
    publisher: {
      '@type': 'Organization',
      name: 'Stormont Watch',
      url: 'https://www.stormontwatch.com',
    },
  }

  return (
    <div className={s.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <section className={s.hero} aria-labelledby="hero-title">
        <div className="container">
          <div className={s.heroCard}>
            <div className={s.heroBg}>
              <div className={s.heroMedia}>
                <Image
                  src="/stormont.jpg"
                  alt="Parliament Buildings, Stormont, Belfast"
                  fill
                  sizes="(max-width: 1180px) 100vw, 1400px"
                  className={s.heroPhoto}
                  priority
                />
              </div>
              <div className={s.heroShade} />
            </div>
            <div className={s.heroInner}>
              <div className={s.heroCopy}>
                <span className={s.heroEyebrow}>
                  <span className={s.heroDot} aria-hidden="true" />
                  Mandate {mandate.label}
                </span>
                <h1 className={s.heroTitle} id="hero-title">
                  <span>Every vote.</span>
                  <span>Every bill.</span>
                  <em className={s.heroAccent}>On record.</em>
                </h1>
                <p className={`${s.heroSub} ${s.heroSubLong}`}>
                  Independent, plain-language tracking of the Northern Ireland Assembly. Browse 90 MLAs, committee votes, legislation and Executive decisions. All from the public record, updated daily.
                </p>
                <p className={`${s.heroSub} ${s.heroSubShort}`}>
                  Independent, plain-language tracking of the Northern Ireland Assembly, straight from the public record.
                </p>
                <div className={s.heroCtas}>
                  <a href="#find-your-mla" className={s.heroBtnPrimary}>Find your MLA</a>
                  <Link href={`${basePath}/assembly/stats`} className={s.heroBtnGhost}>Explore the data</Link>
                </div>
              </div>
            </div>
            <ul className={s.heroStats}>
                <li className={s.heroStat}>
                  <span className={`${s.iconTile} ${s.tnBlue}`}><Vote size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={s.statLabel}>Divisions</span>
                  <span className={s.statValue}>{stats.totalDivisions}</span>
                </li>
                <li className={s.heroStat}>
                  <span className={`${s.iconTile} ${s.tnAmber}`}><Scale size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={s.statLabel}>Bills pending</span>
                  <span className={s.statValue}>{inProgressBillsCount}</span>
                </li>
                <li className={s.heroStat}>
                  <span className={`${s.iconTile} ${s.tnGreen}`}><Users size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={s.statLabel}>MLAs tracked</span>
                  <span className={s.statValue}>{mlaCount}</span>
                </li>
                <li className={s.heroStat}>
                  <span className={`${s.iconTile} ${s.tnGrey}`}><MapPin size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={s.statLabel}>Constituencies</span>
                  <span className={s.statValue}>{constituencyCount}</span>
                </li>
              </ul>
            <p className={s.heroCredit}>
              <a href="https://www.flickr.com/photos/robertpaulyoung/64563230/" target="_blank" rel="noopener noreferrer">Robert Paul Young<span className="sr-only"> (opens in a new tab)</span></a> · CC BY 4.0
            </p>
          </div>
        </div>
      </section>

      <section className={`${s.band} ${s.bandTint}`} aria-labelledby="glance-title">
        <div className="container">
          <header className={s.head}>
            <div>
              <span className={s.eyebrow}>The Assembly now</span>
              <h2 className={s.h2} id="glance-title">At a glance</h2>
              <p className={s.headSub}>Voting, attendance and legislation across the {mandate.label} mandate, updated daily from the public record.</p>
            </div>
          </header>

          <div className={s.bento}>
            <div className={`${s.tile} ${s.tLatest}`}>
              <div className={s.tileHead}>
                <span className={s.cardHead}>
                  <span className={`${s.iconTile} ${s.tnBlue}`}><Vote size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={s.tileTitle}>Latest divisions</span>
                </span>
                <Link href={`${basePath}/assembly/votes`} className={s.pillLink} aria-label="All divisions">
                  All <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
              <ul className={s.divList}>
                {divisions.map((div) => (
                  <li key={div.id}>
                    <Link href={`${basePath}/assembly/divisions/${div.id}`} className={s.divRow}>
                      <span className={s.divDate} aria-hidden="true">
                        <span className={s.divDay}>{div.day}</span>
                        <span className={s.divMonth}>{div.month}</span>
                      </span>
                      <span className="sr-only">{div.day} {div.month}: </span>
                      <span className={s.divMain}>
                        <span className={s.divTitle}>{div.title}</span>
                        {div.category && (
                          <span className={`${s.chip} ${div.isRegs ? s.chipRegs : s.chipBill}`}>
                            <div.CategoryIcon size={12} strokeWidth={2} aria-hidden="true" />
                            {div.category}
                          </span>
                        )}
                      </span>
                      <span className={`${s.badge} ${div.passed ? s.badgePass : s.badgeFail}`}>
                        {div.passed ? <CheckCircle2 size={14} strokeWidth={2.25} aria-hidden="true" /> : <XCircle size={14} strokeWidth={2.25} aria-hidden="true" />}
                        {div.passed ? 'Passed' : 'Failed'}
                      </span>
                      <ArrowRight className={s.rowArrow} size={18} strokeWidth={2} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className={`${s.tile} ${s.tAttend}`}>
              <span className={s.cardHead}>
                <span className={`${s.iconTile} ${s.tnGreen}`}><Users size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={s.tileLabel}>Average attendance</span>
              </span>
              <div className={s.attendBody}>
                <span className={s.ringWrapLg}>
                  <Ring pct={Number(avgAttendance)} label={`Average attendance ${avgAttendance}%`} />
                  <span className={s.ringNumLg}>{avgAttendance}<span>%</span></span>
                </span>
                <p className={s.tileText}>On average, current MLAs have voted in this share of divisions since {mandate.startLabel}.</p>
              </div>
            </div>

            <div className={`${s.tile} ${s.tDiv}`}>
              <span className={s.cardHead}>
                <span className={`${s.iconTile} ${s.tnBlue}`}><BarChart3 size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={s.tileLabel}>Divisions this month ({currentMonthName})</span>
              </span>
              <div className={s.statRow}>
                <span className={s.bigNum}>{Number(divisionsThisMonth)}</span>
                {delta(divisionsDelta, 'month')}
              </div>
              <BarChart data={divisionsBars} tone="var(--sw-accent)" title="Divisions per month" unit={['Division', 'Divisions']} />
            </div>

            <div className={`${s.tile} ${s.tBills}`}>
              <span className={s.cardHead}>
                <span className={`${s.iconTile} ${s.tnAmber}`}><Scale size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={s.tileLabel}>Bills passed this year</span>
              </span>
              <div className={s.statRow}>
                <span className={s.bigNum}>{billsThisYear}</span>
                {delta(billsYearDelta, 'year')}
              </div>
              <BarChart data={billsBars} tone="var(--sw-accent-warm)" title="Bills passed per month" unit={['Bill passed', 'Bills passed']} />
            </div>

            {mostEngaged ? voter(mostEngaged, 'top') : <div />}
            {leastEngaged ? voter(leastEngaged, 'low') : <div />}
          </div>
        </div>
      </section>

      <section className={`${s.band} ${s.bandPlain}`} aria-labelledby="week-title">
        <div className="container">
          <header className={s.head}>
            <div>
              <span className={s.eyebrow}>Assembly activity</span>
              <h2 className={s.h2} id="week-title">This week at Stormont</h2>
            </div>
          </header>
          <div className={s.week}>
            <ul className={s.kpis}>
              <li className={s.kpi}>
                <span className={`${s.iconTile} ${s.tnBlue}`}><Vote size={20} strokeWidth={2} aria-hidden="true" /></span>
                <span className={s.statValue}>{stats.thisWeekDivisions}</span>
                <span className={s.statLabel}>Divisions held</span>
              </li>
              <li className={s.kpi}>
                <span className={`${s.iconTile} ${s.tnAmber}`}><Scale size={20} strokeWidth={2} aria-hidden="true" /></span>
                <span className={s.statValue}>{stats.thisWeekBills}</span>
                <span className={s.statLabel}>Bills progressed</span>
              </li>
              <li className={s.kpi}>
                <span className={`${s.iconTile} ${s.tnGreen}`}><CheckCircle2 size={20} strokeWidth={2} aria-hidden="true" /></span>
                <span className={s.statValue}>{stats.thisWeekPassRate !== null ? `${stats.thisWeekPassRate}%` : 'N/A'}</span>
                <span className={s.statLabel}>Division pass %</span>
              </li>
              <li className={s.kpi}>
                <span className={`${s.iconTile} ${s.tnGrey}`}><CalendarDays size={20} strokeWidth={2} aria-hidden="true" /></span>
                <span className={s.statValue}>{lastSat ? <span>{lastSat.day}<sup className={s.ordinal}>{lastSat.suffix}</sup> {lastSat.month}</span> : '-'}</span>
                <span className={s.statLabel}>Assembly last sat</span>
              </li>
            </ul>
            <div className={s.scheduleWrap}>
              {scheduleDays.length === 0 ? (
                <div className={s.empty}>
                  <span className={`${s.iconTile} ${s.tnAmber}`}><CalendarOff size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <div className={s.emptyBody}>
                    <p className={s.emptyTitle}>Nothing scheduled this week</p>
                    <p className={s.emptySub}>No plenary sittings, bill stages or committee meetings are listed for this week.</p>
                  </div>
                </div>
              ) : (
                <Schedule days={scheduleDays} />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={`${s.band} ${s.bandTint}`} aria-labelledby="bills-title">
        <div className={`container ${s.rail}`}>
          <div className={s.railHead}>
            <span className={s.eyebrow}>Legislation</span>
            <h2 className={s.h2} id="bills-title">Active legislation</h2>
            <p className={s.headSub}>Bills currently moving through the Assembly, and the stage each has reached.</p>
            <Link href={`${basePath}/assembly/bills`} className={s.btnPrimary}>
              <span className={s.btnIcon}><Scale size={18} strokeWidth={2} aria-hidden="true" /></span>
              <span className={s.btnLabel}>All bills</span>
              <span className={s.btnDesc}>See every bill and where it has got to.</span>
              <ArrowRight className={s.btnArrow} size={20} strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
          <ul className={s.billList}>
            {inProgressBills.map((bill) => {
              const slug = bill.billId.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-')
              return (
                <li key={bill.billId}>
                  <Link href={`${basePath}/assembly/bills/${slug}`} className={s.billRow}>
                    <span className={`${s.iconTile} ${s.tnBlue}`}><Scale size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <span className={s.billMain}>
                      <span className={s.billTitle} title={bill.shortTitle}>{bill.shortTitle}</span>
                      <span className={s.billSub}>
                        <span className={s.billMeta}>
                          {[bill.latestDate ? formatDate(String(bill.latestDate)) : null, bill.billType].filter(Boolean).join(' · ')}
                        </span>
                        {bill.currentStage && (
                          <span className={s.stagePill}>
                            <Milestone size={14} strokeWidth={2} aria-hidden="true" />
                            {bill.latestDate && new Date(bill.latestDate) > now ? `Scheduled: ${bill.currentStage}` : bill.currentStage}
                          </span>
                        )}
                      </span>
                    </span>
                    <ArrowRight className={s.rowArrow} size={18} strokeWidth={2} aria-hidden="true" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section id="find-your-mla" className={`${s.band} ${s.bandPlain}`} aria-labelledby="mla-title">
        <div className="container">
          <header className={s.head}>
            <div>
              <span className={s.eyebrow}>Your representatives</span>
              <h2 className={s.h2} id="mla-title">Find your MLAs</h2>
              <p className={s.headSub}>Pick your constituency on the map to see the five MLAs who represent you.</p>
            </div>
          </header>
          <MlaFinder mlasByConstituency={mlasByConstituency} />
        </div>
      </section>

      <section className={`${s.band} ${s.bandTint}`} aria-labelledby="stats-title">
        <div className="container">
          <header className={s.head}>
            <div>
              <span className={s.eyebrow}>Statistics</span>
              <h2 className={s.h2} id="stats-title">Dig into the numbers</h2>
              <p className={s.headSub}>Voting, spending and parliamentary activity across the {mandate.label} mandate.</p>
            </div>
            <Link href={`${basePath}/assembly/stats`} className={s.btnAmber}>
              <span className={s.btnIcon}><Telescope size={18} strokeWidth={2} aria-hidden="true" /></span>
              <span className={s.btnLabel}>All Statistics</span>
              <span className={s.btnDesc}>See all statistics for the {mandate.label} mandate.</span>
              <ArrowRight className={s.btnArrow} size={20} strokeWidth={2} aria-hidden="true" />
            </Link>
          </header>
          <div className={s.statTiles}>
            <Link href={`${basePath}/assembly/stats/voting`} className={`${s.sTile} ${s.sGreen}`}>
              <span className={s.sIcon}><Vote size={24} strokeWidth={2} aria-hidden="true" /></span>
              <span className={s.sTitle}>Voting</span>
              <span className={s.sDesc}>How MLAs and parties vote. Attendance records, party cohesion, rebellion rates and cross-community trends since {mandate.startLabel}.</span>
              <ArrowRight className={s.sArrow} size={22} strokeWidth={2} aria-hidden="true" />
            </Link>
            <Link href={`${basePath}/assembly/stats/spending`} className={`${s.sTile} ${s.sAmber}`}>
              <span className={s.sIcon}><PoundSterling size={24} strokeWidth={2} aria-hidden="true" /></span>
              <span className={s.sTitle}>Spending</span>
              <span className={s.sDesc}>Salaries, office expenses and overall public cost of the Assembly since {mandate.startLabel}.</span>
              <ArrowRight className={s.sArrow} size={22} strokeWidth={2} aria-hidden="true" />
            </Link>
            <Link href={`${basePath}/assembly/stats/activity`} className={`${s.sTile} ${s.sBlue}`}>
              <span className={s.sIcon}><MessageCircleQuestion size={24} strokeWidth={2} aria-hidden="true" /></span>
              <span className={s.sTitle}>Activity</span>
              <span className={s.sDesc}>Questions to ministers and chamber participation across the {mandate.label} mandate.</span>
              <ArrowRight className={s.sArrow} size={22} strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className={`${s.band} ${s.bandPlain}`} aria-labelledby="facts-title">
        <div className="container">
          <header className={s.head}>
            <div>
              <span className={s.eyebrow}>Did you know</span>
              <h2 className={s.h2} id="facts-title">By the numbers</h2>
            </div>
          </header>
          <div>
            <Facts
              familyEmployed={stats.familyEmployed}
              fundedVisits={stats.fundedVisits}
              outsideEmployment={stats.outsideEmployment}
              giftsHospitality={stats.giftsHospitality}
              sittingDays={sittingDays}
              overallAgreementRate={overallAgreementRate}
              totalExpensesClaimed={totalExpensesClaimed}
              totalQuestions={totalQuestionCount}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
