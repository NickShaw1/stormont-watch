import { Mic2 } from 'lucide-react'
import { getQuestionTotalsAllMembers, getAllMembers, getAllMinisters } from '@/lib/db/queries'
import QuestionsRankingClient from './QuestionsRankingClient'
import StatsBreadcrumb from '../stats/StatsBreadcrumb'
import styles from './questions.module.css'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'

/**
 * Shared body for the questions page — rendered by both the live route (current mandate,
 * basePath '') and the archive route (`/archive/<id>`). `mandate` drives the queries
 * and copy; `basePath` prefixes internal links.
 */
export default async function QuestionsPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [questionTotals, allCurrentMembers, ministerRows] = await Promise.all([
    getQuestionTotalsAllMembers(mandate.id),
    getAllMembers(mandate.id),
    getAllMinisters(mandate.id),
  ])

  const memberMap = new Map(allCurrentMembers.map(m => [m.personId, m]))
  const ministerIds = new Set(ministerRows.map(m => m.personId))

  const rows = questionTotals
    .map(r => {
      const m = memberMap.get(r.personId)
      if (!m) return null
      if (m.assemblyRole === 'Speaker' || ministerIds.has(r.personId)) return null
      return {
        personId: r.personId,
        fullName: m.fullName,
        party: m.party,
        constituency: m.constituency,
        imgUrl: m.imgUrl,
        total: Number(r.total),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.total - a.total)

  return (
    <div className="container">
      <header className={styles.pageHeader}>
        <StatsBreadcrumb label="MLA questions" basePath={basePath} />
        <span className={styles.pageHeaderEyebrow}>Rankings</span>
        <h1 className={styles.pageHeaderTitle}>
          <Mic2 className={styles.pageHeaderIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
          MLA questions
        </h1>
        <p className={styles.lede}>Questions tabled by every {sittingAdjective(mandate)} MLA since the {mandate.label} mandate began. Excludes current ministers and the Speaker. Data sourced from the NI Assembly.</p>
      </header>

      <QuestionsRankingClient rows={rows} totalMlaCount={rows.length} />
    </div>
  )
}
