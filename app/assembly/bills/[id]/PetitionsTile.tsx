import { CalendarCheck, FileText, ShieldAlert, Users } from 'lucide-react'
import { formatDate } from '@/lib/format'
import MlaMiniGroup from '@/components/MlaMiniGroup'
import type { MlaRowPerson } from '@/components/MlaRow'
import type { PetitionGroup } from '@/lib/bills/billActivity'
import SignatoriesAccordion from './SignatoriesAccordion'
import styles from './billDetail.module.css'

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export default function PetitionsTile({ groups, basePath, signatoryCards }: { groups: PetitionGroup[]; basePath: string; signatoryCards: Record<string, MlaRowPerson> }) {
  const total = groups.reduce((sum, g) => sum + g.amendments.length, 0)
  return (
    <section id="petitions" className={styles.petitions} aria-labelledby="petitions-heading">
      <header className={styles.petHead}>
        <span className={styles.petIcon}><ShieldAlert size={30} strokeWidth={2} aria-hidden="true" /></span>
        <div className={styles.petText}>
          <span className={styles.petEyebrow}>Petitions of Concern</span>
          <h2 className={styles.petTitle} id="petitions-heading">{plural(total, 'petition of concern was', 'petitions of concern were')} tabled on this bill</h2>
          <p className={styles.petSub}>The votes they apply to are marked in the timeline below.</p>
        </div>
        <ShieldAlert className={styles.petMark} size={170} strokeWidth={1.5} aria-hidden="true" />
      </header>

      <div className={styles.petBody}>
      <div className={styles.pocGroups}>
        {groups.map(g => {
          const dates = [...new Set(g.amendments.map(a => a.date.slice(0, 10)))].sort()
          return (
            <div key={g.key} className={styles.pocGroup}>
              <h3 className={styles.srOnly}>Signatories and amendments</h3>
              <ul className={`${styles.facts} ${styles.pocFacts}`} role="list">
                {g.signatories.length > 0 && (
                  <li className={styles.fact}>
                    <span className={`${styles.iconTile} ${styles.tnBlue}`}><Users size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <span className={styles.factBody}>
                      <span className={styles.factText}><span className={styles.factLabel}>Tabled by</span></span>
                      <span className={styles.factValue}>{plural(g.signatories.length, 'MLA', 'MLAs')}</span>
                    </span>
                  </li>
                )}
                <li className={styles.fact}>
                  <span className={`${styles.iconTile} ${styles.tnPurple}`}><FileText size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={styles.factBody}>
                    <span className={styles.factText}>
                      <span className={styles.factLabel}>Amendments</span>
                      <span className={styles.factSub}>{g.amendments.map(a => a.number ?? a.label).join(', ')}</span>
                    </span>
                    <span className={styles.factValue}>{g.amendments.length}</span>
                  </span>
                </li>
                <li className={styles.fact}>
                  <span className={`${styles.iconTile} ${styles.tnTeal}`}><CalendarCheck size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={styles.factBody}>
                    <span className={styles.factText}><span className={styles.factLabel}>Confirmed</span></span>
                    <span className={styles.factValue}>{dates.map(d => formatDate(d)).join(', ')}</span>
                  </span>
                </li>
              </ul>
              {g.signatories.length > 0 && (
                <SignatoriesAccordion count={g.signatories.length}>
                  {g.parties.map(party => (
                    <MlaMiniGroup
                      key={party.party}
                      party={party.party}
                      basePath={basePath}
                      members={g.signatories
                        .filter(sg => (sg.party ?? 'Unknown') === party.party && signatoryCards[sg.personId])
                        .sort((x, y) => x.name.localeCompare(y.name))
                        .map(sg => ({
                          personId: sg.personId,
                          fullName: signatoryCards[sg.personId].fullName,
                          imgUrl: signatoryCards[sg.personId].imgUrl,
                          constituency: signatoryCards[sg.personId].constituency,
                        }))}
                    />
                  ))}
                </SignatoriesAccordion>
              )}
            </div>
          )
        })}
      </div>
      </div>
    </section>
  )
}
