import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty } from '@/lib/format'
import styles from './statsKit.module.css'

export interface ShellPerson {
  href: string
  personId: string
  fullName: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  kind: 'top' | 'low'
  pct: number
  value: string
  context: string
}

export interface ShellStat {
  tone: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>
  label: string
  figure?: React.ReactNode
  sub?: React.ReactNode
  person?: ShellPerson
}

export const rankTones = {
  green: styles.tnGreen,
  blue: styles.tnBlue,
  amber: styles.tnAmber,
  purple: styles.tnPurple,
  pink: styles.tnPink,
  teal: styles.tnTeal,
  coral: styles.tnCoral,
  indigo: styles.tnIndigo,
  grey: styles.tnGrey,
}

function Standout({ s, p }: { s: ShellStat; p: ShellPerson }) {
  return (
    <li className={`${styles.hItem} ${styles.voterTile}`}>
      <Link href={p.href} className={styles.voterLink}>
        <span className={styles.hHead}><span className={`${styles.iconTile} ${s.tone}`}><s.icon size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>{s.label}</span></span>
        <span className={styles.voterMain}>
          <span className={styles.voterPhoto}><MlaPhoto name={p.fullName} imgUrl={p.imgUrl ?? ''} size={176} decorative square personId={p.personId} /></span>
          <span className={styles.voterInfo}>
            <span className={styles.voterName}>{formatMemberName(p.fullName)}</span>
            {p.constituency && <span className={styles.voterSub}>{p.constituency}</span>}
            {p.party && <span className="party-pill" data-party={abbreviateParty(p.party)}><PartyName party={p.party} /></span>}
          </span>
        </span>
        <span className={styles.voterMeter}>
          <span className={styles.voterBar} aria-hidden="true"><span data-kind={p.kind} style={{ width: `${Math.max(2, Math.min(100, p.pct))}%` }} /></span>
          <span className={styles.voterFoot}><b>{p.value}</b><span>{p.context}</span></span>
        </span>
        <ArrowRight className={styles.voterArrow} size={22} strokeWidth={2} aria-hidden="true" />
      </Link>
    </li>
  )
}

export default function RankingShell({ title, sub, stats, children }: { title: string; sub: React.ReactNode; stats: ShellStat[]; children: React.ReactNode }) {
  const hasPeople = stats.filter((s) => s.person).length >= 2
  return (
    <div className={styles.page}>
      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="ranking-title">
        <div className="container">
          <header className={styles.head}>
            <span className={styles.eyebrow}>Rankings</span>
            <h1 className={styles.h1} id="ranking-title">{title}</h1>
            <p className={styles.headSub}>{sub}</p>
          </header>
          {hasPeople && (
            <ul className={styles.headStats} aria-label="Totals">
              {stats.filter((x) => !x.person).map((x) => (
                <li key={x.label} className={styles.headStat}>
                  <span className={`${styles.iconTile} ${x.tone}`}><x.icon size={18} strokeWidth={2} aria-hidden="true" /></span>
                  <b className={styles.headStatFig}>{x.figure}</b>
                  <span className={styles.headStatLabel}>{x.label}{x.sub ? `, ${typeof x.sub === 'string' ? x.sub : ''}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
          {stats.length > 0 && (
            <ul className={`${styles.headline} ${styles.headline3} ${hasPeople ? styles.headlineVoters : styles.headlineRank}`} aria-label="Headline figures">
              {stats.filter((x) => !hasPeople || x.person).map((s) =>
                s.person && hasPeople ? (
                  <Standout key={s.label} s={s} p={s.person!} />
                ) : (
                  <li key={s.label} className={styles.hItem}>
                    <div className={styles.hHead}><span className={`${styles.iconTile} ${s.tone}`}><s.icon size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>{s.label}</span></div>
                    <span className={styles.hFigure}>{s.figure ?? s.person?.value}</span>
                    <span className={styles.hSub}>{s.sub ?? (s.person ? formatMemberName(s.person.fullName) : null)}</span>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      </section>
      <section className={`${styles.band} ${styles.bandTint}`} aria-label="Ranked list">
        <div className="container">
          <div className={styles.tile}>{children}</div>
        </div>
      </section>
    </div>
  )
}
