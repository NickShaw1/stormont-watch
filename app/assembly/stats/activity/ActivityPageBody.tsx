import Link from 'next/link'
import { Activity, MessageCircleQuestion, BarChart3 } from 'lucide-react'
import {
  getMlaLeaderboard,
  getAllMembers,
  getAllMinisters,
  getQuestionTotalsAllMembers,
  getDivisionsPerMonth,
  getPassRateByYear,
  getSittingDays,
  getHansardTopByMLA,
  getHansardBottomByMLA,
  getHansardPartyAverages,
  getHansardThisMonth,
  getHansardSiteStats,
  getAllPartyAttendanceTrends,
} from '@/lib/db/queries'
import StatsQuestionsSection from '../StatsQuestionsSection'
import StatsChamberSection from '../StatsChamberSection'
import AssemblyProductivityClient from '../AssemblyProductivityClient'
import StatsBreadcrumb from '../StatsBreadcrumb'
import styles from '../stats.module.css'
import type { Mandate } from '@/lib/constants/mandates'

/**
 * Shared body for the activity stats page — rendered by both the live route (current
 * mandate, basePath '') and the archive route (`/archive/<id>`). `mandate` drives the
 * queries and copy; `basePath` prefixes internal links.
 */
export default async function ActivityPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [leaderboard, allCurrentMembers, ministerRows, questionTotalsRaw, divisionsPerMonth, passRateByYear, sittingDays, hansardTopBySittings, hansardBottomBySittings, hansardTopByTopics, hansardBottomByTopics, hansardPartyAverages, hansardThisMonth, hansardSiteStats, partyAttendanceTrends] = await Promise.all([
    getMlaLeaderboard(mandate.id),
    getAllMembers(mandate.id),
    getAllMinisters(mandate.id),
    getQuestionTotalsAllMembers(mandate.id),
    getDivisionsPerMonth(mandate.id),
    getPassRateByYear(mandate.id),
    getSittingDays(mandate.id),
    getHansardTopByMLA(5, 'sittings', mandate.id),
    getHansardBottomByMLA(5, 'sittings', mandate.id),
    getHansardTopByMLA(5, 'debates', mandate.id),
    getHansardBottomByMLA(5, 'debates', mandate.id),
    getHansardPartyAverages(mandate.id),
    getHansardThisMonth(mandate.id),
    getHansardSiteStats(mandate.id),
    getAllPartyAttendanceTrends(mandate.id),
  ])

  // Question rankings
  const eligibleIds = new Set(leaderboard.map(r => r.personId))
  ministerRows.forEach(m => eligibleIds.delete(m.personId))
  const memberMap = new Map(allCurrentMembers.map(m => [m.personId, m]))
  const questionRanking = questionTotalsRaw
    .map(r => ({
      personId: r.personId,
      total: Number(r.total),
      written: Number(r.written),
      oral: Number(r.oral),
      member: memberMap.get(r.personId),
    }))
    .filter(r => r.member && eligibleIds.has(r.personId))
    .sort((a, b) => b.total - a.total)

  const questionTop5 = questionRanking.slice(0, 5).map(r => ({
    personId: r.personId,
    fullName: r.member!.fullName,
    party: r.member!.party,
    imgUrl: r.member!.imgUrl,
    total: r.total,
  }))
  const questionBottom5 = [...questionRanking].reverse().slice(0, 5).map(r => ({
    personId: r.personId,
    fullName: r.member!.fullName,
    party: r.member!.party,
    imgUrl: r.member!.imgUrl,
    total: r.total,
  }))

  const partyTotals: Record<string, number> = {}
  const partyMemberCounts: Record<string, number> = {}
  for (const m of allCurrentMembers) {
    if (m.party) partyMemberCounts[m.party] = (partyMemberCounts[m.party] ?? 0) + 1
  }
  for (const r of questionTotalsRaw) {
    const m = memberMap.get(r.personId)
    if (!m?.party) continue
    partyTotals[m.party] = (partyTotals[m.party] ?? 0) + Number(r.total)
  }
  const questionByParty = Object.entries(partyTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([party, total]) => ({ party, total, memberCount: partyMemberCounts[party] ?? 1 }))

  return (
    <div className="container">
      <header className={styles.pageHeader}>
        <StatsBreadcrumb label="Parliamentary Activity" basePath={basePath} />
        <h1 className={styles.pageHeaderTitle}>
          <Activity className={styles.pageHeaderIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
          Parliamentary Activity
        </h1>
        <p className={styles.lede}>Questions to ministers and chamber participation across the {mandate.label} mandate.</p>
      </header>

      {/* Questions */}
      {questionTop5.length > 0 && (
        <section aria-labelledby="questions-heading" className={styles.section} style={{ marginTop: 0 }}>
          <div className={styles.sectionHeadRow} style={{ marginBottom: 0 }}>
            <div>
              <span className={styles.sectionEyebrow}>MLA questions</span>
              <h2 id="questions-heading" className={styles.sectionTitle}>
                <MessageCircleQuestion className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                Questions
              </h2>
            </div>
            <Link href={`${basePath}/assembly/questions`} className={styles.viewAllBtn}>View full rankings</Link>
          </div>
          <div className={styles.sectionHead}>
            <p className={styles.sectionDesc} style={{ marginBottom: 0 }}>Who asks the most questions. Excludes current ministers and speakers.</p>
          </div>
          <StatsQuestionsSection top5={questionTop5} bottom5={questionBottom5} byParty={questionByParty} basePath={basePath} />
        </section>
      )}

      {/* Chamber activity */}
      <StatsChamberSection
        topBySittings={hansardTopBySittings}
        bottomBySittings={hansardBottomBySittings}
        topByTopics={hansardTopByTopics}
        bottomByTopics={hansardBottomByTopics}
        partyAverages={hansardPartyAverages}
        thisMonth={hansardThisMonth}
        siteStats={hansardSiteStats}
      />

      {/* Assembly activity */}
      <section aria-labelledby="productivity-heading" className={`${styles.section} ${styles.sectionLast}`}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionEyebrow}>Sitting and voting patterns</span>
          <h2 id="productivity-heading" className={styles.sectionTitle}>
            <BarChart3 className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Assembly activity
          </h2>
          <p className={styles.sectionDesc}>How active the Assembly has been since {mandate.startLabel}.</p>
        </div>
        <AssemblyProductivityClient monthData={divisionsPerMonth} yearData={passRateByYear} sittingDays={sittingDays} partyAttendanceTrends={partyAttendanceTrends} />
      </section>
    </div>
  )
}
