import Link from 'next/link'
import { ArrowRight, Users, Landmark, Vote, Scale, BarChart3, Building2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import styles from './ErrorPageShell.module.css'

const DESTINATIONS: { href: string; title: string; desc: string; Icon: LucideIcon; tone: string }[] = [
  { href: '/assembly/mlas', title: 'MLAs', desc: 'Find your MLAs and see their record.', Icon: Users, tone: styles.tnBlue },
  { href: '/assembly/parties', title: 'Parties', desc: 'Seats, votes and spending by party.', Icon: Landmark, tone: styles.tnPurple },
  { href: '/assembly/votes', title: 'Votes', desc: 'Every division and how each MLA voted.', Icon: Vote, tone: styles.tnGreen },
  { href: '/assembly/bills', title: 'Legislation', desc: 'Bills and where they are in the process.', Icon: Scale, tone: styles.tnAmber },
  { href: '/assembly/stats', title: 'Statistics', desc: 'Voting, spending and activity in numbers.', Icon: BarChart3, tone: styles.tnTeal },
  { href: '/assembly/structure', title: 'Structure', desc: 'The Executive, departments and committees.', Icon: Building2, tone: styles.tnCoral },
]

export const errorButtonClass = {
  primary: `${styles.btn} ${styles.btnPrimary}`,
  ghost: `${styles.btn} ${styles.btnGhost}`,
}

export default function ErrorPageShell({
  code,
  title,
  message,
  Icon,
  isError = false,
  actions,
}: {
  code: string
  title: string
  message: string
  Icon: LucideIcon
  isError?: boolean
  actions: React.ReactNode
}) {
  const tone = isError ? styles.tnError : styles.tnAmber
  return (
    <div className={styles.page}>
      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="error-title">
        <div className="container">
          <header className={tone}>
            <div className={styles.statusRow}>
              <span className={`${styles.iconTile} ${styles.iconTileLarge}`}><Icon size={28} strokeWidth={2} aria-hidden="true" /></span>
              <span className={styles.code} aria-hidden="true">{code}</span>
            </div>
            <span className={styles.eyebrow}>Error {code}</span>
            <h1 className={styles.h1} id="error-title">{title}</h1>
            <p className={styles.sub}>{message}</p>
          </header>
          <div className={styles.actions}>{actions}</div>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandTint}`} aria-labelledby="error-explore">
        <div className="container">
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>Explore</span>
            <h2 className={styles.h2} id="error-explore">Find what you need</h2>
            <p className={styles.sectionSub}>Jump to one of the main sections of the site.</p>
          </div>
          <ul className={styles.grid}>
            {DESTINATIONS.map(({ href, title: t, desc, Icon: I, tone: d }) => (
              <li key={href} className={styles.tile}>
                <span className={`${styles.iconTile} ${d}`}><I size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={styles.tileText}>
                  <Link href={href} className={styles.tileLink}>{t}</Link>
                  <span className={styles.tileDesc}>{desc}</span>
                </span>
                <ArrowRight className={styles.tileArrow} size={18} strokeWidth={2} aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
