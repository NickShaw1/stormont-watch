'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { Landmark, Users, Gavel, ShieldCheck, Gauge, Wallet, MessageCircleQuestion, LayoutList } from 'lucide-react'
import { gradeAttendance } from '@/lib/attendance'
import SheetSelect from '@/app/assembly/mlas/[id]/SheetSelect'
import m from '@/app/assembly/mlas/[id]/mlaDetail.module.css'
import styles from './partyDetail.module.css'
import { PersonCard } from './PartyUi'

const EXEC_ORDER: Record<string, number> = {
  'First Minister': 0,
  'deputy First Minister': 1,
  'junior Minister': 2,
}

type Minister = {
  personId: string
  fullName: string
  imgUrl: string | null
  roleTitle: string | null
  department: string | null
}

type Chair = {
  personId: string
  fullName: string
  imgUrl: string | null
  committeeName: string
}

type Mla = {
  personId: string
  fullName: string
  imgUrl: string | null
  constituency: string | null
  assemblyRole?: string | null
  assemblyRoleEnd?: string | null
  attendancePct?: number | null
}

const TABS = ['members', 'expenses', 'stats', 'questions', 'chamber'] as const
type Tab = (typeof TABS)[number]

const SECTION_TILE: Record<Tab, { color: string; on?: string }> = {
  members: { color: 'var(--sw-accent-solid)' },
  expenses: { color: 'var(--sw-success-solid)' },
  stats: { color: 'var(--sw-accent-warm)', on: '#1a1d21' },
  questions: { color: '#8b5cf6' },
  chamber: { color: '#14b8a6', on: '#1a1d21' },
}

const TAB_META: Record<Tab, { label: string; icon: typeof Users }> = {
  members: { label: 'Members', icon: Users },
  expenses: { label: 'Expenses', icon: Wallet },
  stats: { label: 'Attendance', icon: Gauge },
  questions: { label: 'Questions', icon: MessageCircleQuestion },
  chamber: { label: 'Chamber', icon: Landmark },
}

const GRADE_TEXT = {
  good: 'at or above the average',
  low: 'below the average',
  poor: 'far below the average',
} as const

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface Props {
  mlas: Mla[]
  ministers: Minister[]
  chairs: Chair[]
  averageAttendance: number
  attendanceFloor: number
  hasQuestions: boolean
  statsContent: ReactNode
  expensesContent: ReactNode
  chamberContent: ReactNode
  questionsContent: ReactNode
}

export default function PartyDetailClient({ mlas, ministers, chairs, averageAttendance, attendanceFloor, hasQuestions, statsContent, expensesContent, chamberContent, questionsContent }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('members')
  const visibleTabs = TABS.filter((t) => t !== 'questions' || hasQuestions)

  const execMinisters = ministers
    .filter((x) => x.department === 'The Executive Office')
    .sort((a, b) => (EXEC_ORDER[a.roleTitle ?? ''] ?? 99) - (EXEC_ORDER[b.roleTitle ?? ''] ?? 99))
  const deptMinisters = ministers.filter((x) => x.department !== 'The Executive Office')

  const listed = new Set([...ministers.map((x) => x.personId), ...chairs.map((c) => c.personId)])
  const otherMlas = mlas.filter((x) => !listed.has(x.personId))
  const hasListed = listed.size > 0
  const mlaById = new Map(mlas.map((x) => [x.personId, x]))

  function attendanceOf(personId: string) {
    const mla = mlaById.get(personId)
    const presiding = mla?.assemblyRole === 'Speaker' && !mla?.assemblyRoleEnd
    const pct = mla?.attendancePct ?? null
    const grade = presiding || pct === null ? 'na' : gradeAttendance(pct, averageAttendance, attendanceFloor)
    return {
      asideLabel: grade,
      aside: (
        <>
          <span className={styles.attLabel} aria-hidden="true">Att:</span>
          <span className={styles.attValue}>{grade === 'na' ? 'n/a' : `${pct}%`}</span>
          <span className={styles.attTrack} aria-hidden="true">
            {grade !== 'na' && <span className={styles.attFill} style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }} />}
          </span>
          <span className="sr-only">Attendance{grade !== 'na' && `, ${GRADE_TEXT[grade]}`}</span>
        </>
      ),
    }
  }

  return (
    <div>
      <SheetSelect
        options={visibleTabs.map((t) => ({ key: t, label: TAB_META[t].label, icon: TAB_META[t].icon, ...SECTION_TILE[t] }))}
        value={activeTab}
        onPick={(k) => setActiveTab(k as Tab)}
        eyebrow="Show"
        title="Section"
        headIcon={LayoutList}
      />
      <div className={`${m.pillRow} ${m.tabs}`} role="group" aria-label="Party sections" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}>
        {visibleTabs.map((t) => {
          const Icon = TAB_META[t].icon
          return (
            <button key={t} type="button" aria-pressed={activeTab === t} className={m.pillBtn} onClick={() => setActiveTab(t)}>
              <Icon size={18} strokeWidth={2} aria-hidden="true" />
              {TAB_META[t].label}
            </button>
          )
        })}
      </div>

      {activeTab === 'members' && (
        <div className={m.panelFlat}>
          <div className={m.bento}>
            {execMinisters.length > 0 && (
              <section className={styles.group} aria-labelledby="exec-heading">
                <div className={m.tileHead}>
                  <span className={`${m.iconTile} ${m.tnBlue}`}><Landmark size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <h3 className={m.tileTitle} id="exec-heading">Executive Office</h3>
                </div>
                <p className={styles.sectionDesc}>The party&apos;s posts in the Executive Office.</p>
                <ul className={styles.rows}>
                  {execMinisters.map((x) => (
                    <PersonCard key={x.personId} personId={x.personId} fullName={x.fullName} imgUrl={x.imgUrl} constituency={null} role={x.roleTitle ? capitalise(x.roleTitle) : null} {...attendanceOf(x.personId)} />
                  ))}
                </ul>
              </section>
            )}

            {deptMinisters.length > 0 && (
              <section className={styles.group} aria-labelledby="ministers-heading">
                <div className={m.tileHead}>
                  <span className={`${m.iconTile} ${m.tnAmber}`}><Gavel size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <h3 className={m.tileTitle} id="ministers-heading">Ministers</h3>
                </div>
                <p className={styles.sectionDesc}>The party&apos;s departmental ministers, shown with their departments.</p>
                <ul className={styles.rows}>
                  {deptMinisters.map((x) => (
                    <PersonCard key={x.personId} personId={x.personId} fullName={x.fullName} imgUrl={x.imgUrl} constituency={null} role="Minister" title={x.department} {...attendanceOf(x.personId)} />
                  ))}
                </ul>
              </section>
            )}

            {chairs.length > 0 && (
              <section className={styles.group} aria-labelledby="chairs-heading">
                <div className={m.tileHead}>
                  <span className={`${m.iconTile} ${m.tnGreen}`}><ShieldCheck size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <h3 className={m.tileTitle} id="chairs-heading">Committee Chairs</h3>
                </div>
                <p className={styles.sectionDesc}>The party&apos;s committee chairs, shown with their committees.</p>
                <ul className={styles.rows}>
                  {chairs.map((c) => (
                    <PersonCard key={c.personId} personId={c.personId} fullName={c.fullName} imgUrl={c.imgUrl} constituency={null} role="Chair" title={c.committeeName} {...attendanceOf(c.personId)} />
                  ))}
                </ul>
              </section>
            )}

            {otherMlas.length > 0 && (
            <section className={styles.group} aria-labelledby="mlas-heading">
              <div className={m.tileHead}>
                <span className={`${m.iconTile} ${m.tnIndigo}`}><Users size={22} strokeWidth={2} aria-hidden="true" /></span>
                <h3 className={m.tileTitle} id="mlas-heading">{hasListed ? 'Other MLAs' : 'MLAs'}</h3>
              </div>
              <p className={styles.sectionDesc}>{hasListed ? "The party's other current MLAs" : "The party's current MLAs"}, with each member&apos;s division attendance.</p>
              <ul className={styles.rows}>
                {otherMlas.map((mla) => {
                  const role = mla.assemblyRole && !mla.assemblyRoleEnd ? mla.assemblyRole.replace(/Principal/g, 'Pr.') : null
                  return (
                    <PersonCard
                      key={mla.personId}
                      personId={mla.personId}
                      fullName={mla.fullName}
                      imgUrl={mla.imgUrl}
                      constituency={mla.constituency}
                      role={role}
                      {...attendanceOf(mla.personId)}
                    />
                  )
                })}
              </ul>
            </section>
            )}
          </div>
        </div>
      )}

      {activeTab !== 'members' && (
        <Fragment key={activeTab}>
          {activeTab === 'stats' ? statsContent : activeTab === 'expenses' ? expensesContent : activeTab === 'chamber' ? chamberContent : hasQuestions ? questionsContent : null}
        </Fragment>
      )}
    </div>
  )
}
