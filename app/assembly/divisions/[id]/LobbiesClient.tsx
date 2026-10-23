'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, X, Minus, UserX, Users } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import { abbreviateParty, formatMemberName, getSurname, partyBorderColor } from '@/lib/format'
import { useMandate } from '@/components/MandateContext'
import { VOTE_LABEL, VOTE_ORDER, type VoteKey, type Ballot } from './voteMeta'
import styles from './divisionDetail.module.css'

const ICON = { AYE: Check, NO: X, ABSTAINED: Minus, NO_SHOW: UserX } as const

const partyKey = (b: Ballot) => b.party ?? 'Independent'
const shortName = (party: string) => (party === 'Independent' ? 'Independent' : abbreviateParty(party))

export default function LobbiesClient({ ballots }: { ballots: Ballot[] }) {
  const { basePath } = useMandate()
  const [focus, setFocus] = useState<string | null>(null)

  const { sides, parties } = useMemo(() => {
    const total = ballots.length || 1
    const build = (vote: VoteKey) => {
      const members = ballots.filter((b) => b.vote === vote)
      const map = new Map<string, Ballot[]>()
      for (const m of members) map.set(partyKey(m), [...(map.get(partyKey(m)) ?? []), m])
      const groups = [...map.entries()]
        .map(([party, items]) => ({ party, items: items.sort((a, b) => getSurname(a.fullName).localeCompare(getSurname(b.fullName))) }))
        .sort((a, b) => b.items.length - a.items.length)
      return { vote, count: members.length, pct: Math.round((members.length / total) * 100), groups }
    }
    const all = { AYE: build('AYE'), NO: build('NO'), ABSTAINED: build('ABSTAINED'), NO_SHOW: build('NO_SHOW') }
    const pm = new Map<string, number>()
    for (const b of ballots) pm.set(partyKey(b), (pm.get(partyKey(b)) ?? 0) + 1)
    const parties = [...pm.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([party, n]) => {
        const split: Record<VoteKey, number> = { AYE: 0, NO: 0, ABSTAINED: 0, NO_SHOW: 0 }
        for (const b of ballots) if (partyKey(b) === party) split[b.vote]++
        return { party, n, split }
      })
    return { sides: all, parties }
  }, [ballots])

  const focusInfo = focus ? parties.find((p) => p.party === focus) ?? null : null

  const renderLobby = (side: (typeof sides)[VoteKey]) => {
    const Icon = ICON[side.vote]
    const shownGroups = focus ? side.groups.filter((g) => g.party === focus) : side.groups
    const verb = side.vote === 'AYE' ? 'voted Aye' : side.vote === 'NO' ? 'voted No' : side.vote === 'ABSTAINED' ? 'abstained' : 'did not vote'
    const headCount = focus ? shownGroups.reduce((n, g) => n + g.items.length, 0) : side.count
    return (
      <section key={side.vote} className={styles.lobby} data-vote={side.vote} aria-labelledby={`lobby-${side.vote}`}>
        <div className={styles.lobbyTop}>
          <span className={styles.lobbyIcon}><Icon size={22} strokeWidth={2.5} aria-hidden="true" /></span>
          <div className={styles.lobbyTitles}>
            <h3 className={styles.lobbyName} id={`lobby-${side.vote}`}>{VOTE_LABEL[side.vote]}</h3>
          </div>
          {focus && (
            <span className={styles.countPill}>
              {headCount} of {side.count}
              <span className="sr-only"> who {verb}</span>
            </span>
          )}
        </div>
        <div className={styles.lobbyBody}>
          {shownGroups.map(({ party, items }) => (
            <div key={party} className={styles.partyGroup} data-solo={focus ? '' : undefined}>
              {!focus && (
                <div className={styles.partyGroupHead}>
                  <i className={styles.partySquare} style={{ background: partyBorderColor(party) }} aria-hidden="true" />
                  <span className={styles.partyFull}>{party}</span>
                </div>
              )}
              <ul className={styles.minis} aria-label={`${party}: ${VOTE_LABEL[side.vote]}`}>
                {items.map((b) => (
                  <li key={b.personId} className={styles.mini}>
                    <span className={styles.miniPhoto}>
                      <MlaPhoto name={b.fullName} imgUrl={b.imgUrl ?? ''} size={128} decorative square personId={b.personId} />
                    </span>
                    <Link href={`${basePath}/assembly/mlas/${b.personId}`} className={styles.miniName} title={`${formatMemberName(b.fullName)}${b.constituency ? `, ${b.constituency}` : ''}`}>
                      {formatMemberName(b.fullName)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    )
  }

  const here = (side: (typeof sides)[VoteKey]) => side.count > 0 && (!focus || side.groups.some((g) => g.party === focus))
  const main = [sides.AYE, sides.NO].filter(here)
  const rest = [sides.ABSTAINED, sides.NO_SHOW].filter(here)

  return (
    <section className={`${styles.tile} ${styles.lobbies}`} aria-labelledby="lobbies-heading">
      <div className={styles.tileHead}>
        <span className={`${styles.iconTile} ${styles.tnBlue}`}><Users size={22} strokeWidth={2} aria-hidden="true" /></span>
        <h2 className={styles.tileTitle} id="lobbies-heading">Who voted which way</h2>
      </div>

      <div className={styles.filterBlock}>
        <span className={styles.filterLabel} id="pf-label">Party</span>
        <ul className={styles.partyFilter} aria-labelledby="pf-label">
          <li>
            <button type="button" className={styles.pf} aria-pressed={focus === null} onClick={() => setFocus(null)}>
              All
              <span className={styles.pfCount}>{ballots.length}</span>
            </button>
          </li>
          {parties.map(({ party, n }) => (
            <li key={party}>
              <button type="button" className={styles.pf} aria-pressed={focus === party} onClick={() => setFocus(focus === party ? null : party)} title={party}>
                <i className={styles.pfDot} style={{ background: partyBorderColor(party) }} aria-hidden="true" />
                {shortName(party)}
                <span className={styles.pfCount}>{n}</span>
              </button>
            </li>
          ))}
        </ul>
        {focusInfo && (
          <div className={styles.focusNote} role="status">
            <span>
              Showing <b>{focus && shortName(focus)}</b>:{' '}
              {VOTE_ORDER.filter((v) => focusInfo.split[v] > 0).map((v, i) => (
                <span key={v}>{i > 0 && ' · '}<b>{focusInfo.split[v]}</b> {VOTE_LABEL[v]}</span>
              ))}
            </span>
            <button type="button" className={styles.clearFocus} onClick={() => setFocus(null)}>
              <X size={16} strokeWidth={2} aria-hidden="true" />
              Clear
            </button>
          </div>
        )}
      </div>

      <div className={styles.lobbyStack}>
        {main.length > 0 && (
          <div className={styles.lobbyGrid}>
            {main.map(renderLobby)}
          </div>
        )}
        {rest.length > 0 && <div className={styles.lobbyRest}>{rest.map(renderLobby)}</div>}
      </div>
    </section>
  )
}
