import { Users } from 'lucide-react'
import styles from './divisionDetail.module.css'

interface Tally {
  ayes: number
  noes: number
}

interface Props {
  passed: boolean | null
  overall: Tally
  unionist: Tally
  nationalist: Tally
}

const share = ({ ayes, noes }: Tally) => (ayes + noes > 0 ? ayes / (ayes + noes) : 0)
const pct = (t: Tally) => `${Math.round(share(t) * 100)}%`

export default function CrossCommunityNotice({ passed, overall, unionist, nationalist }: Props) {
  const parallel = share(overall) > 0.5 && share(unionist) > 0.5 && share(nationalist) > 0.5
  const weighted = share(overall) >= 0.6 && share(unionist) >= 0.4 && share(nationalist) >= 0.4
  const supported = parallel || weighted
  const majority = overall.ayes > overall.noes

  const title =
    passed === null
      ? 'This was a cross-community vote'
      : supported && passed
        ? 'Passed with cross-community support'
        : !supported && majority
          ? 'A majority voted aye, but cross-community support was not met'
          : 'Did not win a majority'

  const stats = [
    { label: 'Overall', t: overall },
    { label: 'Unionist', t: unionist },
    { label: 'Nationalist', t: nationalist },
  ]

  return (
    <div className={styles.xc}>
      <span className={styles.xcIcon}><Users size={30} strokeWidth={2} aria-hidden="true" /></span>
      <span className={styles.xcText}>
        <span className={styles.xcEyebrow}>Cross-community vote</span>
        <span className={styles.xcTitle}>{title}</span>
        <span className={styles.xcSub}>
          Passing needs either a majority of the unionist and nationalist MLAs voting as well as a majority overall, or 60% overall with at least 40% of each.
        </span>
        <span className={styles.xcStats}>
          {stats.map(({ label, t }) => (
            <span key={label} className={styles.xcStat}>
              <span className={styles.xcStatLabel}>{label}</span>
              <span className={styles.xcStatNum}>{pct(t)}</span>
              <span className={styles.xcStatOf}>{t.ayes} of {t.ayes + t.noes} aye</span>
            </span>
          ))}
        </span>
      </span>
      <Users className={styles.xcMark} size={170} strokeWidth={1.5} aria-hidden="true" />
    </div>
  )
}
