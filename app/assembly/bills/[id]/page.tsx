import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllBills, getBillStages } from '@/lib/db/queries'
import { computeBillProgress, BILL_STAGES } from '@/lib/bills/billProgress'

import { getBillSummary } from '@/lib/summaries'
import BillTimeline from './BillTimeline'
import styles from './billDetail.module.css'

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

export async function generateStaticParams() {
  const allBills = await getAllBills()
  return allBills.map(b => ({ id: billSlug(b.bill_id) }))
}

interface Props {
  params: Promise<{ id: string }>
}

async function getBillBySlug(id: string) {
  const allBills = await getAllBills()
  return allBills.find(b => billSlug(b.bill_id) === id) ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const bill = await getBillBySlug(id)
  if (!bill) return { title: 'Bill not found' }
  const description = bill.long_title
    ? `${bill.long_title}`
    : `All Assembly stages for ${bill.short_title}.`
  return {
    title: bill.short_title,
    description,
    openGraph: {
      title: `${bill.short_title} — Stormont Watch`,
      description,
      images: [
        {
          url: `/assembly/bills/${id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${bill.short_title} — Stormont Watch`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      images: [`/assembly/bills/${id}/opengraph-image`],
    },
    alternates: { canonical: `https://www.stormontwatch.com/assembly/bills/${id}` },
  }
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


export default async function BillDetailPage({ params }: Props) {
  const { id } = await params
  const bill = await getBillBySlug(id)
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
      { '@type': 'ListItem', position: 1, name: 'Legislation', item: `${siteUrl}/assembly/bills` },
      { '@type': 'ListItem', position: 2, name: bill.short_title, item: `${siteUrl}/assembly/bills/${id}` },
    ],
  }

  const { stageIdx, scheduledIdx } = computeBillProgress(
    stages.map(s => ({ stage: s.stage, plenaryDate: s.plenary_date })),
    bill.royal_assent_date,
  )
  const billPassed =
    bill.royal_assent_date != null ||
    (bill.final_stage_has_division === true && /carried/i.test(bill.final_stage_outcome ?? '')) ||
    (bill.final_stage_nodiv_date != null && new Date(bill.final_stage_nodiv_date) <= new Date())

  const billFailed =
    !billPassed &&
    bill.final_stage_has_division === true &&
    /negatived|fell/i.test(bill.final_stage_outcome ?? '')

  return (
    <div className="container" style={{ paddingBottom: 'var(--s-20)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className={`breadcrumb ${styles.pageTop}`}>
        <ol>
          <li><Link href="/assembly/bills">Legislation</Link></li>
          <li aria-current="page"><span>{bill.short_title}</span></li>
        </ol>
      </nav>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.tags}>
          <span className="tag">Bill {bill.bill_id}</span>
          {bill.bill_type && <span className="tag">{bill.bill_type}</span>}
          {bill.royal_assent_date != null && <span className="pill pass">Became law</span>}
          {billPassed && !bill.royal_assent_date && <span className="pill warn">Awaiting Royal Assent</span>}
          {billFailed && <span className="pill fail">Failed</span>}
        </div>
        <h1 className={styles.title}>{bill.short_title}</h1>
        {bill.long_title && <p className={styles.lede}>{bill.long_title}</p>}
      </header>

      {/* Stage tracker */}
      <section className={styles.stagesSection}>
        <h2 className={styles.stagesSectionHead}>Progress</h2>
        <div className={styles.stages}>
          {BILL_STAGES.map((s, i) => {
            const completedUpTo = scheduledIdx !== null ? scheduledIdx - 1 : stageIdx
            const cls = i <= completedUpTo ? styles.stageDone : i === scheduledIdx ? styles.stageCurrent : ''
            return (
              <div key={s} className={`${styles.stage} ${cls}`}>
                {s}
              </div>
            )
          })}
        </div>
        <div className={styles.stagesMobileBar}>
          {BILL_STAGES.map((s, i) => {
            const completedUpTo = scheduledIdx !== null ? scheduledIdx - 1 : stageIdx
            const cls = i <= completedUpTo ? styles.stageDone : i === scheduledIdx ? styles.stageCurrent : ''
            return (
              <div key={s} className={`${styles.stagesMobileSeg} ${cls}`} />
            )
          })}
        </div>
        <p className={styles.stagesMobileLabel}>
          <span className={styles.stagesMobileCount}>{stageIdx + 1} of {BILL_STAGES.length}</span>
          {' · '}{BILL_STAGES[stageIdx]}
        </p>
      </section>

      {summary && (
        <>
          <section aria-labelledby="summary-heading" className={styles.summarySection}>
            <h2 id="summary-heading" className={styles.sectionHeading}>What this bill does</h2>
            <p className={styles.summaryText}>{summary.summary}</p>
          </section>

          <section aria-labelledby="impact-heading" className={styles.impactSection}>
            <h2 id="impact-heading" className={styles.sectionHeading}>Impact areas</h2>
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
          </section>
        </>
      )}

      <hr className="section-rule" />

      <section aria-labelledby="stages-heading">
        <h2 id="stages-heading" className={styles.sectionHeading}>Legislative stages</h2>
        <p className={styles.guidePrompt}>
          <Link href="/assembly/legislation-guide">How does a bill become law? <span aria-hidden="true">↗</span></Link>
        </p>
        <BillTimeline stages={stages} royalAssentDate={bill.royal_assent_date} latestDate={bill.latest_date} />
      </section>
    </div>
  )
}
