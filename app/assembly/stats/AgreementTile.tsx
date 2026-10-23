import styles from './statsKit.module.css'

interface Props {
  agreePct: number
  agreed: number
  totalDivisions: number
  items: { label: string; value: number }[]
  barColor?: string
}

export default function AgreementTile({ agreePct, agreed, totalDivisions, items, barColor }: Props) {
  return (
    <div className={`${styles.agree} ${styles.agreeWide}`} style={barColor ? ({ ['--ag' as string]: barColor } as React.CSSProperties) : undefined}>
      <div className={styles.agreeMain}>
        <div className={styles.agreeTop}>
          <span className={styles.agreeBig}>{agreePct}%</span>
          <span className={styles.agreeMeta}>{agreed} of {totalDivisions} divisions</span>
        </div>
        <span className={styles.agreeBar} aria-hidden="true"><span style={{ width: `${agreePct}%` }} /></span>
      </div>
      <ul className={styles.agreeList}>
        {items.map((it) => (
          <li key={it.label} className={styles.agreeItem}><b>{it.value}</b><span>{it.label}</span></li>
        ))}
      </ul>
    </div>
  )
}
