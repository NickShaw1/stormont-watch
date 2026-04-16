import Link from 'next/link'
import { formatDate } from '@/lib/format'
import type { BillSummary } from '@/lib/summaries'
import styles from './BillCard.module.css'

interface Props {
  href: string
  title: string
  latestDate: string
  passed: boolean | null
  summary?: BillSummary | null
  isBill?: boolean
  divisionCount?: number
  isCrossCommunity?: boolean
}

const IMPACT_KEYS: (keyof BillSummary['impact'])[] = [
  'fiscal',
  'rights',
  'publicServices',
  'crossCommunity',
  'environment',
]

export default function BillCard({ href, title, latestDate, passed, summary, isBill, divisionCount, isCrossCommunity }: Props) {
  return (
    <Link href={href} className={`${styles.card}${isBill ? ` ${styles.bill}` : ''}`}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <div className={styles.badges}>
          {isBill && <span className={styles.billBadge}>Bill</span>}
          {passed !== null && (
            <span
              className={`${styles.outcomeBadge} ${passed ? styles.outcomePassed : styles.outcomeFailed}`}
              aria-label={passed ? 'Passed' : 'Failed'}
            >
              {passed ? 'Passed' : 'Failed'}
            </span>
          )}
          {isCrossCommunity && (
            <span className={styles.crossCommunityBadge}>Cross-community</span>
          )}
        </div>
      </div>
      <div className={styles.meta}>
        <span className={styles.dateStr}>{formatDate(latestDate)}</span>
        {divisionCount !== undefined && divisionCount > 1 && (
          <span className={styles.stageCount}>{divisionCount} stages</span>
        )}
        <span className={styles.dots} aria-label="Impact indicators">
          {IMPACT_KEYS.map((key) => {
            const level = summary?.impact?.[key] ?? 'none'
            return (
              <span
                key={key}
                className={styles.dot}
                data-level={level}
                aria-hidden="true"
              />
            )
          })}
        </span>
        <div className={styles.mobileBadges} aria-hidden="true">
          {isBill && <span className={styles.billBadge}>Bill</span>}
          {passed !== null && (
            <span className={`${styles.outcomeBadge} ${passed ? styles.outcomePassed : styles.outcomeFailed}`}>
              {passed ? 'Passed' : 'Failed'}
            </span>
          )}
          {isCrossCommunity && (
            <span className={styles.crossCommunityBadge}>Cross-community</span>
          )}
        </div>
      </div>
    </Link>
  )
}
