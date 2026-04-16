import type { Metadata } from 'next'
import styles from '../about/about.module.css'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms of use for Stormont Watch.',
  alternates: { canonical: 'https://stormontwatch.com/terms' },
  robots: { index: false },
}

export default function TermsPage() {
  return (
    <div className="container">
      <div className={styles.page}>
        <header className="page-header">
          <h1>Terms of Use</h1>
          <p>Last updated: April 2026</p>
        </header>

        <section className={styles.section}>
          <h2>Corrections policy</h2>
          <p>
            We aim to ensure all information is accurate and up to date. If you believe any
            information is incorrect, please contact us at{' '}
            <a href="mailto:hello@stormontwatch.com">hello@stormontwatch.com</a>. We will
            investigate and, where appropriate, correct or remove the information promptly.
          </p>
        </section>

        <hr className="section-rule" />

        <section className={styles.section}>
          <h2>Copyright</h2>
          <p>
            Original editorial content on this site is copyright Stormont Watch. Voting data
            reproduced from the NI Assembly Open Data API is subject to the Assembly&apos;s
            own open data licence.
          </p>
          <p>
            Parliamentary copyright images are reproduced with the permission of the Northern Ireland Assembly Commission.
          </p>
        </section>

        <hr className="section-rule" />

        <section className={styles.section}>
          <h2>No warranty</h2>
          <p>
            This site is provided &quot;as is&quot;, without warranty of any kind. We do not
            guarantee that the information is complete, current or error-free.
          </p>
        </section>
      </div>
    </div>
  )
}
