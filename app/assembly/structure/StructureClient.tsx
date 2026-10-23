'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Handshake, Gavel, Building2, ShieldCheck, ArrowUpRight, ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatMemberName, abbreviateParty } from '@/lib/format'
import { useMandate } from '@/components/MandateContext'
import styles from './structure.module.css'

type Minister = {
  personId: string
  fullName: string
  party: string | null
  imgUrl: string | null
  roleTitle: string | null
  department: string | null
  constituency: string | null
}

type Chair = {
  personId: string
  fullName: string
  party: string | null
  imgUrl: string | null
  committeeName: string
  assemblyRole: string | null
  constituency: string | null
}

type PresidingOfficer = {
  personId: string
  fullName: string
  party: string | null
  assemblyRole: string | null
  imgUrl: string | null
  constituency: string | null
}

interface Props {
  fm: Minister | undefined
  dfm: Minister | undefined
  juniorMinisters: Minister[]
  departments: Minister[]
  chairs: Chair[]
  officialLinks: Record<string, string>
  presidingOfficers: PresidingOfficer[]
}

type PersonProps = {
  personId: string
  fullName: string
  party: string | null
  imgUrl: string | null
  constituency: string | null
  role?: string | null
  priority?: boolean
}

function Person({ personId, fullName, party, imgUrl, constituency, role, priority }: PersonProps) {
  const { basePath } = useMandate()
  const abbr = party ? abbreviateParty(party) : null
  return (
    <div className={styles.person}>
      <div className={styles.photo}>
        {imgUrl && (
          <Image
            src={imgUrl}
            alt=""
            fill
            sizes="88px"
            priority={priority}
            style={{ objectFit: 'cover', objectPosition: 'top center' }}
          />
        )}
      </div>
      <div className={styles.info}>
        <Link href={`${basePath}/assembly/mlas/${personId}`} className={styles.name}>{formatMemberName(fullName)}</Link>
        {constituency && <span className={styles.constituency}>{constituency}</span>}
        {(abbr || role) && (
          <span className={styles.tags}>
            {abbr && <span className="party-pill" data-party={abbr}>{abbr}</span>}
            {role && <span className={styles.rolePill}>{role.charAt(0).toUpperCase() + role.slice(1)}</span>}
          </span>
        )}
      </div>
    </div>
  )
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.extLink}>
      {children}
      <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

function Unit({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <li className={styles.unit}>
      <h3 className={styles.unitTitle}>
        {href ? <ExtLink href={href}>{title}</ExtLink> : <span className={styles.unitText}>{title}</span>}
      </h3>
      <div className={styles.row}>
        {children}
        <ArrowRight className={styles.arrow} size={18} strokeWidth={2} aria-hidden="true" />
      </div>
    </li>
  )
}

function Row({ children }: { children: ReactNode }) {
  return (
    <li className={styles.row}>
      {children}
      <ArrowRight className={styles.arrow} size={18} strokeWidth={2} aria-hidden="true" />
    </li>
  )
}

function TileHead({ icon: IconCmp, eyebrow, title, id, children }: { icon: LucideIcon; eyebrow: string; title: string; id: string; children: ReactNode }) {
  return (
    <header className={styles.tileHead}>
      <span className={styles.iconTile}><IconCmp size={22} strokeWidth={2} aria-hidden="true" /></span>
      <div className={styles.tileHeadText}>
        <span className={styles.tileEyebrow}>{eyebrow}</span>
        <h2 className={styles.tileTitle} id={id}>{title}</h2>
      </div>
      <p className={styles.tileText}>{children}</p>
    </header>
  )
}

export default function StructureClient({ fm, dfm, juniorMinisters, departments, chairs, officialLinks, presidingOfficers }: Props) {
  const leaders = [fm, dfm].filter((m): m is Minister => Boolean(m))

  return (
    <>
      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="structure-title">
        <div className="container">
          <header className={styles.head}>
            <span className={styles.eyebrow}>The Assembly</span>
            <h1 className={styles.h1} id="structure-title">Who&apos;s in Charge</h1>
            <p className={styles.headSub}>The power-sharing Executive, ministerial departments and committee chairs of the Northern Ireland Assembly.</p>
          </header>

          <div className={styles.stack}>
            <section className={styles.tile} aria-labelledby="executive-title">
              <TileHead icon={Handshake} eyebrow="Power sharing" title="The Executive" id="executive-title">
                The <a href="https://www.northernireland.gov.uk/" target="_blank" rel="noopener noreferrer">Northern Ireland Executive<span className="sr-only"> (opens in a new tab)</span></a> is the devolved government established under the <a href="https://en.wikipedia.org/wiki/Good_Friday_Agreement" target="_blank" rel="noopener noreferrer">Good Friday Agreement</a>. It operates on a mandatory power-sharing basis, with the First Minister and Deputy First Minister drawn from the largest unionist and nationalist parties respectively.
              </TileHead>
              {leaders.length > 0 && (
                <ul className={styles.rows}>
                  {leaders.map((m) => (
                    <Row key={m.personId}>
                      <Person {...m} role={m.roleTitle} priority />
                    </Row>
                  ))}
                </ul>
              )}
              {juniorMinisters.length > 0 && (
                <ul className={styles.rows}>
                  {[...juniorMinisters].reverse().map((m) => (
                    <Row key={m.personId}>
                      <Person {...m} role="Junior Minister" />
                    </Row>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.tile} aria-labelledby="officers-title">
              <TileHead icon={Gavel} eyebrow="Assembly business" title="Presiding Officers" id="officers-title">
                The presiding officers chair plenary sessions of the Assembly, maintain order in the chamber and oversee the conduct of Assembly business. The Speaker is elected by members at the start of each mandate.
              </TileHead>
              {presidingOfficers.length === 0 ? (
                <p className={styles.empty}>Presiding officer data is not currently available.</p>
              ) : (
                <ul className={styles.rows}>
                  {presidingOfficers.map((p) => (
                    <Row key={p.personId}>
                      <Person {...p} role={p.assemblyRole} />
                    </Row>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandTint}`} aria-labelledby="departments-title">
        <div className="container">
          <div className={styles.stack}>
            <div className={styles.tile}>
              <TileHead icon={Building2} eyebrow="d'Hondt allocation" title="Departments" id="departments-title">
                Each of the nine departments is led by a minister nominated by one of the Assembly parties. Posts are allocated sequentially using the <a href="https://en.wikipedia.org/wiki/D%27Hondt_method" target="_blank" rel="noopener noreferrer">d&apos;Hondt method<span className="sr-only"> (opens in a new tab)</span></a>, where parties take turns selecting departments in proportion to their seat share.
              </TileHead>
              {departments.length === 0 ? (
                <p className={styles.empty}>Ministerial data is not currently available.</p>
              ) : (
                <ul className={`${styles.rows} ${styles.unitRows}`}>
                  {departments.map((m) => (
                    <Unit key={m.personId} title={m.department ?? ''} href={m.department ? officialLinks[m.department] : undefined}>
                      <Person {...m} />
                    </Unit>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="chairs-title">
        <div className="container">
          <div className={styles.stack}>
            <div className={styles.tile}>
              <TileHead icon={ShieldCheck} eyebrow="Scrutiny" title="Committee Chairs" id="chairs-title">
                The statutory committees shadow each of the nine departments, scrutinising legislation, examining spending and holding ministers to account. Chairs are allocated to parties in proportion to their Assembly seats.
              </TileHead>
              {chairs.length === 0 ? (
                <p className={styles.empty}>Committee chair data is not currently available.</p>
              ) : (
                <ul className={`${styles.rows} ${styles.unitRows}`}>
                  {chairs.map((c) => {
                    const committee = c.committeeName.trim()
                    return (
                      <Unit key={c.personId} title={committee} href={officialLinks[committee]}>
                        <Person {...c} role={c.assemblyRole} />
                      </Unit>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
