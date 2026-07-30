import Link from 'next/link'
import Image from 'next/image'
import { Scale, CheckCircle2, CalendarDays, Users, Activity, CalendarX, Trophy, TrendingDown, BarChart3, Telescope, MapPin, Vote, FileText, Megaphone, PenLine, Lightbulb } from 'lucide-react'
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
import styles from './home.module.css'
import type { Mandate } from '@/lib/constants/mandates'

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

// Shared by the live route and the archive route; mandate/basePath vary per route.
export default async function HomePageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const now = new Date()
  const weekStartDate = new Date(now)
  const todayDay = now.getDay()
  if (todayDay === 6) weekStartDate.setDate(now.getDate() + 2)       // Saturday → next Monday
  else if (todayDay === 0) weekStartDate.setDate(now.getDate() + 1)  // Sunday → next Monday
  else weekStartDate.setDate(now.getDate() + (1 - todayDay))         // Mon–Fri → this Monday
  const weekStart = weekStartDate.toISOString().slice(0, 10)

  const [stats, avgAttendance, leastEngaged, mostEngaged, latestDivisions, inProgressBills,
    inProgressBillsCount, divisionsPerMonth, billsPassedPerMonth, weeklyDiary, mlasByConstituency,
    sittingDays, overallAgreementRate, totalExpensesData, questionTotalsRaw] =
    await Promise.all([
      getHomepageStats(mandate.id),
      getAverageAttendance(mandate.id),
      getLeastEngagedMLA(mandate.id),
      getMostEngagedMLA(mandate.id),
      getLatestDivisions(5, mandate.id),
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
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroImageWrap}>
          <Image
            src="/stormont.jpg"
            alt="Parliament Buildings, Stormont, Belfast"
            width={1280}
            height={960}
            className={styles.heroImage}
            priority
          />
        </div>
        <div className={styles.heroOverlay} />
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            <span className={styles.heroEyebrow}>Mandate {mandate.label}</span>
          </div>
          <div>
            <h1 className={styles.heroTitle}>Every vote. Every bill.<br className={styles.heroBr} /> <em>On record.</em></h1>
            <p className={styles.heroSub}>Independent, plain-language tracking of the Northern Ireland Assembly. Browse 90 MLAs, committee votes, legislation and Executive decisions. All from the public record, updated daily.</p>
          </div>
          <div className={styles.heroBottom}>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <Vote className={`${styles.heroStatIcon} ${styles.heroStatIconBlue}`} strokeWidth={1.6} aria-hidden="true" />
                <span className={styles.heroStatNum}>{stats.totalDivisions}</span>
                <div className={styles.heroStatMeta}>
                  <span className={styles.heroStatLabel}>Divisions</span>
                  <span className={styles.heroStatSub}>since {mandate.startLabel}</span>
                </div>
              </div>
              <div className={styles.heroStat}>
                <Scale className={`${styles.heroStatIcon} ${styles.heroStatIconAmber}`} strokeWidth={1.6} aria-hidden="true" />
                <span className={styles.heroStatNum}>{inProgressBillsCount}</span>
                <div className={styles.heroStatMeta}>
                  <span className={styles.heroStatLabel}>Bills active</span>
                  <span className={styles.heroStatSub}>in progress</span>
                </div>
              </div>
              <div className={styles.heroStat}>
                <Users className={`${styles.heroStatIcon} ${styles.heroStatIconGreen}`} strokeWidth={1.6} aria-hidden="true" />
                <span className={styles.heroStatNum}>{avgAttendance}<span className={styles.heroStatPct}>%</span></span>
                <div className={styles.heroStatMeta}>
                  <span className={styles.heroStatLabel}>Attendance</span>
                  <span className={styles.heroStatSub}>since {mandate.startLabel}</span>
                </div>
              </div>
            </div>
            <Link href={`${basePath}/assembly/votes`} className={styles.heroBrowseBtn}>Browse all votes</Link>
          </div>
        </div>
        <p className={styles.heroCredit}>
          <a href="https://www.flickr.com/photos/robertpaulyoung/64563230/" target="_blank" rel="noopener noreferrer">Robert Paul Young</a> · CC BY 4.0
        </p>
      </section>

      {/* This week strip */}
      <section className={`${styles.section} ${styles.agendaSection}`}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Assembly activity</span>
            <h2 className={styles.sectionTitle}>
              <Activity className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              This week at Stormont
            </h2>
          </div>
        </div>
        <div className={styles.twStrip}>
          <div className={styles.twCell}>
            <div className={styles.twLabelRow}>
              <div className={styles.twLabel}>Divisions held</div>
              <Vote className={styles.twIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className={styles.twVal}>{stats.thisWeekDivisions}</div>
          </div>
          <div className={styles.twCell}>
            <div className={styles.twLabelRow}>
              <div className={styles.twLabel}>Bills progressed</div>
              <Scale className={styles.twIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className={styles.twVal}>{stats.thisWeekBills}</div>
          </div>
          <div className={styles.twCell}>
            <div className={styles.twLabelRow}>
              <div className={styles.twLabel}>Division Pass %</div>
              <CheckCircle2 className={styles.twIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className={styles.twVal}>{stats.thisWeekPassRate !== null ? `${stats.thisWeekPassRate}%` : 'N/A'}</div>
          </div>
          <div className={styles.twCell}>
            <div className={styles.twLabelRow}>
              <div className={styles.twLabel}>
                <span className={styles.twLabelFull}>Last sat</span>
                <span className={styles.twLabelShort}>Assembly Last Sat</span>
              </div>
              <CalendarDays className={styles.twIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className={styles.twVal}>{stats.lastSat ? formatDate(stats.lastSat) : '-'}</div>
          </div>
        </div>

        {(() => {
          const BILL_ID_RE = /\s*\(NIA Bill [^)]*\)?$/

          const weekdays = weeklyDiary.filter(d => d.weekday !== 'Saturday' && d.weekday !== 'Sunday')
          const hasContent = (d: typeof weekdays[0]) => d.plenary !== null || d.agenda.length > 0 || d.billStages.length > 0 || d.committees.length > 0
          const pastDays = weekdays.filter(d => d.isPast && hasContent(d))
          const futureDays = weekdays.filter(d => !d.isPast && !d.isToday && hasContent(d))
          const todayDay = weekdays.find(d => d.isToday && hasContent(d))

          const renderDay = (day: typeof weekdays[0]) => {
            const dayDate = new Date(`${day.date}T12:00:00Z`)
            const weekdayShort = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(dayDate).toUpperCase()
            const monthShort = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(dayDate)
            const dayNum = dayDate.getUTCDate()
            const startTime = day.plenary?.startTime
              ? formatLondonTime(day.plenary.startTime)
              : null

            return (
              <div key={day.date} className={`${styles.diaryRow}${day.isToday ? ` ${styles.diaryRowToday}` : ''}`}>
                <div className={styles.diaryDate}>
                  <span className={styles.diaryDateWeekday}>{weekdayShort}</span>
                  <span className={styles.diaryDateNum}>{dayNum}</span>
                  <span className={styles.diaryDateMonth}>{monthShort}</span>
                </div>

                <div className={styles.agendaDayCard}>

                {day.plenary !== null && (day.agenda.length > 0 || day.billStages.length > 0) ? (
                  <div className={styles.agendaSectionRow}>
                    <div className={styles.agendaSectionLabel}>Assembly business</div>
                    <div className={styles.agendaSittingLabel}>
                      {day.isPast ? 'Assembly sat' : 'Assembly sitting'}{startTime ? ` · ${startTime}` : ''}
                    </div>
                  </div>
                ) : day.plenary !== null ? (
                  <div className={styles.agendaSectionRow}>
                    <div className={styles.agendaSectionLabel}>Assembly business</div>
                    <div className={styles.agendaSittingLabel}>
                      {day.isPast ? 'Assembly sat' : 'Assembly sitting'}{startTime ? ` · ${startTime}` : ''}
                    </div>
                  </div>
                ) : null}

                {day.plenary !== null && day.agenda.length === 0 && day.billStages.length === 0 && (
                  <p className={styles.agendaEmpty}>Agenda details not available</p>
                )}

                {(day.agenda.length > 0 || day.billStages.length > 0) && (
                  <div className={styles.agendaDay}>
                    {day.agenda.map(item => {
                      const colonIdx = item.title.indexOf(':')
                      const typeLabel = colonIdx > -1
                        ? item.title.slice(0, colonIdx).trim()
                        : item.title.includes(' - Amendment') ? 'Amendment'
                        : item.plenaryTypeId === '5' ? 'Debate' : 'Motion'
                      const rawTitle = colonIdx > -1 ? item.title.slice(colonIdx + 1).trim() : item.title
                      const billIdMatch = rawTitle.match(/\(NIA Bill (\d+\/\d{2}-\d{2,4})\)$/)
                      const billId = billIdMatch ? `NIA Bill ${billIdMatch[1]}` : null
                      const displayTitle = rawTitle.replace(BILL_ID_RE, '').trim()
                      const slug = billId ? billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-') : null
                      const isProcedural = typeLabel === 'Motion' || typeLabel === 'Debate'
                      return (
                        <div key={item.documentId} className={styles.agendaItem}>
                          {slug ? (
                            <Link href={`${basePath}/assembly/bills/${slug}`} className={styles.agendaTitle}>{displayTitle}</Link>
                          ) : (
                            <span className={styles.agendaTitle}>{displayTitle}</span>
                          )}
                          <span className={isProcedural ? styles.agendaTypeProcedural : styles.agendaType}>{typeLabel}</span>
                        </div>
                      )
                    })}

                    {day.billStages.map(bs => {
                      const slug = bs.billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
                      return (
                        <div key={`${bs.billId}-${bs.stage}`} className={styles.agendaItem}>
                          <Link href={`${basePath}/assembly/bills/${slug}`} className={styles.agendaTitle}>{bs.shortTitle}</Link>
                          <span className={styles.agendaType}>{bs.stage}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {day.committees.length > 0 && (
                  <>
                    <div className={styles.agendaSectionRow}>
                      <div className={styles.agendaSectionLabel}>Committee meetings</div>
                    </div>
                    <div className={styles.agendaDay}>
                      {day.committees.map((c, i) => {
                        const time = c.startTime
                          ? formatLondonTime(c.startTime)
                          : null
                        return (
                          <div key={i} className={styles.agendaItem}>
                            <span className={styles.agendaTitle}>{c.organisationName}</span>
                            {time && <span className={styles.agendaTime}>{time}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                </div>
              </div>
            )
          }

          return (
            <>
              <div className={styles.agendaHeader}>
                <span className={styles.agendaHeaderTitle}>
                  <CalendarDays className={styles.agendaHeaderIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                  Schedule
                </span>
              </div>
              {pastDays.length === 0 && !todayDay && futureDays.length === 0 ? (
                <div className={`${styles.diaryRow} ${styles.diaryRowToday}`}>
                  <div className={styles.agendaWeekEmptyIconPanel}>
                    <CalendarX className={styles.agendaWeekEmptyIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div className={`${styles.agendaDayCard} ${styles.agendaWeekEmpty}`}>
                    <span>Nothing scheduled this week.</span>
                  </div>
                </div>
              ) : (
                <>
                  {pastDays.map(renderDay)}
                  {todayDay && renderDay(todayDay)}
                  {futureDays.map(renderDay)}
                </>
              )}
            </>
          )
        })()}
      </section>

      <hr className={`section-rule ${styles.mobileRule}`} />

      {/* Explore Statistics hub */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Statistics</span>
            <h2 className={styles.sectionTitle}>
              <BarChart3 className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              Dig into the numbers
            </h2>
            <p className={styles.sectionSubtitle}>Voting, spending and parliamentary activity across the {mandate.label} mandate.</p>
          </div>
        </div>
        <Link href={`${basePath}/assembly/stats`} className={styles.hubCardAll}>
          <Telescope className={styles.hubCardAllIcon} size={48} strokeWidth={1.5} aria-hidden="true" />
          <div className={styles.hubCardInner}>
            <span className={styles.hubCardTitle}>All Statistics</span>
            <span className={styles.hubCardDesc}>Every chart, ranking and breakdown in one place. Start here to explore the full picture.</span>
          </div>
        </Link>
        <div className={styles.hubGrid}>
          <Link href={`${basePath}/assembly/stats/spending`} className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardTitle}>Spending</span>
              <span className={styles.hubCardDesc}>Salaries, office expenses and overall public cost of the Assembly since {mandate.startLabel}.</span>
            </div>
          </Link>
          <Link href={`${basePath}/assembly/stats/activity`} className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardTitle}>Activity</span>
              <span className={styles.hubCardDesc}>Questions to ministers and chamber participation across the {mandate.label} mandate.</span>
            </div>
          </Link>
          <Link href={`${basePath}/assembly/stats/voting`} className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardTitle}>Voting</span>
              <span className={styles.hubCardDesc}>How MLAs and parties vote. Attendance records, party cohesion, rebellion rates and cross-community trends since {mandate.startLabel}.</span>
            </div>
          </Link>
        </div>
      </section>

      <hr className={`section-rule ${styles.mobileRule}`} />

      {/* Key figures strip */}
      <div className={styles.kfigs}>
        <div className={styles.kfig}>
          <div className={styles.kfigLabelRow}>
            <div className={styles.kfigLabel}>Divisions this month ({currentMonthName})</div>
            <Vote className={styles.kfigIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className={styles.kfigNum}>{Number(divisionsThisMonth)}</div>
          <div className={styles.kfigSub}>
            <span style={{ color: divisionsDelta > 0 ? 'var(--sw-success)' : divisionsDelta < 0 ? 'var(--sw-error)' : 'inherit' }}>
              {divisionsDelta > 0 ? `↑ ${divisionsDelta}` : divisionsDelta < 0 ? `↓ ${Math.abs(divisionsDelta)}` : '='}
            </span>{' '}vs last month
          </div>
          <div className={styles.kfigSpark}>
            <Sparkline data={divisionsSparkline} color="var(--sw-accent)" />
          </div>
        </div>
        <div className={styles.kfig}>
          <div className={styles.kfigLabelRow}>
            <div className={styles.kfigLabel}>Bills passed this year</div>
            <Scale className={styles.kfigIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className={`${styles.kfigNum} ${styles.amber}`}>{billsThisYear}</div>
          <div className={styles.kfigSub}>
            <span style={{ color: billsYearDelta > 0 ? 'var(--sw-success)' : billsYearDelta < 0 ? 'var(--sw-error)' : 'inherit' }}>
              {billsYearDelta > 0 ? `↑ ${billsYearDelta}` : billsYearDelta < 0 ? `↓ ${Math.abs(billsYearDelta)}` : '='}
            </span>{' '}vs last year
          </div>
          <div className={styles.kfigSpark}>
            <Sparkline data={billsPassedSparkline} color="var(--sw-accent-warm)" />
          </div>
        </div>
        {mostEngaged ? (
          <Link href={`${basePath}/assembly/mlas/${mostEngaged.personId}`} className={`${styles.kfig} ${styles.kfigMlaCard}`}>
            <div className={styles.kfigLabelRow}>
              <div className={styles.kfigLabel}>Top Voter</div>
              <Trophy className={styles.kfigIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className={styles.kfigMlaRow}>
              <div className={styles.kfigMlaPhoto}>
                {mostEngaged.imgUrl && <Image src={mostEngaged.imgUrl} alt={mostEngaged.fullName} fill sizes="72px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />}
              </div>
              <div className={styles.kfigMlaBody}>
                <span className={styles.kfigMlaName}>{mostEngaged.fullName}</span>
                {mostEngaged.constituency && <span className={styles.kfigMlaConstituency}>{mostEngaged.constituency}</span>}
                <span className="party-pill" data-party={abbreviateParty(mostEngaged.party)}>{abbreviateParty(mostEngaged.party)}</span>
              </div>
            </div>
            <div className={styles.kfigMlaFoot}>
              <span className={styles.kfigSub}>{mostEngaged.attendancePct}% attendance</span>
              <span className={styles.kfigSubMono}>{mostEngaged.attended}/{mostEngaged.total}</span>
            </div>
          </Link>
        ) : <div className={`${styles.kfig} ${styles.kfigMlaCard}`} />}
        {leastEngaged ? (
          <Link href={`${basePath}/assembly/mlas/${leastEngaged.personId}`} className={`${styles.kfig} ${styles.kfigMlaCard}`}>
            <div className={styles.kfigLabelRow}>
              <div className={styles.kfigLabel}>Lowest Voter</div>
              <TrendingDown className={styles.kfigIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className={styles.kfigMlaRow}>
              <div className={styles.kfigMlaPhoto}>
                {leastEngaged.imgUrl && <Image src={leastEngaged.imgUrl} alt={leastEngaged.fullName} fill sizes="72px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />}
              </div>
              <div className={styles.kfigMlaBody}>
                <span className={styles.kfigMlaName}>{leastEngaged.fullName}</span>
                {leastEngaged.constituency && <span className={styles.kfigMlaConstituency}>{leastEngaged.constituency}</span>}
                <span className="party-pill" data-party={abbreviateParty(leastEngaged.party)}>{abbreviateParty(leastEngaged.party)}</span>
              </div>
            </div>
            <div className={styles.kfigMlaFoot}>
              <span className={styles.kfigSub}>{leastEngaged.attendancePct}% attendance</span>
              <span className={styles.kfigSubMono}>{leastEngaged.attended}/{leastEngaged.total}</span>
            </div>
          </Link>
        ) : <div className={`${styles.kfig} ${styles.kfigMlaCard}`} />}
      </div>

      <hr className={`section-rule ${styles.mobileRule}`} />

      {/* Find your MLAs */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Your representatives</span>
            <h2 className={styles.sectionTitle}>
              <MapPin className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              Find your MLAs
            </h2>
          </div>
        </div>
        <ConstituencySelector mlasByConstituency={mlasByConstituency} />
      </section>

      <hr className={`section-rule ${styles.mobileRule}`} />

      {/* Recent divisions */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Assembly floor</span>
            <h2 className={styles.sectionTitle}>
              <Vote className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              Recent divisions
            </h2>
          </div>
          <Link href={`${basePath}/assembly/votes`} className={styles.viewAllBtn}>All divisions</Link>
        </div>
        <div className={styles.rowCardList}>
          {latestDivisions.map((div) => {
            const { title: rawTitle } = formatDivisionSubject(div.title ?? div.subject)
            const displayTitle = rawTitle.trim()
            const passed = /carried/i.test(div.outcome ?? '')
              || /passed/i.test(div.outcome ?? '')
              || /agreed/i.test(div.outcome ?? '')
            const d = div.divisionDate ? new Date(div.divisionDate) : null
            const t = div.title ?? ''
            const s = div.subject ?? ''
            const isStatutory = /^The draft /i.test(t) || /^Prayer of Annulment:/i.test(t) || /^Applicability Motion/i.test(t)
            const isBill = !isStatutory && (/NIA Bill/i.test(s) || /(?:First|Second|Committee|Consideration|Further Consideration|Final) Stage:/i.test(s))
            const billAmendMatch = isBill ? t.match(/^Amendment (\d+) -/i) : null
            const motionAmendMatch = !isBill && !isStatutory ? (div.title ?? '').match(/ - Amendment (\d+)$/i) : null
            const amendmentNum = billAmendMatch?.[1] ?? motionAmendMatch?.[1] ?? null
            const category = isStatutory ? 'Regulations' : isBill ? 'Bill' : 'Motion'
            const CategoryIcon = isStatutory ? FileText : isBill ? Scale : Megaphone
            const categoryClass = isStatutory ? styles.chipRegulations : isBill ? styles.chipBill : styles.chipMotion
            return (
              <div key={div.documentId} className={styles.divRow}>
                <div className={styles.divRowDate}>
                  {d ? (
                    <>
                      <span className={styles.divRowDateWeekday}>{d.toLocaleString('en-GB', { weekday: 'short' }).toUpperCase()}</span>
                      <span className={styles.divRowDateNum}>{d.getDate()}</span>
                      <span className={styles.divRowDateMonth}>{d.toLocaleString('en', { month: 'short' })}</span>
                    </>
                  ) : <span className={styles.divRowDateMonth}>-</span>}
                </div>
                <Link href={`${basePath}/assembly/divisions/${div.documentId}`} className={styles.rowCard}>
                  <div className={styles.rowCardMain}>
                    <div className={styles.divTitle}>{displayTitle}</div>
                    <div className={styles.divChips}>
                      <span className={`${styles.divChip} ${categoryClass}`}>
                        <CategoryIcon size={12} strokeWidth={2} aria-hidden="true" />
                        {category}
                      </span>
                      {amendmentNum && (
                        <span className={`${styles.divChip} ${styles.chipAmendment}`}>
                          <PenLine size={12} strokeWidth={2} aria-hidden="true" />
                          Amendment {amendmentNum}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={styles.divOutcome}>
                    <span className={styles.divOutcomeLabel}>Result</span>
                    <span className={`${styles.divOutcomeBadge} ${passed ? styles.divOutcomeBadgePass : styles.divOutcomeBadgeFail}`}>
                      {passed ? 'Passed' : 'Failed'}
                    </span>
                  </span>
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      <hr className={`section-rule ${styles.mobileRule}`} />

      {/* Active legislation */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Legislation</span>
            <h2 className={styles.sectionTitle}>
              <Scale className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              Active legislation
            </h2>
          </div>
          <Link href={`${basePath}/assembly/bills`} className={styles.viewAllBtn}>All bills</Link>
        </div>
        <div className={styles.rowCardList}>
          {inProgressBills.map((bill) => {
            const slug = bill.billId.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-')
            return (
              <Link key={bill.billId} href={`${basePath}/assembly/bills/${slug}`} className={styles.rowCard}>
                <div className={styles.rowCardMain}>
                  <div className={styles.billTitle}>{bill.shortTitle}</div>
                  <span className={styles.pillType}>
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

      <hr className={`section-rule ${styles.mobileRule}`} />

      {/* Did you know */}
      <section className={`${styles.section} ${styles.sectionLast}`}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Did you know</span>
            <h2 className={styles.sectionTitle}>
              <Lightbulb className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              By the numbers
            </h2>
          </div>
        </div>
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
      </section>

    </div>
  )
}
