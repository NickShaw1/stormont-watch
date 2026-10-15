'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import styles from './home.module.css'

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

function initialOpen(days: ScheduleDay[]) {
  const pick = days.find((d) => d.isToday) ?? days.find((d) => !d.isPast)
  return new Set(pick ? [pick.date] : [])
}

export default function ScheduleAccordion({ days, title = 'Schedule' }: { days: ScheduleDay[]; title?: React.ReactNode }) {
  const uid = useId()
  const [open, setOpen] = useState<Set<string>>(() => initialOpen(days))
  const allOpen = open.size === days.length

  const toggle = (date: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })

  return (
    <>
      <div className={styles.agendaHeader}>
        <span className={styles.agendaHeaderTitle} role="heading" aria-level={3}>
          <CalendarDays className={styles.agendaHeaderIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
          {title}
        </span>
        <button
          type="button"
          className={`${styles.viewAllBtn} ${styles.schedToggle}`}
          onClick={() => setOpen(allOpen ? new Set() : new Set(days.map((d) => d.date)))}
        >
          <span className={styles.schedToggleStack}>
            <span className={allOpen ? styles.schedToggleHidden : undefined} aria-hidden={allOpen}>Expand all</span>
            <span className={allOpen ? undefined : styles.schedToggleHidden} aria-hidden={!allOpen}>Collapse all</span>
          </span>
        </button>
      </div>

      <div className={styles.schedRail}>
        {days.map((day) => {
          const isOpen = open.has(day.date)
          const id = `${uid}-${day.date}`
          const stateClass = day.isToday ? styles.diaryRowToday : day.isPast ? styles.schedPast : ''
          return (
            <div key={day.date} className={`${styles.schedItem} ${stateClass} ${isOpen ? styles.schedOpen : ''}`}>
              <span className={styles.schedTrack} aria-hidden="true">
                <span className={styles.schedNode} />
              </span>
              <div className={`${styles.agendaDayCard} ${styles.schedCard}`}>
                <h4 className={styles.schedHeading}>
                  <button
                    type="button"
                    className={styles.schedHead}
                    id={`${id}-head`}
                    aria-expanded={isOpen}
                    aria-controls={`${id}-panel`}
                    onClick={() => toggle(day.date)}
                  >
                    <span className={styles.diaryDate}>
                      <span className={styles.diaryDateWeekday}>{day.weekday}</span>
                      <span className={styles.diaryDateNum}>{day.dayNum}</span>
                      <span className={styles.diaryDateMonth}>{day.month}</span>
                    </span>
                    <span className={styles.schedHeadText}>
                      <span className={styles.schedHeadTitle}>
                        {summaryParts(day).map((part) => (
                          <span key={part.label} className={styles.schedHeadPart}>
                            {part.label}
                            {part.count !== null && <span className={styles.schedHeadCount}>{part.count}</span>}
                          </span>
                        ))}
                      </span>
                      {(day.isToday || day.sitting) && (
                        <span className={styles.schedHeadMeta}>
                          {day.isToday && <span className={styles.schedToday}>Today</span>}
                          {day.sitting && <span className={styles.schedHeadSub}>{day.sitting}</span>}
                        </span>
                      )}
                    </span>
                    <ChevronDown className={styles.schedChev} size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </h4>

                <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-head`} className={styles.schedPanel}>
                  <div className={styles.schedPanelInner}>
                    {day.sitting !== null && (
                      <div className={styles.agendaSectionRow}>
                        <div className={styles.agendaSectionLabel}>Assembly business</div>
                        <div className={styles.agendaSittingLabel}>{day.sitting}</div>
                      </div>
                    )}

                    {day.sitting !== null && day.entries.length === 0 && (
                      <p className={styles.agendaEmpty}>Agenda details not available</p>
                    )}

                    {day.entries.length > 0 && (
                      <div className={styles.agendaDay}>
                        {day.entries.map((entry) => {
                          const content = (
                            <>
                              <span className={styles.agendaTitle}>{entry.title}</span>
                              <span className={entry.procedural ? styles.agendaTypeProcedural : styles.agendaType}>{entry.type}</span>
                            </>
                          )
                          return entry.href ? (
                            <Link key={entry.key} href={entry.href} className={`${styles.agendaItem} ${styles.agendaItemLink}`}>{content}</Link>
                          ) : (
                            <div key={entry.key} className={styles.agendaItem}>{content}</div>
                          )
                        })}
                      </div>
                    )}

                    {day.meetings.length > 0 && (
                      <>
                        <div className={styles.agendaSectionRow}>
                          <div className={styles.agendaSectionLabel}>Committee meetings</div>
                        </div>
                        <div className={styles.agendaDay}>
                          {day.meetings.map((meeting, i) => (
                            <div key={i} className={styles.agendaItem}>
                              <span className={styles.agendaTitle}>{meeting.name}</span>
                              {meeting.time && <span className={styles.agendaTime}>{meeting.time}</span>}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
