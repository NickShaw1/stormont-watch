import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Info } from 'lucide-react'
import styles from './legislation-guide.module.css'


export const metadata: Metadata = {
  title: 'How a Bill becomes law',
  description: 'A plain English guide to the legislative stages a bill passes through in the Northern Ireland Assembly.',
  openGraph: {
    title: 'How a Bill becomes law - Stormont Watch',
    description: 'A plain English guide to the legislative stages a bill passes through in the Northern Ireland Assembly.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/legislation-guide' },
}

const STAGES: { id: string; label: string; sub?: string; body: string; note?: string }[] = [
  {
    id: 'first-stage',
    label: 'First Stage',
    sub: 'Introduction',
    body: 'The bill is formally introduced to the Assembly. Its title is read out but there is no debate or vote. The full bill text is published online, usually on the same day.',
  },
  {
    id: 'second-stage',
    label: 'Second Stage',
    sub: 'General debate',
    body: 'All MLAs debate the broad principles of the bill for the first time. The minister or member introducing it explains what it aims to do. Other MLAs give their views. At the end, MLAs vote on whether the bill should proceed. If rejected here the bill falls.',
  },
  {
    id: 'committee-stage',
    label: 'Committee Stage',
    sub: 'Detailed scrutiny',
    body: 'The bill is sent to the relevant Assembly committee who examine it clause by clause. The committee takes evidence from experts, organisations and the public. They cannot change the bill themselves but produce a report recommending any amendments for later stages. Bills using accelerated passage skip this stage entirely.',
  },
  {
    id: 'consideration-stage',
    label: 'Consideration Stage',
    sub: 'Voting on amendments',
    body: 'The full Assembly debates and votes on every proposed amendment, clause and schedule of the bill. Amendments are published in advance so MLAs can prepare. The long title of the bill is always voted on last.',
    note: 'Not every clause or amendment results in a recorded division. Where there is broad agreement, the presiding officer may ask "Is the Assembly agreed?" and items pass without a formal vote being called.',
  },
  {
    id: 'further-consideration-stage',
    label: 'Further Consideration Stage',
    sub: 'Final amendments',
    body: 'A second opportunity to amend the bill. Only new amendments are debated and clauses and schedules are not revisited. If no amendments are proposed this stage has no debate.',
  },
  {
    id: 'final-stage',
    label: 'Final Stage',
    sub: 'Passing the bill',
    body: 'MLAs debate and vote on whether to pass the bill as a whole. No amendments are made at this stage. If passed the bill moves toward becoming law.',
  },
  {
    id: 'attorney-general-review',
    label: 'Attorney General review',
    body: 'After passing Final Stage the bill is referred to the Attorney General for Northern Ireland and the Advocate General. They consider whether any part of the bill might be outside the Assembly’s legal powers. If they have concerns they can refer it to the Supreme Court. In most cases they confirm the bill can proceed and the Speaker requests Royal Assent.',
  },
  {
    id: 'reconsideration-stage',
    label: 'Reconsideration Stage',
    sub: 'Exceptional circumstances only',
    body: 'This only happens if the Supreme Court rules part of the bill is outside the Assembly’s powers. MLAs consider only the amendments needed to fix the problem. If agreed they vote on whether to approve the amended bill.',
  },
  {
    id: 'royal-assent',
    label: 'Royal Assent',
    sub: 'Becomes law',
    body: 'The bill receives Royal Assent and becomes an Act of the Northern Ireland Assembly. The Speaker usually announces this at the next Assembly sitting. The Act may come into force immediately, on a specified date or when a minister issues a commencement order.',
  },
  {
    id: 'accelerated-passage',
    label: 'Accelerated passage',
    body: 'An emergency procedure allowing a bill to pass all stages in as little as ten days. Committee Stage is skipped entirely. Requires cross-community support to proceed.',
  },
]

export default function LegislationGuidePage() {
  return (
    <div className="container">
      <header className={styles.pageHeader}>
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li><Link href="/assembly/bills">Legislation</Link></li>
            <li aria-current="page">How a bill becomes law</li>
          </ol>
        </nav>
        <span className={styles.pageHeaderEyebrow}>Legislation</span>
        <h1 className={styles.pageHeaderTitle}>
          <BookOpen className={styles.pageHeaderIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
          How a bill becomes law
        </h1>
        <p className={styles.lede}>A plain English guide to the stages a bill passes through in the Northern Ireland Assembly.</p>
      </header>

      <div className={styles.guide}>
        {STAGES.map((stage, i) => (
          <section key={stage.id} id={stage.id} className={styles.stage}>
            <div className={styles.stageTitle}>
              <span className={styles.stageNum} aria-hidden="true">{i + 1}</span>
              <span className={styles.stageLabel}>{stage.label}</span>
              {stage.sub && <span className={styles.stageSub}>{stage.sub}</span>}
            </div>
            <p>{stage.body}</p>
            {stage.note && (
              <div className={styles.stageNote}>
                <Info className={styles.stageNoteIcon} size={15} strokeWidth={1.75} aria-hidden="true" />
                <span>{stage.note}</span>
              </div>
            )}
          </section>
        ))}
      </div>

      <p className={styles.source}>
        Based on the <a href="https://www.niassembly.gov.uk/assembly-business/legislation/bills-explained/" target="_blank" rel="noopener noreferrer">NI Assembly&apos;s guide to legislation</a>.
      </p>
    </div>
  )
}
