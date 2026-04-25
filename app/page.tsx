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
  getInProgressBillsCount,
  getDivisionsPerMonth,
  getBillsPassedPerMonth,
  getThisWeekPlenaryItems,
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
  const [stats, avgAttendance, leastEngaged, mostEngaged, latestDivisions, inProgressBills,
    inProgressBillsCount, divisionsPerMonth, billsPassedPerMonth, thisWeekAgenda] =
    await Promise.all([
      getHomepageStats(),
      getAverageAttendance(),
      getLeastEngagedMLA(),
      getMostEngagedMLA(),
      getLatestDivisions(5),
      getInProgressBills(5),
      getInProgressBillsCount(),
      getDivisionsPerMonth(),
      getBillsPassedPerMonth(),
      getThisWeekPlenaryItems(),
    ])

  const divisionsSparkline = divisionsPerMonth.slice(-12).map((r) => Number(r.total_divisions))
  const billsPassedSparkline = billsPassedPerMonth.slice(-12).map((r) => Number(r.bills_passed))

  const divisionsThisMonth = divisionsPerMonth.at(-1)?.total_divisions ?? 0
  const divisionsLastMonth = divisionsPerMonth.at(-2)?.total_divisions ?? 0
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
            <Link href="/assembly/votes" className={styles.heroBrowseBtn}>Browse all votes →</Link>
          </div>
        </div>
        <p className={styles.heroCredit}>
          <a href="https://www.flickr.com/photos/robertpaulyoung/64563230/" target="_blank" rel="noopener noreferrer">Robert Paul Young</a> · CC BY 4.0
        </p>
      </section>

      {/* Key figures strip */}
      <div className={styles.kfigs}>
        <div className={styles.kfig}>
          <div className={styles.kfigLabel}>Divisions this month</div>
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
              {mostEngaged.imgUrl && <Image src={mostEngaged.imgUrl} alt="" fill sizes="96px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />}
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
              {leastEngaged.imgUrl && <Image src={leastEngaged.imgUrl} alt="" fill sizes="96px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />}
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

      {/* Expenses promo */}
      <section className={styles.section}>
        <div className={`${styles.sectionHead}`}>
          <div>
            <span className={styles.sectionEyebrow}>Public spending</span>
            <h2 className={styles.sectionTitle}>Expenses League Table</h2>
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

      {/* Find your MLAs */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Your representatives</span>
            <h2 className={styles.sectionTitle}>Find your MLAs</h2>
          </div>
        </div>
        <ConstituencySelector />
      </section>

      {/* This week strip */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Assembly activity</span>
            <h2 className={styles.sectionTitle}>This week at Stormont</h2>
          </div>
        </div>
        <div className={styles.twStrip}>
          <div className={styles.twCell}>
            <div className={styles.twLabel}>Votes</div>
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
          const monday = new Date()
          const day = monday.getDay()
          monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day))
          const mondayLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(monday)
          const BILL_ID_RE = /\s*\(NIA Bill \d+\/\d{2}-\d{2,4}\)$/

          if (thisWeekAgenda.length === 0) {
            return (
              <>
                <div className={styles.agendaHeader}>
                  <span>On the <em>floor</em></span>
                  <span><span className={styles.agendaWc}>Week commencing </span><span className={styles.agendaWcShort}>w/c </span>{mondayLabel}</span>
                </div>
                <p className={styles.agendaEmpty}>No plenary business scheduled this week.</p>
              </>
            )
          }

          const byDate = thisWeekAgenda.reduce<Record<string, typeof thisWeekAgenda>>((acc, item) => {
            const d = item.plenary_date.slice(0, 10)
            ;(acc[d] ??= []).push(item)
            return acc
          }, {})

          return (
            <>
              <div className={styles.agendaHeader}>
                <span>On the <em>floor</em></span>
                <span><span className={styles.agendaWc}>Week commencing </span><span className={styles.agendaWcShort}>w/c </span>{mondayLabel}</span>
              </div>
              {Object.entries(byDate).map(([date, items]) => {
                const label = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00Z`))
                return (
                  <div key={date} className={styles.agendaDay}>
                    <div className={styles.agendaDayLabel}>{label}</div>
                    {items.map(item => {
                      const colonIdx = item.title.indexOf(':')
                      const typeLabel = colonIdx > -1
                        ? item.title.slice(0, colonIdx).trim()
                        : item.plenary_type_id === '5' ? 'Debate' : 'Motion'
                      const rawTitle = colonIdx > -1 ? item.title.slice(colonIdx + 1).trim() : item.title
                      const billIdMatch = rawTitle.match(/\(NIA Bill (\d+\/\d{2}-\d{2,4})\)$/)
                      const billId = billIdMatch ? `NIA Bill ${billIdMatch[1]}` : null
                      const displayTitle = rawTitle.replace(BILL_ID_RE, '').trim()
                      const slug = billId ? billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-') : null
                      const isProcedural = typeLabel === 'Motion' || typeLabel === 'Debate'
                      return (
                        <div key={item.document_id} className={styles.agendaItem}>
                          {slug ? (
                            <Link href={`/assembly/bills/${slug}`} className={styles.agendaTitle}>{displayTitle}</Link>
                          ) : (
                            <span className={styles.agendaTitle}>{displayTitle}</span>
                          )}
                          <span className={isProcedural ? styles.agendaTypeProcedural : styles.agendaType}>{typeLabel}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </>
          )
        })()}
      </section>

      {/* Latest votes + Bills in progress */}
      <div className={styles.twoCol}>
        {/* Headers — each occupies one column in the shared grid */}
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Assembly floor</span>
            <h2 className={styles.sectionTitle}>Recent divisions</h2>
          </div>
          <Link href="/assembly/votes" className={styles.viewAll}>All divisions ↗</Link>
        </div>
        <div className={`${styles.sectionHead} ${styles.sectionHeadBills}`}>
          <div>
            <span className={styles.sectionEyebrow}>Legislation</span>
            <h2 className={styles.sectionTitle}>Active Legislation</h2>
          </div>
          <Link href="/assembly/bills" className={styles.viewAll}>All bills ↗</Link>
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
                ? `Bill · Amendment ${billAmendMatch[1]}`
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
                    {subtitle && isBill && billAmendMatch ? ` · ${subtitle}` : ''}
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
        />
      </section>

    </div>
  )
}
