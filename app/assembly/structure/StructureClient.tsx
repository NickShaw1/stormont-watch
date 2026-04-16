'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import { formatMemberName, partyBorderColor, abbreviateParty } from '@/lib/format'
import PartyName from '@/components/PartyName'
import { departmentDescriptions, committeeDescriptions } from '@/content/structure-descriptions'
import styles from './structure.module.css'

type Minister = {
  personId: string
  fullName: string
  party: string | null
  imgUrl: string | null
  roleTitle: string | null
  department: string | null
}

type Chair = {
  personId: string
  fullName: string
  party: string | null
  imgUrl: string | null
  committeeName: string
  assemblyRole: string | null
}

interface Props {
  fm: Minister | undefined
  dfm: Minister | undefined
  juniorMinisters: Minister[]
  departments: Minister[]
  chairs: Chair[]
  officialLinks: Record<string, string>
}

type Tab = 'all' | 'executive' | 'departments' | 'committees'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'executive',   label: 'Executive' },
  { key: 'departments', label: 'Departments' },
  { key: 'committees',  label: 'Committees' },
]

export default function StructureClient({ fm, dfm, juniorMinisters, departments, chairs, officialLinks }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('executive')

  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    all: null, executive: null, departments: null, committees: null,
  })

  const handleTabChange = (tab: Tab) => setActiveTab(tab)

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = (index + 1) % TABS.length
      const nextKey = TABS[next].key
      handleTabChange(nextKey)
      tabRefs.current[nextKey]?.focus()
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = (index - 1 + TABS.length) % TABS.length
      const prevKey = TABS[prev].key
      handleTabChange(prevKey)
      tabRefs.current[prevKey]?.focus()
    }
  }

  const showExecutive   = activeTab === 'all' || activeTab === 'executive'
  const showDepartments = activeTab === 'all' || activeTab === 'departments'
  const showCommittees  = activeTab === 'all' || activeTab === 'committees'

  function sectionClass(show: boolean): string {
    return show ? styles.section : `${styles.section} ${styles.sectionHidden}`
  }

  return (
    <>
      {/* Tab bar — mobile only, CSS hides on desktop */}
      <div className={styles.tabList} role="tablist" aria-label="Structure sections">
        {TABS.map((t, i) => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            role="tab"
            aria-selected={activeTab === t.key}
            aria-controls={`panel-${t.key}`}
            tabIndex={activeTab === t.key ? 0 : -1}
            ref={(el) => { tabRefs.current[t.key] = el }}
            className={`${styles.tab}${activeTab === t.key ? ` ${styles.tabActive}` : ''}${t.key === 'all' ? ` ${styles.tabHideMobile}` : ''}`}
            onClick={() => handleTabChange(t.key)}
            onKeyDown={(e) => handleKeyDown(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <hr className={`section-rule ${styles.sectionSeparator}`} />

      {/* Executive */}
      <section
        id="panel-executive"
        role="tabpanel"
        aria-labelledby="tab-executive"
        aria-label="The Executive"
        className={sectionClass(showExecutive)}
      >
        <div className={styles.sectionHeader}>
          <h2 id="executive-heading" className={styles.sectionHeading}>The Executive</h2>
          <p className={styles.sectionBlurb}>The <a href="https://www.northernireland.gov.uk/" target="_blank" rel="noopener noreferrer">Northern Ireland Executive</a> is the devolved government established under the <a href="https://en.wikipedia.org/wiki/Good_Friday_Agreement" target="_blank" rel="noopener noreferrer">Good Friday Agreement</a>. It operates on a mandatory power-sharing basis, with the First Minister and Deputy First Minister drawn from the largest unionist and nationalist parties respectively.</p>
        </div>
        <div className={styles.executiveGrid}>
          {[fm, dfm].filter(Boolean).map((role) => {
            if (!role) return null
            return (
              <div
                key={role.personId}
                className={styles.executiveCard}
                style={{ '--party-color': partyBorderColor(role.party) } as React.CSSProperties} data-party={abbreviateParty(role.party)}
              >
                <div className={styles.executiveCardInner}>
                  <MlaPhoto name={role.fullName} imgUrl={role.imgUrl ?? ''} size={88} decorative />
                  <div className={styles.executiveInfo}>
                    <span className={styles.roleTitle}>{role.roleTitle}</span>
                    <Link href={`/assembly/mlas/${role.personId}`} className={styles.executiveName}>
                      {formatMemberName(role.fullName)}
                    </Link>
                    {role.party && (
                      <span
                        className={styles.partyPill}
                        style={{ '--party-color': partyBorderColor(role.party) } as React.CSSProperties} data-party={abbreviateParty(role.party)}
                      >
                        <PartyName party={role.party} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {[...juniorMinisters].reverse().map((jm) => (
            <div key={jm.personId} className={styles.juniorCard}>
              <div className={styles.executiveCardInner}>
                <MlaPhoto name={jm.fullName} imgUrl={jm.imgUrl ?? ''} size={64} decorative />
                <div className={styles.executiveInfo}>
                  <span className={styles.roleTitle}>Junior Minister</span>
                  <Link href={`/assembly/mlas/${jm.personId}`} className={styles.personName}>
                    {formatMemberName(jm.fullName)}
                  </Link>
                  {jm.party && (
                    <span
                      className={styles.partyPill}
                      style={{ '--party-color': partyBorderColor(jm.party) } as React.CSSProperties} data-party={abbreviateParty(jm.party)}
                    >
                      <PartyName party={jm.party} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className={`section-rule ${showExecutive && showDepartments ? '' : styles.hrHidden}`} />

      {/* Departments */}
      <section
        id="panel-departments"
        role="tabpanel"
        aria-labelledby="tab-departments"
        aria-label="Departments"
        className={sectionClass(showDepartments)}
      >
        <div className={styles.sectionHeader}>
          <h2 id="departments-heading" className={styles.sectionHeading}>Departments</h2>
          <p className={styles.sectionBlurb}>Each of the nine departments is led by a minister nominated by one of the Assembly parties. Posts are allocated sequentially using the <a href="https://en.wikipedia.org/wiki/D%27Hondt_method" target="_blank" rel="noopener noreferrer" aria-label="d'Hondt method, opens in new tab">d&apos;Hondt method</a>, where parties take turns selecting departments in an order determined by their seat share, ensuring the Executive reflects the balance of representation across communities.</p>
        </div>
        {departments.length === 0 ? (
          <p className="text-secondary">Ministerial data is not currently available.</p>
        ) : (
          <ul className={styles.cardList} role="list">
            {departments.map((m) => {
              const description = m.department ? departmentDescriptions[m.department] : undefined
              return (
                <li key={m.personId} className={styles.entryCard}>
                  <div className={styles.entryPerson}>
                    <MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={64} decorative />
                    <div className={styles.personInfo}>
                      <span className={styles.personRole}>{m.roleTitle ?? 'Minister'}</span>
                      <Link href={`/assembly/mlas/${m.personId}`} className={styles.personName}>
                        {formatMemberName(m.fullName)}
                      </Link>
                      {m.party && (
                        <span
                          className={styles.partyPill}
                          style={{ '--party-color': partyBorderColor(m.party) } as React.CSSProperties} data-party={abbreviateParty(m.party)}
                        >
                          <PartyName party={m.party} />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.entryHeader}>
                    <h3 className={styles.entryTitle}>{m.department ?? ''}</h3>
                    {description && (
                      <p className={styles.entryDescription}>{description}</p>
                    )}
                    {m.department && officialLinks[m.department] && (
                      <a
                        href={officialLinks[m.department]}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label={`Official website for ${m.department}, opens in new tab`}
                        className={styles.officialLink}
                      >
                        Official website <span aria-hidden="true">↗</span>
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <hr className={`section-rule ${showDepartments && showCommittees ? '' : styles.hrHidden}`} />

      {/* Committee chairs */}
      <section
        id="panel-committees"
        role="tabpanel"
        aria-labelledby="tab-committees"
        aria-label="Committee Chairs"
        className={sectionClass(showCommittees)}
      >
        <div className={styles.sectionHeader}>
          <h2 id="committees-heading" className={styles.sectionHeading}>Committee Chairs</h2>
          <p className={styles.sectionBlurb}>The statutory committees shadow each of the nine departments, scrutinising legislation, examining spending and holding ministers to account. Chairs are allocated to parties in proportion to their Assembly seats, in the same way as ministerial posts.</p>
        </div>
        {chairs.length === 0 ? (
          <p className="text-secondary">Committee chair data is not currently available.</p>
        ) : (
          <ul className={styles.cardList} role="list">
            {chairs.map((c) => {
              const description = c.committeeName ? committeeDescriptions[c.committeeName.trim()] : undefined
              return (
                <li key={c.personId} className={styles.entryCard}>
                  <div className={styles.entryPerson}>
                    <MlaPhoto name={c.fullName} imgUrl={c.imgUrl ?? ''} size={64} decorative />
                    <div className={styles.personInfo}>
                      <span className={styles.personRole}>Chair</span>
                      <Link href={`/assembly/mlas/${c.personId}`} className={styles.personName}>
                        {formatMemberName(c.fullName)}
                      </Link>
                      <div className={styles.pillRow}>
                        {c.party && (
                          <span
                            className={styles.partyPill}
                            style={{ '--party-color': partyBorderColor(c.party) } as React.CSSProperties} data-party={abbreviateParty(c.party)}
                          >
                            <PartyName party={c.party} />
                          </span>
                        )}
                        {c.assemblyRole && (
                          <span className={styles.speakerBadge}>{c.assemblyRole}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.entryHeader}>
                    <h3 className={styles.entryTitle}>{c.committeeName.trim()}</h3>
                    {description && (
                      <p className={styles.entryDescription}>{description}</p>
                    )}
                    {officialLinks[c.committeeName.trim()] && (
                      <a
                        href={officialLinks[c.committeeName.trim()]}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label={`Official page for ${c.committeeName.trim()}, opens in new tab`}
                        className={styles.officialLink}
                      >
                        Official page <span aria-hidden="true">↗</span>
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
