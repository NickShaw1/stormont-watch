import Link from 'next/link'
import { getAllBills, getBillsProgressedThisWeek } from '@/lib/db/queries'
import { groupProgressedBills } from '@/lib/bills/progressedThisWeekProgress'
import BillsListClient from './BillsListClient'
import styles from './bills.module.css'
import type { Mandate } from '@/lib/constants/mandates'

export interface BillItem {
  slug: string
  billId: string
  title: string
  billType: string | null
  isAccelerated: boolean
  latestDate: string
  currentStage: string
  stageHistory: { stage: string; plenaryDate: string }[]
  passed: boolean | null
  royalAssentDate: string | null
  actTitle: string | null
  category: 'scheduled' | 'in-progress' | 'completed'
}

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

function hasFinalStagePassed(b: { final_stage_has_division: boolean | null; final_stage_outcome: string | null }): boolean {
  return b.final_stage_has_division === true && /carried/i.test(b.final_stage_outcome ?? '')
}

function hasFinalStageFailed(b: { final_stage_has_division: boolean | null; final_stage_outcome: string | null }): boolean {
  return b.final_stage_has_division === true && /negatived|fell/i.test(b.final_stage_outcome ?? '')
}

/**
 * Shared body for the bills list — rendered by both the live route (current mandate,
 * basePath '') and the archive route (`/archive/<id>`). `mandate` drives the queries
 * and copy; `basePath` prefixes internal links.
 */
export default async function BillsPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [allBills, progressedData] = await Promise.all([getAllBills(mandate.id), getBillsProgressedThisWeek(mandate.id)])
  const progressedThisWeek = groupProgressedBills(progressedData)
  const today = new Date().toISOString().slice(0, 10)
const isCompleted = (b: typeof allBills[number]) =>
    b.royal_assent_date != null ||
    (b.display_stage.toLowerCase() === 'final stage' && new Date(b.latest_date).toISOString().slice(0, 10) < today) ||
    hasFinalStagePassed(b) ||
    hasFinalStageFailed(b)

  function toItem(b: typeof allBills[number], category: BillItem['category']): BillItem {
    const passed = b.royal_assent_date != null ? true
      : hasFinalStagePassed(b) ? true
      : hasFinalStageFailed(b) ? false
      : b.final_stage_nodiv_date && new Date(b.final_stage_nodiv_date) < new Date() ? true
      : null
    return {
      slug: billSlug(b.bill_id),
      billId: b.bill_id,
      title: b.short_title,
      billType: b.bill_type,
      isAccelerated: b.is_accelerated,
      latestDate: b.latest_date,
      currentStage: b.display_stage,
      stageHistory: b.stage_history,
      passed,
      royalAssentDate: b.royal_assent_date,
      actTitle: b.act_title,
      category,
    }
  }

  const scheduled = allBills
    .filter(b => !isCompleted(b) && new Date(b.latest_date).toISOString().slice(0, 10) >= today)
    .map(b => toItem(b, 'scheduled'))
    .sort((a, b) => new Date(a.latestDate).getTime() - new Date(b.latestDate).getTime())

  const inProgress = allBills
    .filter(b => !isCompleted(b) && new Date(b.latest_date).toISOString().slice(0, 10) < today)
    .map(b => toItem(b, 'in-progress'))
    .sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime())

  const completed = allBills
    .filter(b => isCompleted(b))
    .map(b => toItem(b, 'completed'))
    .sort((a, b) => {
      if (!a.royalAssentDate && b.royalAssentDate) return -1
      if (a.royalAssentDate && !b.royalAssentDate) return 1
      const aDate = a.royalAssentDate ?? a.latestDate
      const bDate = b.royalAssentDate ?? b.latestDate
      return new Date(bDate).getTime() - new Date(aDate).getTime()
    })

  const total = scheduled.length + inProgress.length + completed.length

  return (
    <div className="container">
      <header className={`page-header ${styles.pageHeader}`}>
        <span className="eyebrow">Legislation</span>
        <h1>Bills &amp; Legislation</h1>
        <p className={styles.lede}>Tracking every Executive, Private Member and Committee bill introduced since {mandate.startLabel}, from First Reading through to Royal Assent.</p>
        <div className={styles.metaBar}>
          <div className={styles.metaBarItem}>
            <span className={styles.metaBarKey}>Total bills</span>
            <span className={styles.metaBarVal}>{total}</span>
          </div>
          <div className={styles.metaBarItem}>
            <span className={styles.metaBarKey}>Scheduled</span>
            <span className={styles.metaBarVal}>{scheduled.length}</span>
          </div>
          <div className={styles.metaBarItem}>
            <span className={styles.metaBarKey}>In progress</span>
            <span className={styles.metaBarVal}>{inProgress.length}</span>
          </div>
          <div className={styles.metaBarItem}>
            <span className={styles.metaBarKey}>Completed</span>
            <span className={styles.metaBarVal}>{completed.length}</span>
          </div>
        </div>
      </header>

      <BillsListClient
        scheduled={scheduled}
        inProgress={inProgress}
        completed={completed}
        progressedThisWeek={progressedThisWeek}
      />

      <hr className="section-rule" />

      {mandate.hadEarlySuspension && (
        <p className={styles.notice}>The Assembly did not sit between May 2022 and February 2024. No legislation progressed during this period.</p>
      )}
      <p className={styles.notice} style={{ marginTop: 'var(--s-3)', marginBottom: 'var(--s-10)' }}>
        Stage information is sourced from the NI Assembly Open Data API. Some stages may not be reflected immediately.{' '}
        <Link href={`${basePath}/assembly/legislation-guide`}>Not sure what a stage means?</Link>
      </p>
    </div>
  )
}
