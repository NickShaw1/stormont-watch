import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  getHomepageStats,
  getAverageAttendance,
  getLeastEngagedMLA,
  getLatestDivisions,
  getInProgressBills,
} from '@/lib/db/queries'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import { stripHonorifics } from '@/lib/utils/formatNames'
import { formatDate } from '@/lib/format'
import RotatingFact from '@/components/RotatingFact'
import ConstituencySelector from '@/app/components/ConstituencySelector'
import BillStagePill from '@/app/components/BillStagePill'
import styles from './home.module.css'

export const metadata: Metadata = {
  title: 'Stormont Watch',
  description: 'Every vote in the Northern Ireland Assembly since February 2024.',
  openGraph: {
    title: 'Stormont Watch',
    description: 'Every vote in the Northern Ireland Assembly since February 2024.',
    url: 'https://www.stormontwatch.com',
  },
  alternates: { canonical: 'https://www.stormontwatch.com' },
}

export const revalidate = 86400

export default async function HomePage() {
  const now = new Date()
  const [stats, avgAttendance, leastEngaged, latestDivisions, inProgressBills] =
    await Promise.all([
      getHomepageStats(),
      getAverageAttendance(),
      getLeastEngagedMLA(),
      getLatestDivisions(5),
      getInProgressBills(5),
    ])

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Stormont Watch',
    url: 'https://www.stormontwatch.com',
    description: 'Every vote in the Northern Ireland Assembly since February 2024.',
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
          <div className={styles.heroOverlay}>
            <div className={styles.heroContent}>
              <h1 className={styles.heroTitle}>The Assembly has voted {stats.totalDivisions} times since returning.</h1>
              <p className={styles.heroSubtitle}>This is the full record.</p>
            </div>
          </div>
          <p className={styles.heroCredit}>
            <a href="https://www.flickr.com/photos/robertpaulyoung/64563230/" target="_blank" rel="noopener noreferrer">Robert Paul Young</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
          </p>
        </div>
      </section>

      <hr className={styles.rule} />

      {/* Stat cards */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statLabel} ${styles.statEyebrow}`}>Total divisions</div>
          <div className={styles.statValue}>{stats.totalDivisions}</div>
          <div className={styles.statNote}>Since Feb 2024</div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statLabel} ${styles.statEyebrow}`}>Acts passed</div>
          <div className={`${styles.statValue} ${styles.green}`}>{stats.actsCount}</div>
          <div className={styles.statNote}>Bills since Feb 2024</div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statLabel} ${styles.statEyebrow}`}>Voting Rate</div>
          <div className={`${styles.statValue} ${styles.amber}`}>{avgAttendance}%</div>
          <div className={styles.statNote}>Across all current MLAs</div>
        </div>
        {leastEngaged && (
          <div className={styles.statCard}>
            <div className={`${styles.statLabel} ${styles.statEyebrow}`}>
              <span className={styles.hideOnMobile}>Least engaged MLA</span>
              <span className={styles.showOnMobile}>Lowest Vote %</span>
            </div>
            <div className={`${styles.statValue} ${styles.red}`}>{leastEngaged.attendancePct}%</div>
            <div className={styles.statNote}><Link href={`/assembly/mlas/${leastEngaged.personId}`} className={styles.statNoteLink}>{stripHonorifics(leastEngaged.fullName)}</Link><span className={styles.hideOnMobile}> · {leastEngaged.party}</span></div>
          </div>
        )}
      </section>

      <hr className={styles.rule} />

      {/* Find your MLAs placeholder */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Your representatives</p>
          <h2 className={styles.sectionTitle}>Find your MLAs</h2>
          <div className={styles.sectionRule} />
        </div>
        <ConstituencySelector />
      </section>

      <hr className={styles.rule} />

      {/* This week */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Assembly activity</p>
          <h2 className={styles.sectionTitle}>This week in Stormont</h2>
          <div className={styles.sectionRule} />
        </div>
        <div className={styles.thisWeek}>
          <div className={styles.thisWeekGrid}>
            <div className={styles.twStat}>
              <div className={styles.twLabel}>Votes</div>
              <div className={styles.twValue}>{stats.thisWeekDivisions}</div>
            </div>
            <div className={styles.twStat}>
              <div className={styles.twLabel}>Bills progressed</div>
              <div className={styles.twValue}>{stats.thisWeekBills}</div>
            </div>
            <div className={styles.twStat}>
              <div className={styles.twLabel}>Pass rate</div>
              <div className={styles.twValue}>
                {stats.thisWeekPassRate !== null ? `${stats.thisWeekPassRate}%` : '—'}
              </div>
            </div>
            <div className={styles.twStat}>
              <div className={styles.twLabel}>Last sat</div>
              <div className={styles.twValueSm}>
                {stats.lastSat ? formatDate(stats.lastSat) : '—'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className={styles.rule} />

      {/* Expenses League Table */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Public spending</p>
          <h2 className={styles.sectionTitle}>Expenses League Table</h2>
          <div className={styles.sectionRule} />
        </div>
        <Link href="/assembly/expenses" className={styles.expensesCard}>
          <span className={styles.expensesCardText}>View full MLA expenses rankings</span>
          <span className={styles.expensesCardArrow} aria-hidden="true">↗</span>
        </Link>
      </section>

      <hr className={styles.rule} />

      {/* Latest votes + Bills in progress */}
      <div className={styles.twoCol}>
        <section>
          <div className={`${styles.sectionHeaderRow} ${styles.sectionHeaderRowLatestVotes}`}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionEyebrow}>Voting record</p>
              <h2 className={styles.sectionTitle}>Latest votes</h2>
              <div className={styles.sectionRule} />
            </div>
          </div>
          <div className={styles.cardList}>
            {latestDivisions.map((div) => {
              const { title: displayTitle, subtitle } = formatDivisionSubject(div.title ?? div.subject)
              const passed = div.outcome?.toLowerCase().includes('carried') || div.outcome?.toLowerCase().includes('passed')
              return (
                <Link key={div.documentId} href={`/assembly/divisions/${div.documentId}`} className={styles.divCard}>
                  <div className={styles.divTop}>
                    <span className={styles.divTitle}>{displayTitle}</span>
                    <span className={styles.divDate}>{formatDate(div.divisionDate?.toISOString())}</span>
                  </div>
                  {subtitle && (
                    <div className={styles.divSub}>{subtitle}</div>
                  )}
                  <div className={styles.divBottom}>
                    <span className={passed ? styles.pillPass : styles.pillFail}>
                      {passed ? 'Passed' : 'Failed'}
                    </span>
                    <span className={styles.divBottomDate}>{formatDate(div.divisionDate?.toISOString())}</span>
                  </div>
                </Link>
              )
            })}
          </div>
          <div className={styles.viewAllRow}>
            <Link href="/assembly/votes" className={styles.viewAllBottom}>View all <span aria-hidden="true">↗</span></Link>
          </div>
        </section>

        <hr className={`${styles.rule} ${styles.twoColRule}`} />
        <section>
          <div className={`${styles.sectionHeaderRow} ${styles.sectionHeaderRowLatestVotes}`}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionEyebrow}>Legislation</p>
              <h2 className={styles.sectionTitle}>Bills in the Assembly</h2>
              <div className={styles.sectionRule} />
            </div>
          </div>
          <div className={styles.cardList}>
            {inProgressBills.map((bill) => {
              const slug = bill.billId.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-')
              return (
                <Link key={bill.billId} href={`/assembly/bills/${slug}`} className={styles.billCard}>
                  <div className={styles.billTop}>
                    <span className={styles.billTitle}>{bill.shortTitle}</span>
                    <span className={styles.billDate}>{bill.latestDate ? formatDate(String(bill.latestDate)) : ''}</span>
                  </div>
                  <div className={styles.billPills}>
                    {bill.billType && <span className={styles.pillType}>{bill.billType}</span>}
                    <BillStagePill
                      category={bill.latestDate && new Date(bill.latestDate) > now ? 'scheduled' : 'in-progress'}
                      currentStage={bill.currentStage}
                      passed={null}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
          <div className={styles.viewAllRow}>
            <Link href="/assembly/bills" className={styles.viewAllBottom}>View all <span aria-hidden="true">↗</span></Link>
          </div>
        </section>
      </div>

      <hr className={styles.rule} />

      {/* Striking stat */}
      <section className={styles.section} style={{ marginBottom: '3rem' }}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Did you know</p>
          <h2 className={styles.sectionTitle}>By the numbers</h2>
          <div className={styles.sectionRule} />
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
