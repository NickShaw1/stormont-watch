import Link from 'next/link'
import Image from 'next/image'
import {
  Scale, CheckCircle2, CalendarDays, Users, Activity, CalendarX, Trophy, TrendingDown, BarChart3,
  Telescope, MapPin, Vote, FileText, Lightbulb, PoundSterling, MessageCircleQuestion,
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
import Sparkline from '@/components/Sparkline'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import { formatDate, abbreviateParty } from '@/lib/format'
import RotatingFact from '@/components/RotatingFact'
import ConstituencySelector from '@/app/components/ConstituencySelector'
import BillStagePill from '@/app/components/BillStagePill'
import ScheduleAccordion, { type ScheduleDay, type ScheduleEntry } from './ScheduleAccordion'
import home from './home.module.css'
import styles from './homeLayout.module.css'
import type { Mandate } from '@/lib/constants/mandates'

const BILL_ID_RE = /\s*\(NIA Bill [^)]*\)?$/

function formatLondonTime(input: string): string {
  const date = new Date(input.replace(' ', 'T').replace(/\+00$/, '+00:00'))
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London',
  }).formatToParts(date)
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
  const m = parts.find(p => p.type === 'minute')?.value ?? '00'
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m} ${period}`
}

type IconType = React.ComponentType<{ className?: string; size?: number; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>

function SectionHead({
  eyebrow, title, Icon, sub, action,
}: {
  eyebrow: React.ReactNode
  title: React.ReactNode
  Icon: IconType
  sub?: string
  action?: React.ReactNode
}) {
  return (
    <div className={`${home.sectionHead}`}>
      <div>
        <span className={home.sectionEyebrow}>{eyebrow}</span>
        <h2 className={`${home.sectionTitle} ${styles.big}`}>
          <Icon className={home.sectionTitleIcon} size={30} strokeWidth={1.75} aria-hidden="true" />
          {title}
        </h2>
        {sub && <p className={home.sectionSubtitle}>{sub}</p>}
      </div>
      {action}
    </div>
  )
}

// Shared by the live route and the archive route; mandate/basePath vary per route.
export default async function HomePageBody({ mandate, basePath }: { mandate: Mandate; basePath: string }) {
  const now = new Date()
  const weekStartDate = new Date(now)
  const todayDay = now.getDay()
  weekStartDate.setDate(now.getDate() - ((todayDay + 6) % 7))
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

  const totalExpensesClaimed = totalExpensesData.reduce((s, r) => s + parseFloat(r.totalExpenses), 0)
  const totalQuestionCount = questionTotalsRaw.reduce((s, r) => s + Number(r.total), 0)

  const divisionsSparkline = divisionsPerMonth.slice(-12).map((r) => Number(r.total_divisions))
  const billsPassedSparkline = billsPassedPerMonth.slice(-12).map((r) => Number(r.bills_passed))

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

  const heroDivisions = latestDivisions.map((div) => {
    const t = div.title ?? ''
    const s = div.subject ?? ''
    const isStatutory = /^The draft /i.test(t) || /^Prayer of Annulment:/i.test(t) || /^Applicability Motion/i.test(t)
    const isBill = !isStatutory && (/NIA Bill/i.test(s) || /(?:First|Second|Committee|Consideration|Further Consideration|Final) Stage:/i.test(s))
    const d = div.divisionDate ? new Date(div.divisionDate) : null
    return {
      id: div.documentId,
      title: formatDivisionSubject(div.title ?? div.subject).title.trim(),
      category: isStatutory ? 'Regulations' : isBill ? 'Bill' : null,
      CategoryIcon: isStatutory ? FileText : Scale,
      categoryClass: isStatutory ? home.heroChipRegs : home.heroChipBill,
      passed: /carried|passed|agreed/i.test(div.outcome ?? ''),
      day: d ? String(d.getDate()) : '-',
      month: d ? d.toLocaleString('en', { month: 'short' }) : '',
    }
  })

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

  const latestCard = () => (
    <aside className={`${home.heroGlass} ${home.heroCard}`} aria-label="Latest divisions">
      <div className={home.heroCardHead}>
        <span className={home.heroCardTitle}>Latest divisions</span>
        <Link href={`${basePath}/assembly/votes`} className={home.heroCardAll} aria-label="All divisions">All</Link>
      </div>
      {heroDivisions.map((div) => (
        <Link key={div.id} href={`${basePath}/assembly/divisions/${div.id}`} className={home.heroRow}>
          <span className={home.heroRowDate} aria-hidden="true">
            <span className={home.heroRowDay}>{div.day}</span>
            <span className={home.heroRowMonth}>{div.month}</span>
          </span>
          <span className={home.heroSrOnly}>{div.day} {div.month}: </span>
          <span className={home.heroRowMain}>
            <span className={home.heroRowTitle}>{div.title}</span>
            {div.category && (
              <span className={`${home.heroChip} ${div.categoryClass}`}>
                <div.CategoryIcon size={12} strokeWidth={2} aria-hidden="true" />
                {div.category}
              </span>
            )}
          </span>
          <span className={`${home.heroBadge} ${div.passed ? home.heroBadgePass : home.heroBadgeFail}`}>
            {div.passed ? 'Passed' : 'Failed'}
          </span>
        </Link>
      ))}
    </aside>
  )

  return (
    <div className={`container ${styles.page}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      {/* Hero */}
      <section className={home.hero}>
        <div className={home.heroPhotoWrap}>
          <Image
            src="/stormont.jpg"
            alt="Parliament Buildings, Stormont, Belfast"
            fill
            sizes="(max-width: 900px) calc(100vw - 32px), (max-width: 1180px) calc(100vw - 48px), 1132px"
            className={home.heroPhoto}
            priority
          />
        </div>
        <div className={home.heroScrim} />
        <p className={home.heroCredit}>
          <a href="https://www.flickr.com/photos/robertpaulyoung/64563230/" target="_blank" rel="noopener noreferrer">Robert Paul Young</a> · CC BY 4.0
        </p>
        <div className={home.heroInner}>
          <div className={home.heroLeft}>
            <span className={home.heroEyebrow}>Mandate {mandate.label}</span>
            <h1 className={home.heroTitle}>Every vote. Every bill.<br /> <em>On record.</em></h1>
            <p className={home.heroSub}>Independent, plain-language tracking of the Northern Ireland Assembly. Browse 90 MLAs, committee votes, legislation and Executive decisions. All from the public record, updated daily.</p>
          </div>
          {latestCard()}
        </div>
        <div className={`${home.heroChips} ${styles.chips}`}>
          <div className={`${home.heroGlass} ${home.heroStat} ${home.heroStatBlue}`}>
            <Vote className={`${home.heroStatIcon} ${home.heroStatIconBlue}`} size={22} strokeWidth={1.6} aria-hidden="true" />
            <span className={home.heroStatNum}>{stats.totalDivisions}</span>
            <span className={home.heroStatMeta}>
              <span>Divisions</span>
              <span>since {mandate.startLabel}</span>
            </span>
          </div>
          <div className={`${home.heroGlass} ${home.heroStat} ${home.heroStatAmber}`}>
            <Scale className={`${home.heroStatIcon} ${home.heroStatIconAmber}`} size={22} strokeWidth={1.6} aria-hidden="true" />
            <span className={home.heroStatNum}>{inProgressBillsCount}</span>
            <span className={home.heroStatMeta}>
              <span>Bills active</span>
              <span>in progress</span>
            </span>
          </div>
          <div className={`${home.heroGlass} ${home.heroStat} ${home.heroStatGreen}`}>
            <Users className={`${home.heroStatIcon} ${home.heroStatIconGreen}`} size={22} strokeWidth={1.6} aria-hidden="true" />
            <span className={home.heroStatNum}>{avgAttendance}<span className={home.heroStatPct}>%</span></span>
            <span className={home.heroStatMeta}>
              <span>Attendance</span>
              <span>since {mandate.startLabel}</span>
            </span>
          </div>
        </div>
      </section>

      {/* This week strip */}
      <section className={styles.sec}>
        <SectionHead eyebrow="Assembly activity" title="This week at Stormont" Icon={Activity} />
        <div className={home.twStrip}>
          <div className={home.twCell}>
            <span className={home.twMedal}><Vote size={18} strokeWidth={2} aria-hidden="true" /></span>
            <div className={home.twLabel}>Divisions held</div>
            <div className={home.twVal}>{stats.thisWeekDivisions}</div>
          </div>
          <div className={home.twCell}>
            <span className={home.twMedal}><Scale size={18} strokeWidth={2} aria-hidden="true" /></span>
            <div className={home.twLabel}>Bills progressed</div>
            <div className={home.twVal}>{stats.thisWeekBills}</div>
          </div>
          <div className={home.twCell}>
            <span className={home.twMedal}><CheckCircle2 size={18} strokeWidth={2} aria-hidden="true" /></span>
            <div className={home.twLabel}>Division Pass %</div>
            <div className={home.twVal}>{stats.thisWeekPassRate !== null ? `${stats.thisWeekPassRate}%` : 'N/A'}</div>
          </div>
          <div className={home.twCell}>
            <span className={home.twMedal}><CalendarDays size={18} strokeWidth={2} aria-hidden="true" /></span>
            <div className={home.twLabel}>
              <span className={home.twLabelFull}>Last sat</span>
              <span className={home.twLabelShort}>Assembly Last Sat</span>
            </div>
            <div className={`${home.twVal} ${home.twValDate}`}>{stats.lastSat ? formatDate(stats.lastSat) : '-'}</div>
          </div>
        </div>

        {scheduleDays.length === 0 ? (
          <>
            <div className={`${home.agendaHeader} ${styles.schedWrap}`}>
              <span className={home.agendaHeaderTitle} role="heading" aria-level={3}>
                <CalendarDays className={home.agendaHeaderIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                <><span className={styles.titleFull}>Assembly schedule</span><span className={styles.titleShort}>Schedule</span></>
              </span>
            </div>
            <div className={`${home.diaryRow} ${home.diaryRowToday}`}>
              <div className={home.agendaWeekEmptyIconPanel}>
                <CalendarX className={home.agendaWeekEmptyIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <div className={`${home.agendaDayCard} ${home.agendaWeekEmpty}`}>
                <span>Nothing scheduled this week.</span>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.schedWrap}><ScheduleAccordion days={scheduleDays} title={<><span className={styles.titleFull}>Assembly schedule</span><span className={styles.titleShort}>Schedule</span></>} /></div>
        )}
      </section>

      {/* Explore Statistics hub */}
      <section className={styles.sec}>
        <div>
          <SectionHead
            eyebrow="Statistics"
            title="Dig into the numbers"
            Icon={BarChart3}
            sub={`Voting, spending and parliamentary activity across the ${mandate.label} mandate.`}
          />
          <div className={styles.bento}>
            <Link href={`${basePath}/assembly/stats`} className={styles.bentoAll}>
              <Telescope className={styles.bentoAllIcon} size={120} strokeWidth={1} aria-hidden="true" />
              <span className={styles.bentoKicker}>Start here</span>
              <span className={styles.bentoAllTitle}>All Statistics</span>
              <span className={styles.bentoAllDesc}>Every chart, ranking and breakdown in one place. Start here to explore the full picture.</span>
            </Link>
            <Link href={`${basePath}/assembly/stats/spending`} className={`${styles.bentoCard} ${styles.bentoAmber}`}>
              <PoundSterling className={styles.bentoIcon} size={26} strokeWidth={1.6} aria-hidden="true" />
              <span className={styles.bentoTitle}>Spending</span>
              <span className={styles.bentoDesc}>Salaries, office expenses and overall public cost of the Assembly since {mandate.startLabel}.</span>
            </Link>
            <Link href={`${basePath}/assembly/stats/activity`} className={`${styles.bentoCard} ${styles.bentoBlue}`}>
              <MessageCircleQuestion className={styles.bentoIcon} size={26} strokeWidth={1.6} aria-hidden="true" />
              <span className={styles.bentoTitle}>Activity</span>
              <span className={styles.bentoDesc}>Questions to ministers and chamber participation across the {mandate.label} mandate.</span>
            </Link>
            <Link href={`${basePath}/assembly/stats/voting`} className={`${styles.bentoCard} ${styles.bentoGreen}`}>
              <Vote className={styles.bentoIcon} size={26} strokeWidth={1.6} aria-hidden="true" />
              <span className={styles.bentoTitle}>Voting</span>
              <span className={styles.bentoDesc}>How MLAs and parties vote. Attendance records, party cohesion, rebellion rates and cross-community trends since {mandate.startLabel}.</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Key figures strip */}
      <section className={`${styles.sec} ${styles.keyWrap}`}>
        <div className={home.kfigs}>
          {mostEngaged ? (
            <Link href={`${basePath}/assembly/mlas/${mostEngaged.personId}`} className={`${home.kfig} ${home.kfigMlaCard}`}>
              <div className={home.kfigBand}>
                <div className={home.kfigLabel}>Top Voter</div>
                <Trophy className={home.kfigIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <div className={home.kfigBody}>
                <div className={home.kfigMlaRow}>
                  <div className={home.kfigMedalWrap}>
                    <div className={home.kfigMlaPhoto}>
                      {mostEngaged.imgUrl && <Image src={mostEngaged.imgUrl} alt="" fill sizes="64px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />}
                    </div>
                    <span className={`${home.kfigMedal} ${home.kfigMedalTop}`}><Trophy size={13} strokeWidth={2} aria-hidden="true" /></span>
                  </div>
                  <div className={home.kfigMlaBody}>
                    <span className={home.kfigMlaName}>{mostEngaged.fullName}</span>
                    {mostEngaged.constituency && <span className={home.kfigMlaConstituency}>{mostEngaged.constituency}</span>}
                    <span className="party-pill" data-party={abbreviateParty(mostEngaged.party)}>{abbreviateParty(mostEngaged.party)}</span>
                  </div>
                </div>
                <span className={`${home.kfigBar} ${home.kfigBarTop}`} aria-hidden="true">
                  <span style={{ width: `${Math.max(0, Math.min(100, Number(mostEngaged.attendancePct)))}%` }} />
                </span>
                <div className={home.kfigMlaFoot}>
                  <span className={home.kfigSub}>{mostEngaged.attendancePct}% attendance</span>
                  <span className={home.kfigSubMono}>{mostEngaged.attended}/{mostEngaged.total}</span>
                </div>
                <span className={home.kfigMlaNote}>* Excludes presiding officers.</span>
              </div>
            </Link>
          ) : <div className={`${home.kfig} ${home.kfigMlaCard}`} />}
          {leastEngaged ? (
            <Link href={`${basePath}/assembly/mlas/${leastEngaged.personId}`} className={`${home.kfig} ${home.kfigMlaCard}`}>
              <div className={home.kfigBand}>
                <div className={home.kfigLabel}>Lowest Voter</div>
                <TrendingDown className={home.kfigIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <div className={home.kfigBody}>
                <div className={home.kfigMlaRow}>
                  <div className={home.kfigMedalWrap}>
                    <div className={home.kfigMlaPhoto}>
                      {leastEngaged.imgUrl && <Image src={leastEngaged.imgUrl} alt="" fill sizes="64px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />}
                    </div>
                    <span className={`${home.kfigMedal} ${home.kfigMedalLow}`}><TrendingDown size={13} strokeWidth={2} aria-hidden="true" /></span>
                  </div>
                  <div className={home.kfigMlaBody}>
                    <span className={home.kfigMlaName}>{leastEngaged.fullName}</span>
                    {leastEngaged.constituency && <span className={home.kfigMlaConstituency}>{leastEngaged.constituency}</span>}
                    <span className="party-pill" data-party={abbreviateParty(leastEngaged.party)}>{abbreviateParty(leastEngaged.party)}</span>
                  </div>
                </div>
                <span className={`${home.kfigBar} ${home.kfigBarLow}`} aria-hidden="true">
                  <span style={{ width: `${Math.max(0, Math.min(100, Number(leastEngaged.attendancePct)))}%` }} />
                </span>
                <div className={home.kfigMlaFoot}>
                  <span className={home.kfigSub}>{leastEngaged.attendancePct}% attendance</span>
                  <span className={home.kfigSubMono}>{leastEngaged.attended}/{leastEngaged.total}</span>
                </div>
                <span className={home.kfigMlaNote}>* Excludes presiding officers.</span>
              </div>
            </Link>
          ) : <div className={`${home.kfig} ${home.kfigMlaCard}`} />}
          <div className={home.kfig}>
            <div className={home.kfigBand}>
              <div className={home.kfigLabel}>Divisions this month ({currentMonthName})</div>
              <Vote className={home.kfigIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className={home.kfigBody}>
              <div className={home.kfigNum}>{Number(divisionsThisMonth)}</div>
              <div className={home.kfigSub}>
                <span style={{ color: divisionsDelta > 0 ? 'var(--sw-success)' : divisionsDelta < 0 ? 'var(--sw-error)' : 'inherit' }}>
                  {divisionsDelta > 0 ? `↑ ${divisionsDelta}` : divisionsDelta < 0 ? `↓ ${Math.abs(divisionsDelta)}` : '='}
                </span>{' '}vs last month
              </div>
              <div className={home.kfigSpark}>
                <Sparkline data={divisionsSparkline} color="var(--sw-accent)" height={48} />
              </div>
            </div>
          </div>
          <div className={home.kfig}>
            <div className={home.kfigBand}>
              <div className={home.kfigLabel}>Bills passed this year</div>
              <Scale className={home.kfigIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className={home.kfigBody}>
              <div className={home.kfigNum}>{billsThisYear}</div>
              <div className={home.kfigSub}>
                <span style={{ color: billsYearDelta > 0 ? 'var(--sw-success)' : billsYearDelta < 0 ? 'var(--sw-error)' : 'inherit' }}>
                  {billsYearDelta > 0 ? `↑ ${billsYearDelta}` : billsYearDelta < 0 ? `↓ ${Math.abs(billsYearDelta)}` : '='}
                </span>{' '}vs last year
              </div>
              <div className={home.kfigSpark}>
                <Sparkline data={billsPassedSparkline} color="var(--sw-accent-warm)" height={48} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Find your MLAs */}
      <section className={styles.sec}>
        <div>
          <SectionHead eyebrow="Your representatives" title="Find your MLAs" Icon={MapPin} />
          <ConstituencySelector mlasByConstituency={mlasByConstituency} />
        </div>
      </section>

      {/* Active legislation */}
      <section className={styles.sec}>
        <SectionHead
          eyebrow={<><span className={styles.titleFull}>Legislation</span><span className={styles.titleShort}>Bills</span></>}
          title={<><span className={styles.titleFull}>Active legislation</span><span className={styles.titleShort}>Legislation</span></>}
          Icon={Scale}
          action={<Link href={`${basePath}/assembly/bills`} className={home.viewAllBtn}>All bills</Link>}
        />
        <div className={home.rowCardList}>
          {inProgressBills.map((bill) => {
            const slug = bill.billId.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-')
            return (
              <Link key={bill.billId} href={`${basePath}/assembly/bills/${slug}`} className={home.rowCard}>
                <div className={home.rowCardMain}>
                  <div className={home.billTitle}>{bill.shortTitle}</div>
                  <span className={home.pillType}>
                    {[bill.latestDate ? formatDate(String(bill.latestDate)) : null, bill.billType].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <BillStagePill
                  category={bill.latestDate && new Date(bill.latestDate) > now ? 'scheduled' : 'in-progress'}
                  currentStage={bill.currentStage}
                  passed={null}
                />
              </Link>
            )
          })}
        </div>
      </section>

      {/* Did you know */}
      <section className={`${styles.sec} ${styles.last}`}>
        <div>
          <SectionHead eyebrow="Did you know" title="By the numbers" Icon={Lightbulb} />
<div className={styles.facts}>
          <RotatingFact
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
