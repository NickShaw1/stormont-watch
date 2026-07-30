import type { Metadata } from 'next'
import { Lock, Database, Cookie, Share2, UserCheck, RefreshCw } from 'lucide-react'
import styles from '../about/about.module.css'


export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for Stormont Watch.',
  alternates: { canonical: 'https://www.stormontwatch.com/privacy' },
  robots: { index: false },
}

export default function PrivacyPage() {
  return (
    <div className="container">
      <header className={styles.pageHeader}>
        <span className={styles.pageHeaderEyebrow}>Last updated: April 2026</span>
        <h1 className={styles.pageHeaderTitle}>
          <Lock className={styles.pageHeaderIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
          Privacy Policy
        </h1>
        <p className={styles.lede}>
          How Stormont Watch handles data from visitors to this site.
        </p>
      </header>

      <section className={styles.section}>
        <div>
          <span className={styles.sectionEyebrow}>No tracking</span>
          <h2 className={styles.sectionTitle}>
            <Database className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            What data we collect
          </h2>
        </div>
        <p>
          Stormont Watch does not collect any personal data from visitors. We do not use
          cookies, tracking scripts, analytics, or advertising technologies of any kind.
        </p>
      </section>

      <section className={styles.section}>
        <div>
          <span className={styles.sectionEyebrow}>None set</span>
          <h2 className={styles.sectionTitle}>
            <Cookie className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Cookies
          </h2>
        </div>
        <p>
          This site does not set any cookies.
        </p>
      </section>

      <section className={styles.section}>
        <div>
          <span className={styles.sectionEyebrow}>Hosting</span>
          <h2 className={styles.sectionTitle}>
            <Share2 className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Third-party services
          </h2>
        </div>
        <p>
          Voting data is fetched from the NI Assembly Open Data API on the server. No
          third-party scripts are loaded in your browser. Visitor IP addresses may be
          processed by our hosting provider in the ordinary course of serving web pages;
          we do not have access to this data.
        </p>
      </section>

      <section className={styles.section}>
        <div>
          <span className={styles.sectionEyebrow}>Access and deletion</span>
          <h2 className={styles.sectionTitle}>
            <UserCheck className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Your rights
          </h2>
        </div>
        <p>
          Because we do not collect personal data, there is no personal data about you
          held by Stormont Watch for you to access, correct or delete. If you have any
          questions, contact us at{' '}
          <a href="mailto:hello@stormontwatch.com">hello@stormontwatch.com</a>.
        </p>
      </section>

      <section className={`${styles.section} ${styles.sectionLast}`}>
        <div>
          <span className={styles.sectionEyebrow}>Updates</span>
          <h2 className={styles.sectionTitle}>
            <RefreshCw className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Changes to this policy
          </h2>
        </div>
        <p>
          We may update this policy from time to time. The date at the top of this page
          reflects when it was last revised.
        </p>
      </section>
    </div>
  )
}
