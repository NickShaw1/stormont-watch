import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllBills, getThisWeekLegislation } from '@/lib/db/queries'
import BillsListClient from './BillsListClient'
import styles from './bills.module.css'

export const revalidate = 86400

export async function generateMetadata(): Promise<Metadata> {
  const bills = await getAllBills()
  const count = bills.length
  const description = `Browse all ${count} bills and acts in the Northern Ireland Assembly since May 2022. Track progress through legislative stages.`
  return {
    title: 'Legislation',
    description,
    openGraph: {
      title: 'Legislation — Stormont Watch',
      description,
    },
    alternates: { canonical: 'https://www.stormontwatch.com/assembly/bills' },
  }
}


export interface BillItem {
  slug: string
  title: string
  billType: string | null
  isAccelerated: boolean
  latestDate: string
  currentStage: string
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
  return b.final_stage_has_division === true && !/carried/i.test(b.final_stage_outcome ?? '')
}

export default async function BillsPage() {
  const [allBills, thisWeekBills] = await Promise.all([getAllBills(), getThisWeekLegislation()])
  const now = new Date()

  // Rule 1: has royal assent → completed
  // Rule 2: current_stage is Final Stage and latest_date is in the past → completed
  // Also catch bills where a Final Stage division result was recorded (passed or failed)
  // regardless of what current_stage is set to, as it may have been updated after the vote
  const isCompleted = (b: typeof allBills[number]) =>
    b.royal_assent_date != null ||
    (b.current_stage.toLowerCase() === 'final stage' && new Date(b.latest_date) <= now) ||
    hasFinalStagePassed(b) ||
    hasFinalStageFailed(b)

  function toItem(b: typeof allBills[number], category: BillItem['category']): BillItem {
    const passed = b.royal_assent_date != null ? true
      : hasFinalStagePassed(b) ? true
      : hasFinalStageFailed(b) ? false
      : null
    return {
      slug: billSlug(b.bill_id),
      title: b.short_title,
      billType: b.bill_type,
      isAccelerated: b.is_accelerated,
      latestDate: b.latest_date,
      currentStage: b.display_stage,
      passed,
      royalAssentDate: b.royal_assent_date,
      actTitle: b.act_title,
      category,
    }
  }

  // Rule 3: latest_date in the future (and not already completed) → scheduled
  const scheduled = allBills
    .filter(b => !isCompleted(b) && new Date(b.latest_date) > now)
    .map(b => toItem(b, 'scheduled'))
    .sort((a, b) => new Date(a.latestDate).getTime() - new Date(b.latestDate).getTime())

  const inProgress = allBills
    .filter(b => !isCompleted(b) && new Date(b.latest_date) <= now)
    .map(b => toItem(b, 'in-progress'))
    .sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime())

  const completed = allBills
    .filter(b => isCompleted(b))
    .map(b => toItem(b, 'completed'))
    .sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime())

  return (
    <div>
      <div className="container">
        <header className={`page-header ${styles.pageHeader}`}>
          <h1>Legislation</h1>
          <div className="page-header-rule"></div>
          <p className={styles.subtitle}>Bills and Acts from the Assembly since May 2022.</p>
          <div className={styles.suspensionCard}>
            <svg className={styles.suspensionIcon} aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="#203F59"/>
              <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
              <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
            </svg>
            <p className={styles.suspensionNote}>The Assembly did not sit between May 2022 and February 2024. No legislation progressed during this period.</p>
          </div>
          <div className="note-card" style={{ marginTop: '0.75rem', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <svg className="note-card-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, marginTop: '0.0625rem' }}>
                <circle cx="10" cy="10" r="10" fill="#9ca3af"/>
                <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
                <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
              </svg>
              <div>
                <p>Stage information is sourced from the NI Assembly Open Data API. Some stages may not be reflected immediately.</p>
                <p style={{ marginTop: '0.25rem' }}><Link href="/assembly/legislation-guide" className={styles.stageQuestion}>Not sure what a stage means?</Link></p>
              </div>
            </div>
          </div>
        </header>
        <hr className="section-rule" style={{ margin: '0 0 40px' }} />
      </div>
      <BillsListClient scheduled={scheduled} inProgress={inProgress} completed={completed} thisWeekBills={thisWeekBills} />
    </div>
  )
}
