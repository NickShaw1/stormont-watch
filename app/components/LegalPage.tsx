import type { LucideIcon } from 'lucide-react'
import styles from './LegalPage.module.css'

const TONES = [styles.tnBlue, styles.tnPurple, styles.tnGreen, styles.tnAmber, styles.tnTeal, styles.tnCoral, styles.tnIndigo]

export interface LegalSection {
  id: string
  label: string
  title: string
  Icon: LucideIcon
  wide?: boolean
  rows?: number
  children: React.ReactNode
}

export default function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
  layout = 'grid',
}: {
  eyebrow: string
  title: string
  intro: React.ReactNode
  sections: LegalSection[]
  layout?: 'grid' | 'single'
}) {
  const hasRows = sections.some((s) => s.rows)
  return (
    <div className={styles.page}>
      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="legal-title">
        <div className="container">
          <header className={styles.head}>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h1 className={styles.h1} id="legal-title">{title}</h1>
            <p className={styles.intro}>{intro}</p>
          </header>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandTint}`} aria-label="Details">
        <div className="container">
          <ul className={layout === 'single' ? styles.single : styles.grid}>
            {sections.map(({ id, label, title: heading, Icon, wide, rows, children }, i) => (
              <li
                key={id}
                className={layout === 'grid' && (wide || (!hasRows && i === sections.length - 1 && sections.length % 2 === 1)) ? styles.span : undefined}
                style={rows ? { gridRow: `span ${rows}` } : undefined}
              >
                <section className={styles.tile} aria-labelledby={`legal-${id}`}>
                  <div className={styles.tileHead}>
                    <span className={`${styles.iconTile} ${TONES[i % TONES.length]}`}><Icon size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <div className={styles.tileTitles}>
                      <span className={styles.tileLabel}>{label}</span>
                      <h2 className={styles.tileTitle} id={`legal-${id}`}>{heading}</h2>
                    </div>
                  </div>
                  <div className={styles.body}>{children}</div>
                </section>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
