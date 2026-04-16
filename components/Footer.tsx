import styles from './Footer.module.css'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <p>
          Contains Parliamentary information licensed under the{' '}
          <a
            href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
            target="_blank"
            rel="noreferrer noopener"
          >
            Open Government Licence v3.0
          </a>
          .
        </p>
        <nav aria-label="Footer navigation">
          <ul className={styles.links} role="list">
            <li><a href="/about">About</a></li>
            <li><a href="/privacy">Privacy</a></li>
            <li><a href="/terms">Terms</a></li>
          </ul>
        </nav>
        <p>&copy; {year} Stormont Watch</p>
      </div>
    </footer>
  )
}
