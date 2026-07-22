import { getAllDivisionsForList } from '@/lib/db/queries'

import { isPassed } from '@/lib/bills'
import VotesListClient from './VotesListClient'
import type { VoteItem } from './VotesListClient'
import styles from './votes.module.css'
import type { Mandate } from '@/lib/constants/mandates'

/**
 * Shared body for the votes list — rendered by both the live route (current mandate,
 * basePath '') and the archive route (`/archive/<id>`). `mandate` drives the queries
 * and copy; `basePath` prefixes internal links.
 */
export default async function VotesPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const rows = await getAllDivisionsForList(mandate.id)

  const allItems: VoteItem[] = rows.map((d) => ({
    key: d.documentId,
    href: `${basePath}/assembly/divisions/${d.documentId}`,
    rawTitle: d.title ?? null,
    subject: d.subject ?? '',
    latestDate: d.divisionDate.toISOString(),
    passed: isPassed(d.outcome ?? null),
    outcome: d.outcome ?? null,
    motionText: d.motionText ?? null,
    isStatutory: /^The draft /i.test(d.title ?? '') || /^Prayer of Annulment:/i.test(d.title ?? '') || /^Applicability Motion/i.test(d.title ?? ''),
    isBill: !(/^The draft /i.test(d.title ?? '') || /^Prayer of Annulment:/i.test(d.title ?? '') || /^Applicability Motion/i.test(d.title ?? '')) && (/NIA Bill/i.test(d.subject ?? '') || /(?:First|Second|Committee|Consideration|Further Consideration|Final) Stage:/i.test(d.subject ?? '')),
    isCrossCommunity: d.divisionType === 'Cross-Community',
    totalAyes: d.totalAyes ?? null,
    totalNoes: d.totalNoes ?? null,
  }))

  return (
    <div className="container">
      <header className={`${styles.pageHeader} page-header`}>
        <span className="eyebrow">The vote record</span>
        <h1>Divisions</h1>
        <p className={styles.lede}>Every recorded division in the Assembly since {mandate.startLabel} including cross-community votes, opposition motions and bill stages.</p>
      </header>
      {mandate.hadEarlySuspension && (
        <p className={styles.notice}>The Assembly did not sit between May 2022 and February 2024. No divisions were recorded during this period aside from procedural Speaker nomination votes.</p>
      )}
      <VotesListClient allItems={allItems} />
    </div>
  )
}
