import Link from 'next/link'
import styles from './Footer.module.css'

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
  const year = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.grid}>
          {/* Brand column */}
          <div className={styles.brand}>
            <Link href="/" className={styles.brandLink}>
              <span className={styles.brandLogoWrap}><EyeLogo /></span>
              <span className={styles.brandName}>
                <span className={styles.brandStormont}>Stormont </span>
                <span className={styles.brandWatch}>Watch</span>
              </span>
            </Link>
            <p className={styles.brandTagline}>
              Every vote, every MLA, every bill in the Northern Ireland Assembly since May 2022. An independent public-interest project.
            </p>
            <div className={styles.brandBadges}>
              <span className={styles.badge}>2022–2027 mandate</span>
            </div>
          </div>

          {/* Explore column */}
          <div className={styles.col}>
            <p className={styles.colHeading}>Explore</p>
            <ul className={styles.colLinks} role="list">
              <li><Link href="/assembly/structure">Assembly</Link></li>
              <li><Link href="/assembly/mlas">MLAs</Link></li>
              <li><Link href="/assembly/bills">Legislation</Link></li>
              <li><Link href="/assembly/votes">Votes</Link></li>
              <li><Link href="/assembly/stats">Statistics</Link></li>
            </ul>
          </div>

          {/* Data column */}
          <div className={styles.col}>
            <p className={styles.colHeading}>Data</p>
            <ul className={styles.colLinks} role="list">
              <li><Link href="/assembly/expenses">Expenses</Link></li>
              <li>
                <a
                  href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Source: NI Assembly API
                </a>
              </li>
            </ul>
          </div>

          {/* About column */}
          <div className={styles.col}>
            <p className={styles.colHeading}>About</p>
            <ul className={styles.colLinks} role="list">
              <li><Link href="/about">About the project</Link></li>
              <li><Link href="/privacy">Privacy</Link></li>
              <li><Link href="/terms">Terms</Link></li>
            </ul>
          </div>
        </div>

        <div className={styles.bottom}>
          <p>
            &copy; {year} Stormont Watch. Parliamentary information under the{' '}
            <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noreferrer noopener">
              Open Government Licence v3.0
            </a>.
          </p>
          <span className={styles.colophon}>Updated daily · NI Assembly API</span>
        </div>
      </div>
    </footer>
  )
}
