import type { Metadata } from 'next'
import styles from './about.module.css'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'About',
  description: 'About Stormont Watch — tracking every vote in the Northern Ireland Assembly since February 2024.',
  alternates: { canonical: 'https://stormontwatch.com/about' },
}

export default function AboutPage() {
  return (
    <div className="container">
      <div className={styles.page}>
        <header className="page-header">
          <h1>About Stormont Watch</h1>
        </header>

        <section className={styles.section}>
          <h2>What we are</h2>
          <p>
            Stormont Watch is an independent civic accountability site that tracks every recorded
            vote in the Northern Ireland Assembly since February 2024. Our aim is to make the
            Assembly&apos;s work accessible and understandable to every citizen.
          </p>
          <p>
            We believe democracy works better when people can see clearly how their elected
            representatives vote on the issues that affect their lives.
          </p>
        </section>

        <hr className="section-rule" />

        <section className={styles.section}>
          <h2>Methodology</h2>
          <p>
            Voting data is sourced directly from the Assembly&apos;s open data API.
            We do not alter or interpret the raw vote data.
          </p>
          <p>
            The &quot;No Show&quot; category is derived by comparing the full list of current MLAs
            against those recorded as having voted in each division. Any MLA not recorded in the
            voting data for a division is marked as a No Show.
          </p>
        </section>

        <hr className="section-rule" />

        <section className={styles.section}>
          <h2>Contact</h2>
          <p>
            For general enquiries or to report an error in our data, contact us at{' '}
            <a href="mailto:hello@stormontwatch.com">hello@stormontwatch.com</a>.
          </p>
        </section>

        <hr className="section-rule" />

        <section className={styles.section}>
          <h2>Data attribution</h2>
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
            Constituency boundary data is sourced from the OSNI Open Data Largescale Boundaries —
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
    </div>
  )
}
