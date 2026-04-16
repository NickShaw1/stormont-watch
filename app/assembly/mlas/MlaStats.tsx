import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, partyBorderColor } from '@/lib/format'
import styles from './mlaStats.module.css'



type MlaRow = {
  personId: string
  fullName: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  attendancePct: number
  ayes: number
  noes: number
}

interface StatCardProps {
  title: string
  rows: MlaRow[]
  valueKey: keyof Pick<MlaRow, 'attendancePct' | 'ayes' | 'noes'>
  valueSuffix?: string
}

function StatCard({ title, rows, valueKey, valueSuffix = '' }: StatCardProps) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <ol className={styles.list}>
        {rows.map((m, i) => (
          <li key={m.personId} className={styles.row}>
            <span className={styles.rank}>{i + 1}</span>
            <MlaPhoto
              name={m.fullName}
              imgUrl={m.imgUrl ?? ''}
              size={40}
              decorative
            />
            <div className={styles.info}>
              <Link href={`/assembly/mlas/${m.personId}`} className={styles.name}>
                {formatMemberName(m.fullName)}
              </Link>
              {m.party && (
                <span
                  className={styles.partyPill}
                  style={{ '--party-color': partyBorderColor(m.party) } as React.CSSProperties}
                >
                  <PartyName party={m.party} />
                </span>
              )}
            </div>
            <span className={styles.value}>{m[valueKey]}{valueSuffix}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

interface Props {
  data: MlaRow[]
}

export default function MlaStats({ data }: Props) {
  const byAttendanceDesc = [...data].sort((a, b) => b.attendancePct - a.attendancePct)
  const byAttendanceAsc = [...data].sort((a, b) => a.attendancePct - b.attendancePct)
  const byAyes = [...data].sort((a, b) => b.ayes - a.ayes)
  const byNoes = [...data].sort((a, b) => b.noes - a.noes)

  return (
    <div className={styles.grid}>
      <StatCard title="Highest attendance" rows={byAttendanceDesc.slice(0, 5)} valueKey="attendancePct" valueSuffix="%" />
      <StatCard title="Lowest attendance" rows={byAttendanceAsc.slice(0, 5)} valueKey="attendancePct" valueSuffix="%" />
      <StatCard title="Most Ayes cast" rows={byAyes.slice(0, 5)} valueKey="ayes" />
      <StatCard title="Most Noes cast" rows={byNoes.slice(0, 5)} valueKey="noes" />
    </div>
  )
}
