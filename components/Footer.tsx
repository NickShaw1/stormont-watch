'use client'

import Link from 'next/link'
import { ArrowUp } from 'lucide-react'
import Logo from './Logo'
import { useArchiveBase } from '@/lib/hooks/useArchiveBase'
import { CURRENT_MANDATE, mandateById } from '@/lib/constants/mandates'
import { PRIMARY_LINKS, ACCOUNTABILITY_LINKS, ABOUT_LINKS } from '@/lib/constants/navigation'
import styles from './Footer.module.css'

export default function Footer() {
  // Footer sits outside the archive's MandateProvider, so derive mandate from the URL.
  const { archiveId, basePath, homeHref } = useArchiveBase()
  const mandate = (archiveId ? mandateById(archiveId) : null) ?? CURRENT_MANDATE

  const scrollTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <Link href={homeHref} className={styles.brandLink}>
              <span className={styles.logoWrap}><Logo size={20} /></span>
              <span className={styles.brandName}>
                <span className={styles.brandStormont}>Stormont </span>
                <span className={styles.brandWatch}>Watch</span>
              </span>
            </Link>
            <p className={styles.tagline}>
              An independent public record of the Northern Ireland Assembly: votes, expenses, attendance and legislation, for every mandate.
            </p>
          </div>

          <nav className={styles.columns} aria-label="Footer">
            <div className={styles.col}>
              <p className={styles.heading}>Assembly</p>
              <ul className={styles.links} role="list">
                {PRIMARY_LINKS.filter((l) => l.footerLabel).sort((a, b) => (a.footerOrder ?? 0) - (b.footerOrder ?? 0)).map((l) => (
                  <li key={l.href}><Link href={`${basePath}${l.href}`}>{l.footerLabel}</Link></li>
                ))}
              </ul>
            </div>

            <div className={styles.col}>
              <p className={styles.heading}>Accountability</p>
              <ul className={styles.links} role="list">
                {ACCOUNTABILITY_LINKS.map((l) => (
                  <li key={l.href}><Link href={`${basePath}${l.href}`}>{l.label}</Link></li>
                ))}
              </ul>
            </div>

            <div className={`${styles.col} ${styles.about}`}>
              <p className={styles.heading}>About</p>
              <ul className={styles.links} role="list">
                {ABOUT_LINKS.map((l) => (
                  <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        <div className={styles.bottom}>
          <span className={styles.copy}>&copy; {mandate.label} mandate</span>
          <span className={styles.licence}>
            Contains public sector information licensed under the{' '}
            <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noreferrer noopener">
              Open Government Licence v3.0
              <span className="sr-only"> (opens in a new tab)</span>
            </a>.
          </span>
          <button type="button" className={styles.top} onClick={scrollTop} aria-label="Back to top">
            <ArrowUp size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  )
}
