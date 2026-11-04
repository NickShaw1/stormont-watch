import Link from 'next/link'
import { ArrowRight, CalendarCheck, MapPin } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import { abbreviateParty, formatConstituency, formatMemberName } from '@/lib/format'
import type { AttendanceGradeOrNa } from '@/lib/mlaRow'
import styles from './MlaRow.module.css'

export interface MlaRowPerson {
  id: string
  fullName: string
  constituency: string | null
  imgUrl: string | null
  party: string | null
  roles: string[]
  attendance: number | null
}

const GRADE_TEXT: Record<AttendanceGradeOrNa, string> = { good: 'at or above average', low: 'below average', poor: 'far below average', na: '' }

export default function MlaRow({ person, grade = 'na', basePath, surface, eyebrow, showAttendance = true, date }: { person: MlaRowPerson; grade?: AttendanceGradeOrNa; basePath: string; surface?: boolean; eyebrow?: string; showAttendance?: boolean; date?: string }) {
  const name = formatMemberName(person.fullName)
  return (
    <div className={[styles.row, surface ? styles.surface : '', eyebrow ? styles.withEyebrow : '', showAttendance ? '' : styles.noAtt, date ? styles.hasDate : ''].filter(Boolean).join(' ')}>
      <div className={styles.photo}>
        <MlaPhoto name={name} imgUrl={person.imgUrl ?? ''} size={128} decorative square personId={person.id} />
      </div>
      <div className={styles.main}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <Link
          href={`${basePath}/assembly/mlas/${person.id}`}
          className={styles.name}
          aria-label={`View profile for ${name}`}
        >
          {name}
        </Link>
        <span className={styles.constituency}>
          {date && <MapPin className={styles.metaIcon} size={14} strokeWidth={2.25} aria-hidden="true" />}
          {formatConstituency(person.constituency ?? '')}
        </span>
        {date && (
          <span className={styles.dateMeta}>
            <CalendarCheck className={styles.metaIcon} size={14} strokeWidth={2.25} aria-hidden="true" />
            {date}
          </span>
        )}
        <div className={styles.tags} title={person.roles.join(', ') || undefined}>
          {person.party && <span className="party-pill" data-party={abbreviateParty(person.party)}>{abbreviateParty(person.party)}</span>}
          {person.roles.map((r) => <span key={r} className={styles.rolePill}>{r}</span>)}
        </div>
      </div>
      {showAttendance && (
      <div className={styles.att} data-grade={grade}>
        <span className={styles.attLabel} aria-hidden="true">Att:</span>
        <span className={styles.attValue}>{grade === 'na' ? 'n/a' : `${person.attendance}%`}</span>
        <span className={styles.attTrack} aria-hidden="true">
          {grade !== 'na' && <span className={styles.attFill} style={{ width: `${Math.max(0, Math.min(100, person.attendance ?? 0))}%` }} />}
        </span>
        <span className="sr-only">Attendance{grade !== 'na' && `, ${GRADE_TEXT[grade]}`}</span>
      </div>
      )}
      <ArrowRight className={styles.arrow} size={18} strokeWidth={2} aria-hidden="true" />
    </div>
  )
}
