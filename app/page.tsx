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
  getCrossCommunityTrends,
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
        url: 'https://www.stormontwatch.com/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Stormont Watch — NI Assembly Transparency',
      },
    ],
  },
  alternates: { canonical: 'https://www.stormontwatch.com' },
}

export const revalidate = 86400

export default async function HomePage() {
  const now = new Date()
  const [stats, avgAttendance, leastEngaged, mostEngaged, latestDivisions, inProgressBills,
    inProgressBillsCount, divisionsPerMonth, crossCommunityTrends] =
    await Promise.all([
      getHomepageStats(),
      getAverageAttendance(),
      getLeastEngagedMLA(),
      getMostEngagedMLA(),
      getLatestDivisions(5),
      getInProgressBills(5),
      getInProgressBillsCount(),
      getDivisionsPerMonth(),
      getCrossCommunityTrends(),
    ])

  // Last 12 months of sparkline data
  const divisionsSparkline = divisionsPerMonth.slice(-12).map((r) => Number(r.total_divisions))
  const crossCommunitySparkline = crossCommunityTrends.slice(-12).map((r) => Number(r.agreed_divisions))

  // Current month stats
  const divisionsThisMonth = divisionsPerMonth.at(-1)?.total_divisions ?? 0
  const crossCommunityThisMonth = crossCommunityTrends.at(-1)?.agreed_divisions ?? 0

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
          <div className={styles.kfigSub}>vs. last month</div>
          <div className={styles.kfigSpark}>
            <Sparkline data={divisionsSparkline} color="var(--teal)" />
          </div>
        </div>
        <div className={styles.kfig}>
          <div className={styles.kfigLabel}>Cross-community votes</div>
          <div className={`${styles.kfigNum} ${styles.amber}`}>{Number(crossCommunityThisMonth)}</div>
          <div className={styles.kfigSub}>of {Number(divisionsThisMonth)} this month</div>
          <div className={styles.kfigSpark}>
            <Sparkline data={crossCommunitySparkline} color="var(--ochre)" />
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
            <div className={styles.kfigLabel}>Low Voter</div>
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
            <h2 className={styles.sectionTitle}>This week at <em>Stormont</em></h2>
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
      </section>

      {/* Expenses promo */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Public spending</span>
            <h2 className={styles.sectionTitle}><em>Expenses</em> League Table</h2>
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

      {/* Latest votes + Bills in progress */}
      <div className={styles.twoCol}>
        {/* Headers — each occupies one column in the shared grid */}
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Plenary floor</span>
            <h2 className={styles.sectionTitle}>Recent divisions</h2>
          </div>
          <Link href="/assembly/votes" className={styles.viewAll}>All divisions →</Link>
        </div>
        <div className={`${styles.sectionHead} ${styles.sectionHeadBills}`}>
          <div>
            <span className={styles.sectionEyebrow}>Legislation</span>
            <h2 className={styles.sectionTitle}>Bills in progress</h2>
          </div>
          <Link href="/assembly/bills" className={styles.viewAll}>All bills →</Link>
        </div>

        {/* Paired rows — div + bill share the same grid row so border lines align */}
        {Array.from({ length: Math.max(latestDivisions.length, inProgressBills.length) }, (_, i) => {
          const div = latestDivisions[i]
          const bill = inProgressBills[i]
          const isLast = i === Math.max(latestDivisions.length, inProgressBills.length) - 1

          const divEl = div ? (() => {
            const { title: rawTitle, subtitle } = formatDivisionSubject(div.title ?? div.subject)
            const displayTitle = rawTitle.trim()
            const passed = /carried/i.test(div.outcome ?? '') || /passed/i.test(div.outcome ?? '')
            const d = div.divisionDate ? new Date(div.divisionDate) : null
            return (
              <Link key={`div-${div.documentId}`} href={`/assembly/divisions/${div.documentId}`}
                className={`${styles.divCard}${isLast ? ` ${styles.rowLast}` : ''}`}>
                <div className={styles.divTitle}>{displayTitle}</div>
                <span className={styles.divDate}>{d ? `${d.getDate()} ${d.toLocaleString('en',{month:'short'})} ${d.getFullYear()}` : ''}</span>
                <span className={passed ? styles.pillPass : styles.pillFail}>{passed ? 'Passed' : 'Failed'}</span>
                <div className={styles.divMeta}>
                  {subtitle && <span className={styles.divSub}>{subtitle}</span>}
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
                    {bill.billType && <span className={styles.pillType}>{bill.billType}</span>}
                  </div>
                </div>
                <span className={styles.billDate}>{bill.latestDate ? formatDate(String(bill.latestDate)) : ''}</span>
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
