import type { Metadata } from 'next'
import Link from 'next/link'
import styles from './legislation-guide.module.css'


export const metadata: Metadata = {
  title: 'How a Bill becomes law — Stormont Watch',
  description: 'A plain English guide to the legislative stages a bill passes through in the Northern Ireland Assembly.',
  openGraph: {
    title: 'How a Bill becomes law — Stormont Watch',
    description: 'A plain English guide to the legislative stages a bill passes through in the Northern Ireland Assembly.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/legislation-guide' },
}

export default function LegislationGuidePage() {
  return (
    <div className="container">
      <header className={`page-header ${styles.pageHeader}`}>
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li><Link href="/assembly/bills">Legislation</Link></li>
            <li aria-current="page">How a bill becomes law</li>
          </ol>
        </nav>
        <h1>How a bill becomes law</h1>
        <p>A plain English guide to the stages a bill passes through in the Northern Ireland Assembly.</p>
      </header>

      <div className={styles.guide}>

        <section id="first-stage" className={styles.stage}>
          <h2 className={styles.stageTitle}>
            <span className={styles.stageLabel}>First Stage</span>
            <span className={styles.stageSub}>Introduction</span>
          </h2>
          <p>The bill is formally introduced to the Assembly. Its title is read out but there is no debate or vote. The full bill text is published online, usually on the same day.</p>
        </section>

        <section id="second-stage" className={styles.stage}>
          <h2 className={styles.stageTitle}>
            <span className={styles.stageLabel}>Second Stage</span>
            <span className={styles.stageSub}>General debate</span>
          </h2>
          <p>All MLAs debate the broad principles of the bill for the first time. The minister or member introducing it explains what it aims to do. Other MLAs give their views. At the end, MLAs vote on whether the bill should proceed. If rejected here the bill falls.</p>
        </section>

        <section id="committee-stage" className={styles.stage}>
          <h2 className={styles.stageTitle}>
            <span className={styles.stageLabel}>Committee Stage</span>
            <span className={styles.stageSub}>Detailed scrutiny</span>
          </h2>
          <p>The bill is sent to the relevant Assembly committee who examine it clause by clause. The committee takes evidence from experts, organisations and the public. They cannot change the bill themselves but produce a report recommending any amendments for later stages. Bills using accelerated passage skip this stage entirely.</p>
        </section>

        <section id="consideration-stage" className={styles.stage}>
          <h2 className={styles.stageTitle}>
            <span className={styles.stageLabel}>Consideration Stage</span>
            <span className={styles.stageSub}>Voting on amendments</span>
          </h2>
          <p>The full Assembly debates and votes on every proposed amendment, clause and schedule of the bill. Amendments are published in advance so MLAs can prepare. The long title of the bill is always voted on last.</p>
          <p className={styles.stageNote}>Not every clause or amendment results in a recorded division. Where there is broad agreement, the presiding officer may ask &ldquo;Is the Assembly agreed?&rdquo; and items pass without a formal vote being called.</p>
        </section>

        <section id="further-consideration-stage" className={styles.stage}>
          <h2 className={styles.stageTitle}>
            <span className={styles.stageLabel}>Further Consideration Stage</span>
            <span className={styles.stageSub}>Final amendments</span>
          </h2>
          <p>A second opportunity to amend the bill. Only new amendments are debated and clauses and schedules are not revisited. If no amendments are proposed this stage has no debate.</p>
        </section>

        <section id="final-stage" className={styles.stage}>
          <h2 className={styles.stageTitle}>
            <span className={styles.stageLabel}>Final Stage</span>
            <span className={styles.stageSub}>Passing the bill</span>
          </h2>
          <p>MLAs debate and vote on whether to pass the bill as a whole. No amendments are made at this stage. If passed the bill moves toward becoming law.</p>
        </section>

        <section id="attorney-general-review" className={styles.stage}>
          <h2 className={styles.stageTitle}>
            <span className={styles.stageLabel}>Attorney General review</span>
          </h2>
          <p>After passing Final Stage the bill is referred to the Attorney General for Northern Ireland and the Advocate General. They consider whether any part of the bill might be outside the Assembly&apos;s legal powers. If they have concerns they can refer it to the Supreme Court. In most cases they confirm the bill can proceed and the Speaker requests Royal Assent.</p>
        </section>

        <section id="reconsideration-stage" className={styles.stage}>
          <h2 className={styles.stageTitle}>
            <span className={styles.stageLabel}>Reconsideration Stage</span>
            <span className={styles.stageSub}>Exceptional circumstances only</span>
          </h2>
          <p>This only happens if the Supreme Court rules part of the bill is outside the Assembly&apos;s powers. MLAs consider only the amendments needed to fix the problem. If agreed they vote on whether to approve the amended bill.</p>
        </section>

        <section id="royal-assent" className={styles.stage}>
          <h2 className={styles.stageTitle}>
            <span className={styles.stageLabel}>Royal Assent</span>
            <span className={styles.stageSub}>Becomes law</span>
          </h2>
          <p>The bill receives Royal Assent and becomes an Act of the Northern Ireland Assembly. The Speaker usually announces this at the next Assembly sitting. The Act may come into force immediately, on a specified date or when a minister issues a commencement order.</p>
        </section>

        <section id="accelerated-passage" className={styles.stage}>
          <h2 className={styles.stageTitle}>
            <span className={styles.stageLabel}>Accelerated passage</span>
          </h2>
          <p>An emergency procedure allowing a bill to pass all stages in as little as ten days. Committee Stage is skipped entirely. Requires cross-community support to proceed.</p>
        </section>

      </div>

      <div className={styles.source}>
        <p>Based on the <a href="https://www.niassembly.gov.uk/assembly-business/legislation/bills-explained/" target="_blank" rel="noopener noreferrer">NI Assembly&apos;s guide to legislation</a>.</p>
      </div>
    </div>
  )
}
