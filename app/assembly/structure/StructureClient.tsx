import Link from 'next/link'
import Image from 'next/image'
import { formatMemberName, partyBorderColor, abbreviateParty } from '@/lib/format'
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

function PersonPhoto({ imgUrl, name, size, priority }: { imgUrl: string | null; name: string; size: number; priority?: boolean }) {
  if (!imgUrl) return <div style={{ width: size, height: size, borderRadius: 'var(--r-2)', background: 'var(--paper-3)', border: '1px solid var(--rule)', flexShrink: 0 }} />
  return (
    <Image
      src={imgUrl}
      alt={name}
      width={size}
      height={size}
      priority={priority}
      style={{ width: size, height: size, objectFit: 'cover', objectPosition: 'top center', borderRadius: 'var(--r-2)', border: '1px solid var(--rule)', flexShrink: 0 }}
    />
  )
}

export default function StructureClient({ fm, dfm, juniorMinisters, departments, chairs, officialLinks }: Props) {
  return (
    <>
      {/* Executive */}
      <section aria-label="The Executive" className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Power sharing</span>
            <h2 className={styles.sectionTitle}>The Executive</h2>
          </div>
        </div>
        <p className={styles.sectionBlurb}>
          The <a href="https://www.northernireland.gov.uk/" target="_blank" rel="noopener noreferrer">Northern Ireland Executive</a> is the devolved government established under the <a href="https://en.wikipedia.org/wiki/Good_Friday_Agreement" target="_blank" rel="noopener noreferrer">Good Friday Agreement</a>. It operates on a mandatory power-sharing basis, with the First Minister and Deputy First Minister drawn from the largest unionist and nationalist parties respectively.
        </p>

        <div className={styles.execTop}>
          {[fm, dfm].filter(Boolean).map((role) => {
            if (!role) return null
            return (
              <Link
                key={role.personId}
                href={`/assembly/mlas/${role.personId}`}
                className={styles.execCard}
                style={{ '--party-c': partyBorderColor(role.party) } as React.CSSProperties}
              >
                <div className={styles.execPhoto}>
                  <PersonPhoto imgUrl={role.imgUrl} name={role.fullName} size={72} priority />
                </div>
                <div className={styles.execInfo}>
                  <span className={styles.execMinistry}>{role.roleTitle}</span>
                  <span className={styles.execName}>{formatMemberName(role.fullName)}</span>
                  {role.party && (
                    <span className="party-pill" data-party={abbreviateParty(role.party)}>{abbreviateParty(role.party)}</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        {juniorMinisters.length > 0 && (
          <div className={styles.juniorGrid}>
            {[...juniorMinisters].reverse().map((jm) => (
              <Link
                key={jm.personId}
                href={`/assembly/mlas/${jm.personId}`}
                className={styles.juniorCard}
                style={{ '--party-c': partyBorderColor(jm.party) } as React.CSSProperties}
              >
                <PersonPhoto imgUrl={jm.imgUrl} name={jm.fullName} size={72} />
                <div className={styles.personInfo}>
                  <span className={styles.personRole}>Junior Minister</span>
                  <span className={styles.personName}>{formatMemberName(jm.fullName)}</span>
                  {jm.party && (
                    <span className="party-pill" data-party={abbreviateParty(jm.party)}>{abbreviateParty(jm.party)}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <hr className="section-rule" />

      {/* Departments */}
      <section aria-label="Departments" className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>d&apos;Hondt allocation</span>
            <h2 className={styles.sectionTitle}>Departments</h2>
          </div>
        </div>
        <p className={styles.sectionBlurb}>
          Each of the nine departments is led by a minister nominated by one of the Assembly parties. Posts are allocated sequentially using the <a href="https://en.wikipedia.org/wiki/D%27Hondt_method" target="_blank" rel="noopener noreferrer">d&apos;Hondt method</a>, where parties take turns selecting departments in proportion to their seat share.
        </p>

        {departments.length === 0 ? (
          <p className="text-secondary">Ministerial data is not currently available.</p>
        ) : (
          <div className={styles.deptGrid}>
            {departments.map((m) => (
              <div key={m.personId} className={styles.deptBlock}>
                <div className={styles.deptBlockHead}>
                  {m.department && officialLinks[m.department]
                    ? <a href={officialLinks[m.department]} target="_blank" rel="noopener noreferrer" className={styles.deptName}>{m.department}</a>
                    : <span className={styles.deptName}>{m.department ?? ''}</span>
                  }
                </div>
                <Link href={`/assembly/mlas/${m.personId}`} className={styles.deptItem} style={{ '--party-c': partyBorderColor(m.party) } as React.CSSProperties}>
                  <div className={styles.deptPhoto}>
                    <PersonPhoto imgUrl={m.imgUrl} name={m.fullName} size={56} />
                  </div>
                  <div className={styles.deptInfo}>
                    <span className={styles.deptLabel}>Minister</span>
                    <span className={styles.deptMlaName}>{formatMemberName(m.fullName)}</span>
                    {m.party && <span className="party-pill" data-party={abbreviateParty(m.party)}>{abbreviateParty(m.party)}</span>}
                  </div>
                  <span className={styles.deptArrow}>→</span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <hr className="section-rule" />

      {/* Committee chairs */}
      <section aria-label="Committee Chairs" className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionEyebrow}>Scrutiny</span>
            <h2 className={styles.sectionTitle}>Committee Chairs</h2>
          </div>
        </div>
        <p className={styles.sectionBlurb}>
          The statutory committees shadow each of the nine departments, scrutinising legislation, examining spending and holding ministers to account. Chairs are allocated to parties in proportion to their Assembly seats.
        </p>

        {chairs.length === 0 ? (
          <p className="text-secondary">Committee chair data is not currently available.</p>
        ) : (
          <div className={styles.deptGrid}>
            {chairs.map((c) => (
              <div key={c.personId} className={styles.deptBlock}>
                <div className={styles.deptBlockHead}>
                  {officialLinks[c.committeeName.trim()]
                    ? <a href={officialLinks[c.committeeName.trim()]} target="_blank" rel="noopener noreferrer" className={styles.deptName}>{c.committeeName.trim()}</a>
                    : <span className={styles.deptName}>{c.committeeName.trim()}</span>
                  }
                </div>
                <Link href={`/assembly/mlas/${c.personId}`} className={styles.deptItem}>
                  <div className={styles.deptPhoto}>
                    <PersonPhoto imgUrl={c.imgUrl} name={c.fullName} size={56} />
                  </div>
                  <div className={styles.deptInfo}>
                    <span className={styles.deptLabel}>Chair</span>
                    <span className={styles.deptMlaName}>{formatMemberName(c.fullName)}</span>
                    <div className={styles.pillRow}>
                      {c.party && <span className="party-pill" data-party={abbreviateParty(c.party)}>{abbreviateParty(c.party)}</span>}
                      {c.assemblyRole && <span className="party-pill" data-party={abbreviateParty(c.party)} style={{ '--dot-c': partyBorderColor(c.party) } as React.CSSProperties}>{c.assemblyRole}</span>}
                    </div>
                  </div>
                  <span className={styles.deptArrow}>→</span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
