import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import styles from './billDetail.module.css'

export function OutcomePill({ passed }: { passed: boolean }) {
  return (
    <span className={styles.pill} data-tone={passed ? 'law' : 'failed'}>
      {passed ? <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" /> : <XCircle size={14} strokeWidth={2} aria-hidden="true" />}
      {passed ? 'Passed' : 'Failed'}
    </span>
  )
}

export interface VoteCardData {
  divisionId: string
  title: string
  passed: boolean | null
  ayes: number | null
  noes: number | null
}

export function VoteCard({ basePath, vote, footer }: { basePath: string; vote: VoteCardData; footer?: React.ReactNode }) {
  const { ayes, noes } = vote
  return (
    <Link
      href={`${basePath}/assembly/divisions/${vote.divisionId}`}
      title={vote.title || undefined}
      className={`${styles.entry} ${styles.entryLink} ${styles.voteRow}`}
    >
      <span className={styles.voteTop}>
        <span className={styles.entryTitle}>{vote.title}</span>
        {vote.passed !== null && <OutcomePill passed={vote.passed} />}
      </span>
      {ayes !== null && noes !== null && ayes + noes > 0 && (
        <span className={styles.voteBar}>
          <span className={styles.voteSplit} aria-hidden="true">
            {ayes > 0 && <span className={styles.voteAye} style={{ flexGrow: ayes }} />}
            {noes > 0 && <span className={styles.voteNo} style={{ flexGrow: noes }} />}
          </span>
          <span className={styles.voteCounts}>
            <span>Aye <b>{ayes}</b></span>
            <span>No <b>{noes}</b></span>
          </span>
        </span>
      )}
      {footer}
    </Link>
  )
}
