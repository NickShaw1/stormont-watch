'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Footer.module.css'
import { CURRENT_MANDATE, mandateById } from '@/lib/constants/mandates'

function EyeLogo() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}

export default function Footer() {
  // Footer sits outside the archive's MandateProvider, so derive mandate from the URL.
  const pathname = usePathname()
  const archiveMatch = pathname.match(/^\/archive\/([^/]+)/)
  const mandate = (archiveMatch ? mandateById(archiveMatch[1]) : null) ?? CURRENT_MANDATE
  const basePath = archiveMatch ? `/archive/${archiveMatch[1]}` : ''
  const homeHref = basePath || '/'

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.grid}>
          {/* Brand column */}
          <div className={styles.brand}>
            <Link href={homeHref} className={styles.brandLink}>
              <span className={styles.brandLogoWrap}><EyeLogo /></span>
              <span className={styles.brandName}>
                <span className={styles.brandStormont}>Stormont </span>
                <span className={styles.brandWatch}>Watch</span>
              </span>
            </Link>
            <p className={styles.brandTagline}>
              An independent public record of the Northern Ireland Assembly: votes, expenses, attendance and legislation, for every mandate.
            </p>
          </div>

          <div className={styles.colGroup}>
            {/* Assembly column */}
            <div className={styles.col}>
              <p className={styles.colHeading}>Assembly</p>
              <ul className={styles.colLinks} role="list">
                <li><Link href={`${basePath}/assembly/mlas`}>MLAs</Link></li>
                <li><Link href={`${basePath}/assembly/parties`}>Parties</Link></li>
                <li><Link href={`${basePath}/assembly/votes`}>Divisions</Link></li>
                <li><Link href={`${basePath}/assembly/bills`}>Bills</Link></li>
              </ul>
            </div>

            {/* Accountability column */}
            <div className={styles.col}>
              <p className={styles.colHeading}>Accountability</p>
              <ul className={styles.colLinks} role="list">
                <li><Link href={`${basePath}/assembly/expenses`}>Expenses</Link></li>
                <li><Link href={`${basePath}/assembly/salaries`}>Salaries</Link></li>
                <li><Link href={`${basePath}/assembly/questions`}>Questions</Link></li>
                <li><Link href={`${basePath}/assembly/sittings`}>Sittings</Link></li>
              </ul>
            </div>

            {/* About column */}
            <div className={styles.col}>
              <p className={styles.colHeading}>About</p>
              <ul className={styles.colLinks} role="list">
                <li><Link href="/about">Methodology</Link></li>
                <li><Link href="/privacy">Privacy</Link></li>
                <li><Link href="/terms">Terms</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <span>&copy; {mandate.label} mandate</span>
          <span>
            Contains public sector information licensed under the{' '}
            <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noreferrer noopener">
              Open Government Licence v3.0
            </a>.
          </span>
        </div>
      </div>
    </footer>
  )
}
