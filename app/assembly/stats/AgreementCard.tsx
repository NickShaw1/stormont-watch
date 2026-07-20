import styles from './stats.module.css'

interface Props {
  title: string
  agreePct: number
  agreed: number
  totalDivisions: number
  items: { label: string; value: number }[]
  /** Overrides the default teal bar. */
  barColor?: string
}

export default function AgreementCard({ title, agreePct, agreed, totalDivisions, items, barColor }: Props) {
  return (
    <div className={styles.partyRankingCard}>
      <p className={styles.partyRankingTitle}>{title}</p>

      <div className={styles.bigTwoValueRow}>
        <span className={styles.patternBigValue}>{agreePct}%</span>
        <span className={styles.bigTwoMeta}>
          {agreed} of {totalDivisions} divisions
        </span>
      </div>

      <div className={styles.bigTwoBarTrack} aria-hidden="true">
        <div
          className={styles.bigTwoBarFill}
          style={{ width: `${agreePct}%`, ...(barColor ? { background: barColor } : {}) }}
        />
      </div>

      <dl className={styles.bigTwoBreakdown}>
        {items.map((item) => (
          <div key={item.label} className={styles.bigTwoBreakdownItem}>
            <dt>{item.label}</dt>
            <dd className={styles.bigTwoBreakdownValue}>{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
