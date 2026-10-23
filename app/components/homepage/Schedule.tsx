'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import { CalendarDays, ChevronDown, Landmark, Users } from 'lucide-react'
import s from './schedule.module.css'

export type ScheduleEntry = {
  key: string
  title: string
  type: string
  href: string | null
  procedural: boolean
}

export type ScheduleMeeting = {
  name: string
  time: string | null
}

export type ScheduleDay = {
  date: string
  weekday: string
  dayNum: number
  month: string
  isToday: boolean
  isPast: boolean
  sitting: string | null
  entries: ScheduleEntry[]
  meetings: ScheduleMeeting[]
}

function summaryParts(day: ScheduleDay) {
  const parts: { label: string; count: number | null }[] = []
  if (day.sitting) {
    parts.push({ label: 'Assembly business', count: day.entries.length > 0 ? day.entries.length : null })
  }
  if (day.meetings.length > 0) {
    parts.push({ label: 'Committee meetings', count: day.meetings.length })
  }
  return parts
}

export default function Schedule({ days }: { days: ScheduleDay[] }) {
  const uid = useId()
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const allOpen = open.size === days.length

  const toggle = (date: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })

  return (
    <div className={s.schedule}>
      <div className={s.header}>
        <h3 className={s.title}>
          <span className={s.titleIcon}><CalendarDays size={20} strokeWidth={2} aria-hidden="true" /></span>
          <span className={s.titleFull}>Assembly schedule</span>
          <span className={s.titleShort}>Schedule</span>
        </h3>
        <button
          type="button"
          className={s.toggleAll}
          onClick={() => setOpen(allOpen ? new Set() : new Set(days.map((d) => d.date)))}
        >
          <span className={s.toggleStack}>
            <span className={allOpen ? s.hidden : undefined} aria-hidden={allOpen}>Expand all</span>
            <span className={allOpen ? undefined : s.hidden} aria-hidden={!allOpen}>Collapse all</span>
          </span>
        </button>
      </div>

      <div className={s.rail}>
        {days.map((day) => {
          const isOpen = open.has(day.date)
          const id = `${uid}-${day.date}`
          const parts = summaryParts(day)
          const state = day.isToday ? s.today : day.isPast ? s.past : ''
          return (
            <div key={day.date} className={`${s.item} ${state} ${isOpen ? s.open : ''}`}>
              <span className={s.track} aria-hidden="true">
                <span className={s.node} />
              </span>
              <div className={s.card}>
                <h4 className={s.dayHeading}>
                  <button
                    type="button"
                    className={s.head}
                    id={`${id}-head`}
                    aria-expanded={isOpen}
                    aria-controls={`${id}-panel`}
                    onClick={() => toggle(day.date)}
                  >
                    <span className={s.date}>
                      <span className={s.dateWeekday}>{day.weekday}</span>
                      <span className={s.dateNum}>{day.dayNum}</span>
                      <span className={s.dateMonth}>{day.month}</span>
                    </span>
                    <span className={s.headText}>
                      <span className={`${s.headTitle} ${parts.length > 1 ? s.headTitleMulti : ''}`}>
                        {parts.map((part) => {
                          const committee = part.label === 'Committee meetings'
                          return (
                            <span key={part.label} className={`${s.pill} ${committee ? s.pillGreen : s.pillBlue}`}>
                              <span className={s.pillIcon}>
                                {committee
                                  ? <Users size={14} strokeWidth={2.25} aria-hidden="true" />
                                  : <Landmark size={14} strokeWidth={2.25} aria-hidden="true" />}
                              </span>
                              <span className={s.pillLabel}>{part.label}</span>
                              <span className={s.pillShort} aria-hidden="true">{committee ? 'Committees' : 'Assembly'}</span>
                              {part.count !== null && <span className={s.pillCount}>{part.count}</span>}
                            </span>
                          )
                        })}
                      </span>
                      {(day.isToday || day.sitting) && (
                        <span className={s.headMeta}>
                          {day.isToday && <span className={s.todayTag}>Today</span>}
                          {day.sitting && <span className={s.headSub}><span className={s.sitLabel}>{day.sitting.split(' · ')[0]}{day.sitting.includes(' · ') ? ' · ' : ''}</span>{day.sitting.split(' · ')[1] ?? ''}</span>}
                        </span>
                      )}
                    </span>
                    <span className={s.chev}>
                      <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
                    </span>
                  </button>
                </h4>

                <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-head`} className={s.panel}>
                  <div className={s.panelInner}>
                    <div className={s.body}>
                      {day.sitting !== null && (
                        <div className={s.group}>
                          <div className={s.groupHead}>
                            <span className={s.groupIcon}><Landmark size={16} strokeWidth={2} aria-hidden="true" /></span>
                            Assembly business
                          </div>
                          {day.entries.length === 0 ? (
                            <p className={s.empty}>Agenda details not available</p>
                          ) : (
                            <div className={s.list}>
                              {day.entries.map((entry) => {
                                const content = (
                                  <>
                                    <span className={s.entryTitle}>{entry.title}</span>
                                    <span className={entry.procedural ? s.tagMuted : s.tag}>{entry.type}</span>
                                  </>
                                )
                                return entry.href ? (
                                  <Link key={entry.key} href={entry.href} title={entry.title} className={`${s.entry} ${s.entryLink}`}>{content}</Link>
                                ) : (
                                  <div key={entry.key} title={entry.title} className={s.entry}>{content}</div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {day.sitting === null && day.entries.length > 0 && (
                        <div className={s.group}>
                          <div className={s.list}>
                            {day.entries.map((entry) => {
                              const content = (
                                <>
                                  <span className={s.entryTitle}>{entry.title}</span>
                                  <span className={entry.procedural ? s.tagMuted : s.tag}>{entry.type}</span>
                                </>
                              )
                              return entry.href ? (
                                <Link key={entry.key} href={entry.href} title={entry.title} className={`${s.entry} ${s.entryLink}`}>{content}</Link>
                              ) : (
                                <div key={entry.key} title={entry.title} className={s.entry}>{content}</div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {day.meetings.length > 0 && (
                        <div className={s.group}>
                          <div className={s.groupHead}>
                            <span className={s.groupIcon}><Users size={16} strokeWidth={2} aria-hidden="true" /></span>
                            Committee meetings
                          </div>
                          <div className={s.list}>
                            {day.meetings.map((meeting, i) => (
                              <div key={i} title={meeting.name} className={s.entry}>
                                <span className={s.entryTitle}>{meeting.name}</span>
                                {meeting.time && <span className={s.time}>{meeting.time}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
