export const dynamic = 'force-static'

import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
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

export const metadata: Metadata = {
  title: 'Stormont Watch',
  description: 'Stormont Watch tracks every vote, bill and expense in the Northern Ireland Assembly. See how your MLA votes, explore the full voting record and follow legislation since the 2022 mandate.',
  openGraph: {
    title: 'Stormont Watch',
    description: 'Stormont Watch tracks every vote, bill and expense in the Northern Ireland Assembly. See how your MLA votes, explore the full voting record and follow legislation since the 2022 mandate.',
    url: 'https://www.stormontwatch.com',
    images: [
      {
        url: 'https://www.stormontwatch.com/opengraph-image-v2.png',
        width: 1200,
        height: 630,
        alt: 'Stormont Watch — NI Assembly Transparency',
      },
    ],
  },
  alternates: { canonical: 'https://www.stormontwatch.com' },
}

export default async function HomePage() {
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
      getHomepageStats(),
      getAverageAttendance(),
      getLeastEngagedMLA(),
      getMostEngagedMLA(),
      getLatestDivisions(5),
      getInProgressBills(5),
      getActiveBillsCount(),
      getDivisionsPerMonth(),
      getBillsPassedPerMonth(),
      getWeeklyDiary(weekStart),
      getAllMlasByConstituency(),
      getSittingDays(),
      getOverallAgreementRate(),
      getTotalExpensesPerMember(),
      getQuestionTotalsAllMembers(),
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
    description: 'Stormont Watch tracks every vote, bill and expense in the Northern Ireland Assembly. See how your MLA votes, explore the full voting record and follow legislation since the 2022 mandate.',
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
            <span className={styles.heroEyebrow}>Mandate 2022 — 2027</span>
          </div>
          <div>
            <h1 className={styles.heroTitle}>Every vote. Every bill.<br className={styles.heroBr} /> <em>On record.</em></h1>
            <p className={styles.heroSub}>Independent, plain-language tracking of the Northern Ireland Assembly. Browse 90 MLAs, committee votes, legislation and Executive decisions. All from the public record, updated daily.</p>
          </div>
          <div className={styles.heroBottom}>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNum}>{stats.totalDivisions}</span>
                <div className={styles.heroStatMeta}>
                  <span className={styles.heroStatLabel}>Divisions</span>
                  <span className={styles.heroStatSub}>since May 2022</span>
                </div>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNum}>{inProgressBillsCount}</span>
                <div className={styles.heroStatMeta}>
                  <span className={styles.heroStatLabel}>Bills active</span>
                  <span className={styles.heroStatSub}>in progress</span>
                </div>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNum}>{avgAttendance}<span className={styles.heroStatPct}>%</span></span>
                <div className={styles.heroStatMeta}>
                  <span className={styles.heroStatLabel}>Attendance</span>
                  <span className={styles.heroStatSub}>since May 2022</span>
                </div>
              </div>
            </div>
            <Link href="/assembly/votes" className={styles.heroBrowseBtn}>Browse all votes <span aria-hidden="true">→</span></Link>
          </div>
        </div>
        <p className={styles.heroCredit}>
          <a href="https://www.flickr.com/photos/robertpaulyoung/64563230/" target="_blank" rel="noopener noreferrer">Robert Paul Young</a> · CC BY 4.0
        </p>
      </section>

      {/* Key figures strip */}
      <div className={styles.kfigs}>
        <div className={styles.kfig}>
          <div className={styles.kfigLabel}>Divisions this month ({currentMonthName})</div>
          <div className={styles.kfigNum}>{Number(divisionsThisMonth)}</div>
          <div className={styles.kfigSub}>
            <span style={{ color: divisionsDelta > 0 ? 'var(--forest)' : divisionsDelta < 0 ? 'var(--crimson)' : 'inherit' }}>
              {divisionsDelta > 0 ? `↑ ${divisionsDelta}` : divisionsDelta < 0 ? `↓ ${Math.abs(divisionsDelta)}` : '='}
            </span>{' '}vs last month
          </div>
          <div className={styles.kfigSpark}>
            <Sparkline data={divisionsSparkline} color="var(--teal)" />
          </div>
        </div>
        <div className={styles.kfig}>
          <div className={styles.kfigLabel}>Bills passed this year</div>
          <div className={`${styles.kfigNum} ${styles.amber}`}>{billsThisYear}</div>
          <div className={styles.kfigSub}>
            <span style={{ color: billsYearDelta > 0 ? 'var(--forest)' : billsYearDelta < 0 ? 'var(--crimson)' : 'inherit' }}>
              {billsYearDelta > 0 ? `↑ ${billsYearDelta}` : billsYearDelta < 0 ? `↓ ${Math.abs(billsYearDelta)}` : '='}
            </span>{' '}vs last year
          </div>
          <div className={styles.kfigSpark}>
            <Sparkline data={billsPassedSparkline} color="var(--ochre)" />
          </div>
        </div>
        {mostEngaged ? (
          <Link href={`/assembly/mlas/${mostEngaged.personId}`} className={`${styles.kfig} ${styles.kfigMlaCard}`}>
            <div className={styles.kfigLabel}>Top Voter</div>
            <div className={styles.kfigMlaPhoto}>
              {mostEngaged.imgUrl && <Image src={mostEngaged.imgUrl} alt={mostEngaged.fullName} fill sizes="96px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />}
            </div>
            <div className={styles.kfigMlaBody}>
              <span className={styles.kfigMlaName}>{mostEngaged.fullName}</span>
              <span className="party-pill" data-party={abbreviateParty(mostEngaged.party)}>{abbreviateParty(mostEngaged.party)}</span>
            </div>
            <div className={styles.kfigMlaFoot}>
              <span className={styles.kfigSub}>{mostEngaged.attendancePct}%<span className={styles.attFull}> attendance</span><span className={styles.attShort}> att.</span></span>
              <span className={styles.kfigSubMono}>{mostEngaged.attended}/{mostEngaged.total}</span>
            </div>
          </Link>
        ) : <div className={`${styles.kfig} ${styles.kfigMlaCard}`} />}
        {leastEngaged ? (
          <Link href={`/assembly/mlas/${leastEngaged.personId}`} className={`${styles.kfig} ${styles.kfigMlaCard}`}>
            <div className={styles.kfigLabel}>Lowest Voter</div>
            <div className={styles.kfigMlaPhoto}>
              {leastEngaged.imgUrl && <Image src={leastEngaged.imgUrl} alt={leastEngaged.fullName} fill sizes="96px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />}
            </div>
            <div className={styles.kfigMlaBody}>
              <span className={styles.kfigMlaName}>{leastEngaged.fullName}</span>
              <span className="party-pill" data-party={abbreviateParty(leastEngaged.party)}>{abbreviateParty(leastEngaged.party)}</span>
            </div>
            <div className={styles.kfigMlaFoot}>
              <span className={styles.kfigSub}>{leastEngaged.attendancePct}%<span className={styles.attFull}> attendance</span><span className={styles.attShort}> att.</span></span>
              <span className={styles.kfigSubMono}>{leastEngaged.attended}/{leastEngaged.total}</span>
            </div>
          </Link>
        ) : <div className={`${styles.kfig} ${styles.kfigMlaCard}`} />}
      </div>

      {/* Explore Statistics hub */}
      <section className={styles.section}>
        <div className={styles.sectionHead} style={{ marginBottom: 'var(--s-2)' }}>
          <div>
            <span className={styles.sectionEyebrow}>Statistics</span>
            <h2 className={styles.sectionTitle}>Explore Statistics</h2>
          </div>
          <Link href="/assembly/stats" className={styles.viewAll}>All stats <span aria-hidden="true">↗</span></Link>
        </div>
        <p className={styles.sectionSubtitle} style={{ marginBottom: 'var(--s-4)' }}>Voting, spending and parliamentary activity across the 2022 to 2027 mandate.</p>
        <div className={styles.hubGrid}>
          <Link href="/assembly/stats/spending" className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Public spending</span>
              <span className={styles.hubCardTitle}>Spending</span>
              <span className={styles.hubCardDesc}>Salaries, office expenses and overall public cost of the Assembly since May 2022.</span>
            </div>
            <span className={styles.hubCardArrow} aria-hidden="true">View spending ↗</span>
          </Link>
          <Link href="/assembly/stats/activity" className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Parliamentary activity</span>
              <span className={styles.hubCardTitle}>Activity</span>
              <span className={styles.hubCardDesc}>Questions to ministers and chamber participation across the 2022–2027 mandate.</span>
            </div>
            <span className={styles.hubCardArrow} aria-hidden="true">View activity ↗</span>
          </Link>
          <Link href="/assembly/stats/voting" className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Voting and attendance</span>
              <span className={styles.hubCardTitle}>Voting</span>
              <span className={styles.hubCardDesc}>How MLAs and parties vote. Attendance records, party cohesion, rebellion rates and cross-community trends since May 2022.</span>
            </div>
            <span className={styles.hubCardArrow} aria-hidden="true">View voting ↗</span>
          </Link>
        </div>
      </section>

      <hr className={`section-rule ${styles.mobileRule}`} />

      {/* Find your MLAs */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Your representatives</span>
            <h2 className={styles.sectionTitle}>Find your MLAs</h2>
          </div>
        </div>
        <ConstituencySelector mlasByConstituency={mlasByConstituency} />
      </section>

      <hr className={`section-rule ${styles.mobileRule}`} />

      {/* This week strip */}
      <section className={`${styles.section} ${styles.agendaSection}`}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Assembly activity</span>
            <h2 className={styles.sectionTitle}>This week at Stormont</h2>
          </div>
        </div>
        <div className={styles.twStrip}>
          <div className={styles.twCell}>
            <div className={styles.twLabel}>Divisions</div>
            <div className={styles.twVal}>{stats.thisWeekDivisions}</div>
          </div>
          <div className={styles.twCell}>
            <div className={styles.twLabel}>Bills progressed</div>
            <div className={styles.twVal}>{stats.thisWeekBills}</div>
          </div>
          <div className={styles.twCell}>
            <div className={styles.twLabel}>Pass rate</div>
            <div className={styles.twVal}>{stats.thisWeekPassRate !== null ? `${stats.thisWeekPassRate}%` : '—'}</div>
          </div>
          <div className={styles.twCell}>
            <div className={styles.twLabel}>Last sat</div>
            <div className={`${styles.twVal} ${styles.twValSm}`}>{stats.lastSat ? formatDate(stats.lastSat) : '—'}</div>
          </div>
        </div>

        {(() => {
          const mondayLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${weekStart}T12:00:00Z`))
          const BILL_ID_RE = /\s*\(NIA Bill \d+\/\d{2}-\d{2,4}\)$/

          const weekdays = weeklyDiary.filter(d => d.weekday !== 'Saturday' && d.weekday !== 'Sunday')
          const hasContent = (d: typeof weekdays[0]) => d.plenary !== null || d.agenda.length > 0 || d.billStages.length > 0 || d.committees.length > 0
          const pastDays = weekdays.filter(d => d.isPast)
          const futureDays = weekdays.filter(d => !d.isPast && !d.isToday)
          const todayDay = weekdays.find(d => d.isToday)

          const renderDay = (day: typeof weekdays[0]) => {
            const dateLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(`${day.date}T12:00:00Z`))
            const startTime = day.plenary?.startTime
              ? new Date(day.plenary.startTime.replace(' ', 'T').replace('+00', '+00:00')).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' })
              : null
            const dayHasContent = hasContent(day)

            return (
              <div key={day.date} className={`${styles.agendaDayGroup}${day.isToday ? ` ${styles.agendaDayToday}` : ''}`}>
                <div className={styles.agendaDayLabel}>
                  <span className={styles.agendaDayDot} aria-hidden="true">•</span>{dateLabel}
                </div>

                {day.plenary !== null && (day.agenda.length > 0 || day.billStages.length > 0) ? (
                  <div className={styles.agendaSectionRow}>
                    <div className={styles.agendaSectionLabel}>Assembly business</div>
                    <div className={styles.agendaSittingLabel}>
                      {day.isPast ? 'Assembly sat' : 'Assembly sitting'}{startTime ? ` · ${startTime}` : ''}
                    </div>
                  </div>
                ) : day.plenary !== null ? (
                  <div className={styles.agendaSittingLabel}>
                    {day.isPast ? 'Assembly sat' : 'Assembly sitting'}{startTime ? ` · ${startTime}` : ''}
                  </div>
                ) : null}

                {!dayHasContent && (
                  <p className={styles.agendaEmpty}>No business scheduled</p>
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
                            <Link href={`/assembly/bills/${slug}`} className={styles.agendaTitle}>{displayTitle}</Link>
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
                          <Link href={`/assembly/bills/${slug}`} className={styles.agendaTitle}>{bs.shortTitle}</Link>
                          <span className={styles.agendaType}>{bs.stage}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {day.committees.length > 0 && (
                  <>
                    <div className={styles.agendaSectionLabel} style={{ marginTop: 'var(--s-5)' }}>Committee meetings</div>
                    <div className={styles.agendaDay}>
                      {day.committees.map((c, i) => {
                        const time = c.startTime
                          ? new Date(c.startTime.replace(' ', 'T').replace('+00', '+00:00')).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' })
                          : null
                        return (
                          <div key={i} className={styles.agendaItem}>
                            <span className={styles.agendaTitle}>{c.organisationName}</span>
                            {time && <span style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{time}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )
          }

          return (
            <>
              <div className={styles.agendaHeader}>
                <span>On the <em>floor</em></span>
                <span><span className={styles.agendaWc}>Week commencing </span><span className={styles.agendaWcShort}>w/c </span>{mondayLabel}</span>
              </div>
              {pastDays.map(renderDay)}
              {todayDay && renderDay(todayDay)}
              {futureDays.map(renderDay)}
            </>
          )
        })()}
      </section>

      <hr className={`section-rule ${styles.mobileRule}`} />

      {/* Latest votes + Bills in progress */}
      <div className={styles.twoCol}>
        {/* Headers — each occupies one column in the shared grid */}
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Assembly floor</span>
            <h2 className={styles.sectionTitle}>Recent divisions</h2>
          </div>
          <Link href="/assembly/votes" className={styles.viewAll}>All divisions <span aria-hidden="true">↗</span></Link>
        </div>
        <div className={`${styles.sectionHead} ${styles.sectionHeadBills}`}>
          <div>
            <span className={styles.sectionEyebrow}>Legislation</span>
            <h2 className={styles.sectionTitle}>Active legislation</h2>
          </div>
          <Link href="/assembly/bills" className={styles.viewAll}>All bills <span aria-hidden="true">↗</span></Link>
        </div>

        {/* Paired rows — div + bill share the same grid row so border lines align */}
        {Array.from({ length: Math.max(latestDivisions.length, inProgressBills.length) }, (_, i) => {
          const div = latestDivisions[i]
          const bill = inProgressBills[i]
          const isLast = i === Math.max(latestDivisions.length, inProgressBills.length) - 1

          const divEl = div ? (() => {
            const { title: rawTitle, subtitle } = formatDivisionSubject(div.title ?? div.subject)
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
            const typeLabel = isStatutory
              ? 'Regulations'
              : isBill && billAmendMatch
                ? `Bill · ${subtitle ? `${subtitle} · ` : ''}Amendment ${billAmendMatch[1]}`
                : isBill
                  ? (subtitle ?? 'Bill')
                  : motionAmendMatch
                    ? `Amendment ${motionAmendMatch[1]}`
                    : 'Motion'
            return (
              <Link key={`div-${div.documentId}`} href={`/assembly/divisions/${div.documentId}`}
                className={`${styles.divCard}${isLast ? ` ${styles.rowLast}` : ''}`}>
                <div className={styles.divTitle}>{displayTitle}</div>
                <span className={passed ? styles.pillPass : styles.pillFail}>{passed ? 'Passed' : 'Failed'}</span>
                <div className={styles.divMeta}>
                  <span className={styles.divSub}>
                    {d ? `${d.getDate()} ${d.toLocaleString('en',{month:'short'})} ${d.getFullYear()} · ${typeLabel}` : typeLabel}
                  </span>
                </div>
              </Link>
            )
          })() : <div key={`div-empty-${i}`} className={`${styles.divCard}${isLast ? ` ${styles.rowLast}` : ''}`} />

          const billEl = bill ? (() => {
            const slug = bill.billId.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-')
            return (
              <Link key={`bill-${bill.billId}`} href={`/assembly/bills/${slug}`}
                className={`${styles.billCard}${isLast ? ` ${styles.rowLast}` : ''}`}>
                <div>
                  <div className={styles.billTitle}>{bill.shortTitle}</div>
                  <div className={styles.billPills}>
                    <span className={styles.pillType}>
                      {[bill.latestDate ? formatDate(String(bill.latestDate)) : null, bill.billType].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                </div>
                <BillStagePill
                  category={bill.latestDate && new Date(bill.latestDate) > now ? 'scheduled' : 'in-progress'}
                  currentStage={bill.currentStage}
                  passed={null}
                />
              </Link>
            )
          })() : <div key={`bill-empty-${i}`} className={`${styles.billCard}${isLast ? ` ${styles.rowLast}` : ''}`} />

          return [divEl, billEl]
        })}
      </div>

      <hr className={`section-rule ${styles.mobileRule}`} />

      {/* Expenses promo */}
      <section className={styles.section}>
        <div className={`${styles.sectionHead} ${styles.sectionHeadWithSubtitle}`}>
          <div>
            <span className={styles.sectionEyebrow}>Public spending</span>
            <h2 className={styles.sectionTitle}>Expenses league table</h2>
            <p className={styles.sectionSubtitle}>Expense claims for each MLA across all published financial years.</p>
          </div>
        </div>
        <Link href="/assembly/expenses" className={styles.expensesCard}>
          <span className={styles.expensesCardLeft}>
            <svg className={styles.expensesCardIcon} aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15"/>
              <rect x="9" y="9" width="2" height="6" rx="1" fill="currentColor"/>
              <rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/>
            </svg>
            <span className={styles.expensesCardText}>View full MLA expenses rankings</span>
          </span>
          <span className={styles.expensesCardArrow} aria-hidden="true">↗</span>
        </Link>
      </section>

      <hr className={`section-rule ${styles.mobileRule}`} />

      {/* Did you know */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Did you know</span>
            <h2 className={styles.sectionTitle}>By the numbers</h2>
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
