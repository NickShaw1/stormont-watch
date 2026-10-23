import { Info } from 'lucide-react'
import { getAllBills, getBillsProgressedThisWeek } from '@/lib/db/queries'
import { groupProgressedBills } from '@/lib/bills/progressedThisWeekProgress'
import { computeBillStats } from '@/lib/bills/billStats'
import BillsExplorer from './BillsExplorer'
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

// Shared by the live route and the archive route; mandate/basePath vary per route.
export default async function BillsPageBody({
  mandate,
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
      title: b.royal_assent_date && b.act_title ? b.act_title : b.short_title,
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

  const stats = computeBillStats(scheduled, inProgress, completed)

  const comingUp = scheduled.slice(0, 5).map(b => ({
    slug: b.slug,
    billId: b.billId,
    billType: b.billType,
    title: b.title,
    stage: b.currentStage,
    date: b.latestDate,
  }))

  const lawShare = stats.total > 0 ? Math.round((stats.becameLaw / stats.total) * 100) : 0

  return (
    <div className={styles.page}>
      <BillsExplorer
        head={(
          <header className={styles.head}>
            <span className={styles.eyebrow}>The Assembly</span>
            <h1 className={styles.h1} id="bills-title">Bills &amp; Legislation</h1>
            <p className={styles.headSub}>Every Executive, Private Member and Committee bill introduced since {mandate.startLabel}, from First Stage through to Royal Assent.</p>
          </header>
        )}
        summary={(
          <div className={styles.overview}>
            <span className={styles.overviewFigure}>{stats.total}</span>
            <div className={styles.overviewText}>
              <span className={styles.overviewLabel}>bills introduced in the <span className={styles.nowrap}>{mandate.label}</span> mandate</span>
              <p className={styles.overviewSub}>
                {stats.becameLaw} became law ({lawShare}%), {stats.active} are before the Assembly ({stats.scheduled} scheduled for debate, {stats.inProgress} in progress)
                {stats.awaiting > 0 ? `, and ${stats.awaiting} passed Final Stage and ${stats.awaiting === 1 ? 'is' : 'are'} awaiting Royal Assent` : ''}
                {stats.failed > 0 ? `. ${stats.failed} ${stats.failed === 1 ? 'was' : 'were'} defeated at a vote` : ''}.
              </p>
            </div>
          </div>
        )}
        pipeline={stats.pipeline}
        outcomes={stats.outcomes}
        daysToLaw={stats.daysToLaw}
        total={stats.total}
        comingUp={comingUp}
        scheduled={scheduled}
        inProgress={inProgress}
        completed={completed}
        progressedThisWeek={progressedThisWeek}
        mandateStartLabel={mandate.startLabel}
      >
        <div className={styles.notes}>
          <div className={styles.note}>
            <span className={`${styles.iconTile} ${styles.tnBlue}`}><Info size={22} strokeWidth={2} aria-hidden="true" /></span>
            <p>Stage information is sourced from the NI Assembly Open Data API. Some stages may not be reflected immediately.</p>
          </div>
        </div>
      </BillsExplorer>
    </div>
  )
}
