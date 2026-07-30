import type { Metadata } from 'next'
import { Info, FileText, ShieldCheck, Mail, Database } from 'lucide-react'
import styles from './about.module.css'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'


export const metadata: Metadata = {
  title: 'About',
  description: `About Stormont Watch: tracking every vote in the Northern Ireland Assembly since ${CURRENT_MANDATE.startLabel}.`,
  openGraph: {
    title: 'About: Stormont Watch',
    description: `About Stormont Watch: tracking every vote in the Northern Ireland Assembly since ${CURRENT_MANDATE.startLabel}.`,
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch, NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/about' },
}

export default function AboutPage() {
  return (
    <div className="container">
      <header className={styles.pageHeader}>
        <span className={styles.pageHeaderEyebrow}>Methodology</span>
        <h1 className={styles.pageHeaderTitle}>
          <Info className={styles.pageHeaderIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
          About Stormont Watch
        </h1>
        <p className={styles.lede}>
          An independent civic accountability site tracking every recorded vote in the Northern
          Ireland Assembly since {CURRENT_MANDATE.startLabel}.
        </p>
      </header>

      <section className={styles.section}>
        <div>
          <span className={styles.sectionEyebrow}>Our mission</span>
          <h2 className={styles.sectionTitle}>
            <FileText className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            What we are
          </h2>
        </div>
        <p>
          Stormont Watch is an independent civic accountability site that tracks every recorded
          vote in the Northern Ireland Assembly since {CURRENT_MANDATE.startLabel}. Our aim is to make the
          Assembly&apos;s work accessible and understandable to every citizen.
        </p>
        <p>
          We believe democracy works better when people can see clearly how their elected
          representatives vote on the issues that affect their lives.
        </p>
      </section>

      <section className={styles.section}>
        <div>
          <span className={styles.sectionEyebrow}>How we calculate</span>
          <h2 className={styles.sectionTitle}>
            <ShieldCheck className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Methodology
          </h2>
        </div>
        <p>
          Voting data is sourced directly from the NI Assembly Open Data API. Where noted,
          some figures such as voting attendance, party cohesion and cross-community agreement
          rates are calculations derived by Stormont Watch from the raw data. They are not
          published by the Assembly.
        </p>
        <p>
          The &quot;No Show&quot; category is derived by comparing the full list of current MLAs
          against those recorded as having voted in each division. Any MLA not recorded in the
          voting data for a division is marked as a No Show.
        </p>
      </section>

      <section className={styles.section}>
        <div>
          <span className={styles.sectionEyebrow}>Get in touch</span>
          <h2 className={styles.sectionTitle}>
            <Mail className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Contact
          </h2>
        </div>
        <p>
          For general enquiries or to report an error in our data, contact us at{' '}
          <a href="mailto:hello@stormontwatch.com">hello@stormontwatch.com</a>.
        </p>
      </section>

      <section className={`${styles.section} ${styles.sectionLast}`}>
        <div>
          <span className={styles.sectionEyebrow}>Sources</span>
          <h2 className={styles.sectionTitle}>
            <Database className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Data attribution
          </h2>
        </div>
        <p>
          Voting data is sourced from the{' '}
          <a
            href="http://data.niassembly.gov.uk"
            target="_blank"
            rel="noreferrer noopener"
          >
            NI Assembly Open Data API
          </a>
          , published by the Northern Ireland Assembly under its open data licence.
        </p>
        <p>
          Constituency boundary data is sourced from the OSNI Open Data Largescale Boundaries:
          Parliamentary Constituencies 2008 dataset, published by Ordnance Survey Northern
          Ireland via{' '}
          <a
            href="https://admin.opendatani.gov.uk/"
            target="_blank"
            rel="noreferrer noopener"
          >
            Open Data NI
          </a>{' '}
          under the LPS Open Government Data Licence.
        </p>
        <p>
          Parliamentary copyright images are reproduced with the permission of the Northern Ireland Assembly Commission.
        </p>
      </section>
    </div>
  )
}
