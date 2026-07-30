import type { Metadata } from 'next'
import { ScrollText, PenLine, Copyright, ShieldAlert } from 'lucide-react'
import styles from '../about/about.module.css'


export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms of use for Stormont Watch.',
  alternates: { canonical: 'https://www.stormontwatch.com/terms' },
  robots: { index: false },
}

export default function TermsPage() {
  return (
    <div className="container">
      <header className={styles.pageHeader}>
        <span className={styles.pageHeaderEyebrow}>Last updated: April 2026</span>
        <h1 className={styles.pageHeaderTitle}>
          <ScrollText className={styles.pageHeaderIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
          Terms of Use
        </h1>
        <p className={styles.lede}>
          The terms that apply to your use of the Stormont Watch website.
        </p>
      </header>

      <section className={styles.section}>
        <div>
          <span className={styles.sectionEyebrow}>Report an error</span>
          <h2 className={styles.sectionTitle}>
            <PenLine className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Corrections policy
          </h2>
        </div>
        <p>
          We aim to ensure all information is accurate and up to date. If you believe any
          information is incorrect, please contact us at{' '}
          <a href="mailto:hello@stormontwatch.com">hello@stormontwatch.com</a>. We will
          investigate and, where appropriate, correct or remove the information promptly.
        </p>
      </section>

      <section className={styles.section}>
        <div>
          <span className={styles.sectionEyebrow}>Content ownership</span>
          <h2 className={styles.sectionTitle}>
            <Copyright className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Copyright
          </h2>
        </div>
        <p>
          Original editorial content on this site is copyright Stormont Watch. Voting data
          reproduced from the NI Assembly Open Data API is subject to the Assembly&apos;s
          own open data licence.
        </p>
        <p>
          Parliamentary copyright images are reproduced with the permission of the Northern Ireland Assembly Commission.
        </p>
      </section>

      <section className={`${styles.section} ${styles.sectionLast}`}>
        <div>
          <span className={styles.sectionEyebrow}>Disclaimer</span>
          <h2 className={styles.sectionTitle}>
            <ShieldAlert className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            No warranty
          </h2>
        </div>
        <p>
          This site is provided &quot;as is&quot;, without warranty of any kind. We do not
          guarantee that the information is complete, current or error-free.
        </p>
      </section>
    </div>
  )
}
