import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllBills, getBillStages } from '@/lib/db/queries'

export const revalidate = 86400
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
  params: { id: string }
}

async function getBillBySlug(id: string) {
  const allBills = await getAllBills()
  return allBills.find(b => billSlug(b.bill_id) === id) ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const bill = await getBillBySlug(params.id)
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
    },
    alternates: { canonical: `https://www.stormontwatch.com/assembly/bills/${params.id}` },
  }
}

function formatLongTitle(longTitle: string | null) {
  if (!longTitle) return null
  return <p className={styles.longTitleSingle}>{longTitle}</p>
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
  const { id } = params
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

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <header className={styles.header}>
        <nav aria-label="Breadcrumb" className={`breadcrumb ${styles.breadcrumb}`}>
          <ol>
            <li><Link href="/assembly/bills">Legislation</Link></li>
            <li aria-current="page"><span>{bill.short_title}</span></li>
          </ol>
        </nav>
        <h1 className={styles.title}>{bill.short_title}</h1>
        {bill.long_title && (
          <>
            <h2 className={styles.sectionHeadingRuled}>Overview</h2>
            {formatLongTitle(bill.long_title)}
          </>
        )}
      </header>

      <hr className={`section-rule ${styles.sectionRule}`} />

      {summary && (
        <>
          <section aria-labelledby="summary-heading" className={styles.summarySection}>
            <h2 id="summary-heading" className={styles.sectionHeading}>What this bill does</h2>
            <p className={styles.summaryText}>{summary.summary}</p>
          </section>

          <section aria-labelledby="impact-heading" className={styles.impactSection}>
            <h2 id="impact-heading" className="sr-only">Impact areas</h2>
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

      <section aria-labelledby="stages-heading" className={styles.section}>
        <h2 id="stages-heading" className={styles.sectionHeadingRuled}>Legislative stages</h2>
        <p className={styles.guidePrompt}>
          <Link href="/assembly/legislation-guide">How does a bill become law? <span aria-hidden="true">↗</span></Link>
        </p>
        <BillTimeline stages={stages} royalAssentDate={bill.royal_assent_date} />
      </section>
    </div>
  )
}
