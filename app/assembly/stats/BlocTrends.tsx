'use client'

import { CalendarRange, Trophy, Clock3, Percent, BarChart3, Info } from 'lucide-react'
import { useMandate } from '@/components/MandateContext'
import LineChart from './LineChart'
import ColumnChart from './ColumnChart'
import styles from './statsKit.module.css'

interface Row {
  month: string
  total_divisions: number
  comparable_divisions: number
  agreed_divisions: number
  agreement_pct: number | null
}

const monthLabel = (m: string) => new Date(m).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const tickFor = (m: string, i: number) => {
  const d = new Date(m)
  return d.getUTCMonth() === 0 || i === 0 ? String(d.getUTCFullYear()) : undefined
}

export default function BlocTrends({ data }: { data: Row[] }) {
  const { mandate } = useMandate()
  const peak = data.filter((r) => r.comparable_divisions >= 3 && r.agreement_pct !== null).sort((a, b) => (b.agreement_pct ?? 0) - (a.agreement_pct ?? 0))[0] ?? null
  const latest = data.length ? data[data.length - 1] : null
  const tone = (p: number | null) => (p === null ? undefined : p >= 60 ? 'var(--sw-success)' : p >= 30 ? 'var(--sw-warning)' : 'var(--sw-error)')

  const points = data.map((r, i) => ({
    key: r.month,
    label: monthLabel(r.month),
    value: r.agreement_pct,
    low: r.comparable_divisions < 3,
    detail: `${r.agreed_divisions} of ${r.comparable_divisions} divisions agreed`,
    tick: tickFor(r.month, i),
  }))
  const columns = data.map((r, i) => ({
    key: r.month,
    label: monthLabel(r.month),
    value: Number(r.total_divisions),
    inner: Number(r.agreed_divisions),
    tick: tickFor(r.month, i),
  }))

  return (
    <div className={styles.stack}>
      <ul className={`${styles.headline} ${styles.headline3}`} aria-label="Bloc agreement figures">
        <li className={styles.hItem}>
          <div className={styles.hHead}><span className={`${styles.iconTile} ${styles.tnBlue}`}><CalendarRange size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>Period</span></div>
          <span className={styles.hFigure}>{data.length}</span>
          <span className={styles.hSub}>months since {mandate.startLabel}</span>
        </li>
        <li className={styles.hItem}>
          <div className={styles.hHead}><span className={`${styles.iconTile} ${styles.tnGreen}`}><Trophy size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>Highest month</span></div>
          <span className={styles.hFigure} style={{ color: tone(peak?.agreement_pct ?? null) }}>{peak?.agreement_pct ?? '-'}%</span>
          <span className={styles.hSub}>{peak ? `${monthLabel(peak.month)}, ${peak.agreed_divisions} of ${peak.comparable_divisions} agreed` : 'No data'}</span>
        </li>
        <li className={styles.hItem}>
          <div className={styles.hHead}><span className={`${styles.iconTile} ${styles.tnAmber}`}><Clock3 size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>Latest month</span></div>
          <span className={styles.hFigure} style={{ color: tone(latest?.agreement_pct ?? null) }}>{latest?.agreement_pct ?? '-'}%</span>
          <span className={styles.hSub}>{latest ? `${monthLabel(latest.month)}, ${latest.agreed_divisions} of ${latest.comparable_divisions} agreed` : 'No data'}</span>
        </li>
      </ul>

      <section className={styles.tile} aria-labelledby="bloc-line-heading">
        <div className={styles.tileHead}>
          <span className={`${styles.iconTile} ${styles.tnBlue}`}><Percent size={22} strokeWidth={2} aria-hidden="true" /></span>
          <div className={styles.tileTitles}>
            <h3 className={styles.tileTitle} id="bloc-line-heading">How often both blocs voted the same way</h3>
            <p className={styles.tileSub}>Percentage of divisions each month. Smaller dots are months with fewer than 3 comparable divisions.</p>
          </div>
        </div>
        <LineChart data={points} summary={`Monthly percentage of divisions where unionist and nationalist blocs agreed since ${mandate.startLabel}.`} />
      </section>

      <section className={styles.tile} aria-labelledby="bloc-cols-heading">
        <div className={styles.tileHead}>
          <span className={`${styles.iconTile} ${styles.tnPurple}`}><BarChart3 size={22} strokeWidth={2} aria-hidden="true" /></span>
          <div className={styles.tileTitles}>
            <h3 className={styles.tileTitle} id="bloc-cols-heading">Divisions each month</h3>
            <p className={styles.tileSub}>The solid part of each column is the divisions where both blocs voted the same way.</p>
          </div>
        </div>
        <ColumnChart data={columns} unit="divisions" summary={`Total divisions per month since ${mandate.startLabel}, with those where both blocs agreed.`} />
        <ul className={styles.legend}>
          <li style={{ ['--k' as string]: 'color-mix(in srgb, var(--sw-accent-solid) 32%, transparent)' }}><i />Total divisions</li>
          <li style={{ ['--k' as string]: 'var(--sw-accent-solid)' }}><i />Both blocs voted the same way</li>
        </ul>
      </section>

      <div className={styles.note}>
        <Info size={18} strokeWidth={2} aria-hidden="true" />
        <p>Figures count divisions where more unionist MLAs voted Aye than No and more nationalist MLAs did the same, or both blocs had a majority for No. Divisions where a whole bloc cast no votes, such as a Speaker nomination Sinn Féin did not contest, are left out. Months with fewer than 3 comparable divisions are less reliable.</p>
      </div>
    </div>
  )
}
