import type { Metadata } from 'next'
import { ArrowUpRight, Crown, FilePenLine, FileText, Gavel, Info, ListChecks, MessagesSquare, RotateCcw, Scale, ShieldCheck, Users, Vote, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import styles from './legislation-guide.module.css'

export const metadata: Metadata = {
  title: 'How a Bill becomes law',
  description: 'A plain English guide to the legislative stages a bill passes through in the Northern Ireland Assembly.',
  openGraph: {
    title: 'How a Bill becomes law - Stormont Watch',
    description: 'A plain English guide to the legislative stages a bill passes through in the Northern Ireland Assembly.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch: NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/legislation-guide' },
}

type Kind = 'main' | 'optional' | 'final'

type Stage = {
  id: string
  label: string
  sub?: string
  body: string
  note?: string
  icon: LucideIcon
  kind: Kind
  unnumbered?: string
}

const STAGES: Stage[] = [
  {
    id: 'pre-introduction-scrutiny',
    label: 'Pre-introduction scrutiny',
    sub: 'Speaker’s check',
    body: 'The minister or member in charge submits the bill to the Speaker. If the Speaker believes the proposals are within the Assembly’s powers, the bill can be introduced and debated by MLAs.',
    icon: Gavel,
    kind: 'main',
    unnumbered: 'Behind the scenes',
  },
  {
    id: 'first-stage',
    label: 'First Stage',
    sub: 'Introduction',
    body: 'The bill is formally introduced to the Assembly. Its long title is read out but there is no debate or vote. This stage is a formality that allows the bill to be printed and published. The bill is usually available online on the day it is introduced, along with explanatory notes.',
    icon: FileText,
    kind: 'main',
  },
  {
    id: 'second-stage',
    label: 'Second Stage',
    sub: 'General debate',
    body: 'All MLAs debate the general principles of the bill for the first time. The minister or member in charge opens the debate by outlining the bill’s objectives, other MLAs give their opinions and the minister or member in charge speaks last. At the end, MLAs vote on whether the bill can proceed. The Assembly may reject the bill if it disagrees with its general principles. If approved, the bill is referred to the relevant committee.',
    icon: MessagesSquare,
    kind: 'main',
  },
  {
    id: 'committee-stage',
    label: 'Committee Stage',
    sub: 'Detailed scrutiny',
    body: 'The committee normally takes evidence from interested bodies, including the government department, and from individuals. Members then scrutinise each clause and schedule of the bill and discuss possible amendments. Committees have no power to amend a bill but they prepare a report for the Assembly, including any proposed amendments. Bills using accelerated passage skip this stage entirely.',
    icon: Users,
    kind: 'main',
  },
  {
    id: 'consideration-stage',
    label: 'Consideration Stage',
    sub: 'Voting on amendments',
    body: 'The whole Assembly debates the bill and MLAs vote on each clause, schedule and proposed amendment. Amendments are published before the debate, and the amendments the Speaker selects are listed on a Marshalled List. Related amendments are usually debated together, but each is voted on in strict numerical order. The bill’s long title, and any amendments to it, are always voted on last.',
    note: 'Not every clause or amendment results in a recorded division. Where there is broad agreement, the presiding officer may ask "Is the Assembly agreed?" and items pass without a formal vote being called.',
    icon: ListChecks,
    kind: 'main',
  },
  {
    id: 'further-consideration-stage',
    label: 'Further Consideration Stage',
    sub: 'Final amendments',
    body: 'A second opportunity to amend the bill. Only new amendments are debated and clauses and schedules are not revisited. If no amendments are proposed this stage has no debate. The bill is reprinted if it is amended.',
    icon: FilePenLine,
    kind: 'main',
  },
  {
    id: 'final-scrutiny',
    label: 'Final Scrutiny',
    sub: 'Speaker’s check',
    body: 'The bill is referred to the Speaker to consider under section 10(c) of the Northern Ireland Act 1998. No date can be set for Final Stage until the Speaker confirms the bill may properly proceed or, if the Speaker refers it to the Secretary of State, consent has been given for it to proceed.',
    icon: ShieldCheck,
    kind: 'main',
    unnumbered: 'Behind the scenes',
  },
  {
    id: 'final-stage',
    label: 'Final Stage',
    sub: 'Passing the bill',
    body: 'MLAs debate and vote on whether to pass the bill as a whole. No amendments are debated at this stage. After Final Stage, further checks must be carried out before the bill can receive Royal Assent.',
    icon: Vote,
    kind: 'main',
  },
  {
    id: 'attorney-general-review',
    label: 'Attorney General review',
    body: 'Any bill passed by the Assembly is referred to the Attorney General for Northern Ireland and the Advocate General. They decide whether to refer to the Supreme Court the question of whether any provision of the bill is within the Assembly’s legal powers. Normally, once they confirm they do not intend to refer the bill, the Speaker writes to the Secretary of State to ask them to seek Royal Assent. If the Supreme Court finds that a provision is outside the Assembly’s powers, the bill returns to the Assembly for Reconsideration Stage.',
    icon: Scale,
    kind: 'main',
    unnumbered: 'Behind the scenes',
  },
  {
    id: 'reconsideration-stage',
    label: 'Reconsideration Stage',
    sub: 'Exceptional circumstances only',
    body: 'This only happens if the Supreme Court decides that a provision of the bill is outside the Assembly’s powers. MLAs consider only the amendments proposed to be made to the bill. If amendments are agreed, a vote is taken on whether to approve the bill as amended.',
    icon: RotateCcw,
    kind: 'optional',
    unnumbered: 'Only if needed',
  },
  {
    id: 'royal-assent',
    label: 'Royal Assent',
    sub: 'Becomes law',
    body: 'Following all its stages in the Assembly, a bill must receive Royal Assent before it can become an Act of the Northern Ireland Assembly. This is a formal process in which the King agrees to make the bill into an Act. The Speaker usually announces it at the next plenary sitting. The Act may come into effect at once, after a specified time or after a commencement order by a minister. If there is no commencement order, it comes into force from midnight at the start of the day of Royal Assent.',
    icon: Crown,
    kind: 'final',
  },
]

const SHORTCUT = {
  id: 'accelerated-passage',
  label: 'Accelerated passage',
  body: 'Under this procedure a bill can pass all stages in as little as ten days, but in no less time. Committee Stage is skipped entirely. It requires cross-community support.',
}

const KIND_CLASS: Record<Kind, string> = {
  main: styles.kindMain,
  optional: styles.kindOptional,
  final: styles.kindFinal,
}

export default function LegislationGuidePage() {
  let step = 0
  const numbered = STAGES.map((stage) => ({ stage, n: stage.unnumbered ? null : ++step }))

  return (
    <div className={styles.page}>
      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="guide-title">
        <div className="container">
          <header className={styles.head}>
            <div className={styles.headText}>
              <span className={styles.eyebrow}>Legislation</span>
              <h1 className={styles.h1} id="guide-title">How a bill becomes law</h1>
              <p className={styles.headSub}>A plain English guide to the stages a bill passes through in the Northern Ireland Assembly. Stages 1 to 7 match the numbers on each bill&apos;s progress bar.</p>
            </div>
          </header>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandTint}`} aria-labelledby="route-title">
        <div className="container">
          <h2 className="sr-only" id="route-title">The stages</h2>
          <ol className={styles.rail}>
            {numbered.map(({ stage, n }) => {
              const Icon = stage.icon
              return (
                <li key={stage.id} className={`${styles.item} ${KIND_CLASS[stage.kind]}`}>
                  <span className={styles.track} aria-hidden="true"><span className={styles.node} /></span>
                  <article className={styles.card} id={stage.id} aria-labelledby={`${stage.id}-title`}>
                    <div className={styles.cardHead}>
                      <span className={styles.iconTile}><Icon size={22} strokeWidth={2} aria-hidden="true" /></span>
                      <div className={styles.cardTitleWrap}>
                        <span className={styles.stepLabel}>{n === null ? stage.unnumbered : `Stage ${n}`}</span>
                        <h3 className={styles.cardTitle} id={`${stage.id}-title`}>{stage.label}</h3>
                      </div>
                      {stage.sub && <span className={styles.subPill}>{stage.sub}</span>}
                    </div>
                    <p className={styles.cardBody}>{stage.body}</p>
                    {stage.note && (
                      <div className={styles.note}>
                        <Info className={styles.noteIcon} size={18} strokeWidth={2} aria-hidden="true" />
                        <span>{stage.note}</span>
                      </div>
                    )}
                    {stage.id === 'committee-stage' && (
                      <div className={`${styles.bypass} ${styles.kindShortcut}`} id={SHORTCUT.id}>
                        <span className={styles.bypassIcon}><Zap size={18} strokeWidth={2} aria-hidden="true" /></span>
                        <div className={styles.bypassText}>
                          <h4 className={styles.bypassTitle}>{SHORTCUT.label}</h4>
                          <p>{SHORTCUT.body}</p>
                        </div>
                      </div>
                    )}
                  </article>
                </li>
              )
            })}
          </ol>

          <p className={styles.source}>
            Based on the{' '}
            <a href="https://www.niassembly.gov.uk/assembly-business/legislation/bills-explained/" target="_blank" rel="noopener noreferrer">
              NI Assembly&apos;s guide to legislation
              <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>.
          </p>
        </div>
      </section>
    </div>
  )
}
