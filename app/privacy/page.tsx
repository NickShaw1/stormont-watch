import type { Metadata } from 'next'
import styles from '../about/about.module.css'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for Stormont Watch.',
  alternates: { canonical: 'https://stormontwatch.com/privacy' },
  robots: { index: false },
}

export default function PrivacyPage() {
  return (
    <div className="container">
      <div className={styles.page}>
        <header className="page-header">
          <h1>Privacy Policy</h1>
          <p>Last updated: April 2026</p>
        </header>

        <section className={styles.section}>
          <h2>What data we collect</h2>
          <p>
            Stormont Watch does not collect any personal data from visitors. We do not use
            cookies, tracking scripts, analytics, or advertising technologies of any kind.
          </p>
        </section>

        <hr className="section-rule" />

        <section className={styles.section}>
          <h2>Cookies</h2>
          <p>
            This site does not set any cookies.
          </p>
        </section>

        <hr className="section-rule" />

        <section className={styles.section}>
          <h2>Third-party services</h2>
          <p>
            Voting data is fetched from the NI Assembly Open Data API on the server. No
            third-party scripts are loaded in your browser. Visitor IP addresses may be
            processed by our hosting provider in the ordinary course of serving web pages;
            we do not have access to this data.
          </p>
        </section>

        <hr className="section-rule" />

        <section className={styles.section}>
          <h2>Your rights</h2>
          <p>
            Because we do not collect personal data, there is no personal data about you
            held by Stormont Watch for you to access, correct or delete. If you have any
            questions, contact us at{' '}
            <a href="mailto:hello@stormontwatch.com">hello@stormontwatch.com</a>.
          </p>
        </section>

        <hr className="section-rule" />

        <section className={styles.section}>
          <h2>Changes to this policy</h2>
          <p>
            We may update this policy from time to time. The date at the top of this page
            reflects when it was last revised.
          </p>
        </section>
      </div>
    </div>
  )
}
