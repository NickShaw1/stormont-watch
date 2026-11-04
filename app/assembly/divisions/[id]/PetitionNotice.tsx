import Link from 'next/link'
import { ArrowRight, ShieldAlert } from 'lucide-react'
import { formatDate } from '@/lib/format'
import styles from './divisionDetail.module.css'

export interface PetitionNoticeData {
  tabledDate: string | null
  plenaryDate: string | null
  signatories: number | null
}

export default function PetitionNotice({ petition, target, href, crossCommunity }: { petition: PetitionNoticeData; target: string; href: string | null; crossCommunity: boolean }) {
  const tabled = petition.tabledDate ?? petition.plenaryDate
  const confirmed = petition.plenaryDate && petition.plenaryDate !== tabled ? `, confirmed in plenary on ${formatDate(petition.plenaryDate)}` : ''
  const by = petition.signatories ? ` by ${petition.signatories} ${petition.signatories === 1 ? 'MLA' : 'MLAs'}` : ''
  const sub = `${tabled ? `Tabled on ${formatDate(tabled)}` : 'Tabled'}${by}${confirmed}.${crossCommunity ? ' The vote was held as a cross-community vote.' : ''}`

  const body = (
    <>
      <span className={styles.pocIcon}><ShieldAlert size={30} strokeWidth={2} aria-hidden="true" /></span>
      <span className={styles.pocText}>
        <span className={styles.pocEyebrow}>Petition of Concern</span>
        <span className={styles.pocTitle}>A petition of concern was tabled against {target}</span>
        <span className={styles.pocSub}>{sub}</span>
      </span>
      {href && <span className={styles.pocCta}>See the petition<ArrowRight size={18} strokeWidth={2} aria-hidden="true" /></span>}
      {href && <ArrowRight className={styles.pocArrow} size={22} strokeWidth={2} aria-hidden="true" />}
      <ShieldAlert className={styles.pocMark} size={170} strokeWidth={1.5} aria-hidden="true" />
    </>
  )

  return href ? (
    <Link href={href} className={styles.poc}>{body}</Link>
  ) : (
    <div className={styles.poc} data-static="">{body}</div>
  )
}
