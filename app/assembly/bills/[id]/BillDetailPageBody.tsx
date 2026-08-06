import { notFound } from 'next/navigation'
import Link from 'next/link'
import { GitBranch, FileText, Gauge, History, HelpCircle, CheckCircle2, ExternalLink, Crown } from 'lucide-react'
import { getAllBills, getBillStages } from '@/lib/db/queries'
import { computeBillProgress, BILL_STAGES } from '@/lib/bills/billProgress'
import { getBillSummary } from '@/lib/summaries'
import type { Mandate } from '@/lib/constants/mandates'
import BillTimeline from './BillTimeline'
import styles from './billDetail.module.css'

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

async function getBillBySlug(id: string, mandate: string) {
  const allBills = await getAllBills(mandate)
  return allBills.find(b => billSlug(b.bill_id) === id) ?? null
}

const IMPACT_LABELS: { key: string; label: string }[] = [
  { key: 'fiscal', label: 'Fiscal' },
  { key: 'rights', label: 'Rights and Equality' },
  { key: 'publicServices', label: 'Public Services' },
  { key: 'crossCommunity', label: 'Cross-community' },
  { key: 'environment', label: 'Environment' },
]

const LEVEL_ORDER = ['none', 'low', 'medium', 'high'] as const
type ImpactLevel = typeof LEVEL_ORDER[number]

// BILL_STAGES minus "Introduction" — that's not a numbered stage. Matches BillsListClient.tsx.
const NUMBERED_STAGES = BILL_STAGES.slice(1).map(s => s.replace(/ Stage$/, ''))

function ImpactDots({ level }: { level: ImpactLevel }) {
  const active = LEVEL_ORDER.indexOf(level)
  return (
    <span className={styles.dotsWrap} aria-hidden="true">
      {LEVEL_ORDER.map((l, i) => (
        <span
          key={l}
          className={styles.dot}
          data-active={i <= active && level !== 'none'}
          data-level={i <= active ? level : 'none'}
        />
      ))}
    </span>
  )
}

// Shared by the live route and the archive route; mandate/basePath vary per route.
export default async function BillDetailPageBody({
  id,
  mandate,
  basePath,
}: {
  id: string
  mandate: Mandate
  basePath: string
}) {
  const bill = await getBillBySlug(id, mandate.id)
  if (!bill) notFound()

  const [stages, summary] = await Promise.all([
    getBillStages(bill.bill_id),
    getBillSummary(id),
  ])

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.stormontwatch.com'
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Legislation', item: `${siteUrl}${basePath}/assembly/bills` },
      { '@type': 'ListItem', position: 2, name: bill.short_title, item: `${siteUrl}${basePath}/assembly/bills/${id}` },
    ],
  }

  const billPassed =
    bill.royal_assent_date != null ||
    (bill.final_stage_has_division === true && /carried/i.test(bill.final_stage_outcome ?? '')) ||
    (bill.final_stage_nodiv_date != null && new Date(bill.final_stage_nodiv_date) <= new Date())

  const { stageIdx, scheduledIdx, currentStageLabel } = computeBillProgress(
    stages.map(s => ({ stage: s.stage, plenaryDate: s.plenary_date })),
    bill.royal_assent_date,
    billPassed,
  )

  const billFailed =
    !billPassed &&
    bill.final_stage_has_division === true &&
    /negatived|fell/i.test(bill.final_stage_outcome ?? '')

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Header */}
      <header className={styles.header}>
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li><Link href={`${basePath}/assembly/bills`}>Legislation</Link></li>
            <li aria-current="page"><span>{bill.short_title}</span></li>
          </ol>
        </nav>

        <div className={styles.titleCard}>
          <div className={styles.titleBlock}>
            <span className={styles.eyebrow}>Legislation</span>
            <h1 className={styles.title}>
              <FileText className={styles.titleIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
              {bill.short_title}
            </h1>
          </div>
          {bill.long_title && <p className={styles.lede}>{bill.long_title}</p>}
          <div className={styles.titleCardFoot}>
            <span className={`${styles.chip} ${styles.chipNeutral}`}>
              <FileText size={12} strokeWidth={2} aria-hidden="true" />
              Bill {bill.bill_id}
            </span>
            <div className={styles.badgeRow}>
              {bill.bill_type && <span className={`${styles.chip} ${styles.chipAccent}`}>{bill.bill_type}</span>}
              {bill.royal_assent_date != null && (
                <span className={`${styles.chip} ${styles.chipLaw}`}>
                  <CheckCircle2 size={12} strokeWidth={2} aria-hidden="true" />
                  Became law
                </span>
              )}
              {billPassed && !bill.royal_assent_date && (
                <span className={`${styles.chip} ${styles.chipAwaiting}`}>
                  <Crown size={12} strokeWidth={2} aria-hidden="true" />
                  Awaiting Royal Assent
                </span>
              )}
              {billFailed && <span className={`${styles.chip} ${styles.chipFail}`}>Failed</span>}
              {bill.legislation_url && (
                <a href={bill.legislation_url} target="_blank" rel="noopener noreferrer" className={`${styles.chip} ${styles.chipLink}`}>
                  View Act
                  <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Stage tracker — same legend/segment logic as the bills list page (Passed/Scheduled/Not yet reached). */}
      <section className={styles.stagesSection}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Stage tracker</span>
          <h2 className={styles.stagesSectionHead}>
            <Gauge className={styles.stagesSectionHeadIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Progress
          </h2>
        </div>

        <div className={styles.stagesCard}>
          <div
            className={styles.currentStageBanner}
            data-tone={
              bill.royal_assent_date != null ? 'pass'
              : billPassed ? 'awaiting'
              : scheduledIdx !== null ? 'scheduled'
              : 'active'
            }
          >
            <span className={styles.currentStageBannerLabel}>
              {bill.royal_assent_date != null ? 'Completed'
                : billPassed ? 'Passed Final Stage'
                : scheduledIdx !== null ? 'Next scheduled stage'
                : 'Current stage'}
            </span>
            <span className={styles.currentStageBannerValue}>
              {bill.royal_assent_date != null
                ? 'Royal Assent'
                : billPassed
                ? 'Awaiting Royal Assent'
                : scheduledIdx !== null
                ? BILL_STAGES[scheduledIdx]
                : currentStageLabel || BILL_STAGES[0]}
            </span>
          </div>

          <div className={styles.stagesLabels}>
            <span className={styles.stagesStageCount}>Stage {Math.max(stageIdx, 0)} of {BILL_STAGES.length - 1}</span>
            {bill.royal_assent_date != null && <span className={styles.stagesPassed}><CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />Passed</span>}
          </div>

          <div className={styles.stages}>
            {NUMBERED_STAGES.map((s, j) => {
              const i = j + 1 // offset for the dropped "Introduction" index
              const completedUpTo = scheduledIdx !== null ? scheduledIdx - 1 : stageIdx
              const state = i <= completedUpTo ? 'done' : i === scheduledIdx ? 'scheduled' : undefined
              return (
                <div key={s} className={styles.stage} data-state={state}>
                  <span className={styles.stageNum}>{j + 1}</span>
                  {s}
                </div>
              )
            })}
          </div>

          <div className={styles.stagesMobileBar}>
            {NUMBERED_STAGES.map((s, j) => {
              const i = j + 1
              const completedUpTo = scheduledIdx !== null ? scheduledIdx - 1 : stageIdx
              const state = i <= completedUpTo ? 'done' : i === scheduledIdx ? 'scheduled' : undefined
              return <div key={s} className={styles.stagesMobileSeg} data-state={state} />
            })}
          </div>
        </div>
      </section>

      {summary && (
        <>
          <section aria-labelledby="summary-heading" className={styles.summarySection}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>Summary</span>
              <h2 id="summary-heading" className={styles.sectionHeading}>
                <FileText className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                What this bill does
              </h2>
            </div>
            <div className={styles.summaryCard}>
              <p className={styles.summaryText}>{summary.summary}</p>
            </div>
          </section>

          <section aria-labelledby="impact-heading" className={styles.impactSection}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>Assessment</span>
              <h2 id="impact-heading" className={styles.sectionHeading}>
                <GitBranch className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                Impact areas
              </h2>
            </div>
            <div className={styles.impactCard}>
              <ul className={styles.impactList} role="list">
                {IMPACT_LABELS.map(({ key, label }) => {
                  type ImpactKey = 'fiscal' | 'rights' | 'publicServices' | 'crossCommunity' | 'environment'
                  const level: ImpactLevel = (summary.impact?.[key as ImpactKey] as ImpactLevel) ?? 'none'
                  const levelLabel = level.charAt(0).toUpperCase() + level.slice(1)
                  return (
                    <li key={key} className={styles.impactItem}>
                      <span className={styles.impactLabel}>{label}</span>
                      <ImpactDots level={level} />
                      <span className={styles.impactValue} data-level={level}>{levelLabel}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>
        </>
      )}

      <section aria-labelledby="stages-heading" className={`${styles.timelineSection} ${styles.sectionLast}`}>
        <div className={styles.sectionHeadRow}>
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Timeline</span>
            <h2 id="stages-heading" className={styles.sectionHeading}>
              <History className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              Legislative stages
            </h2>
          </div>
          <Link href={`${basePath}/assembly/legislation-guide`} className={styles.viewAllBtn}>
            <HelpCircle size={14} strokeWidth={2} aria-hidden="true" />
            How does a bill become law?
          </Link>
        </div>
        <p className={styles.timelineNote}>
          A stage can appear more than once below if the Assembly sat on it across several plenary days.
        </p>
        <div className={styles.timelineCard}>
          <BillTimeline stages={stages} royalAssentDate={bill.royal_assent_date} latestDate={bill.latest_date} />
        </div>
      </section>
    </div>
  )
}
