'use client'

import { useState } from 'react'
import { ChevronDown, Handshake, Scale, X } from 'lucide-react'
import type { AgreedDivisionRow } from '@/lib/db/queries'
import AgreementTile from './AgreementTile'
import DivisionList from './DivisionList'
import styles from './statsKit.module.css'

interface Block {
  agreePct: number
  agreed: number
  totalDivisions: number
  items: { label: string; value: number }[]
}

interface Props {
  bigTwo: Block | null
  bloc: Block | null
  divisions: AgreedDivisionRow[]
  basePath: string
}

const PANEL = 'bigtwo-panel'

export default function AgreementPair({ bigTwo, bloc, divisions, basePath }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {bigTwo && (
        <section className={styles.tile} aria-labelledby="bigtwo-heading">
          <div className={`${styles.tileHead} ${styles.agHead}`}>
            <span className={`${styles.iconTile} ${styles.tnTeal}`}><Handshake size={22} strokeWidth={2} aria-hidden="true" /></span>
            <div className={styles.tileTitles}>
              <h3 className={styles.tileTitle} id="bigtwo-heading">Sinn Féin and the DUP</h3>
              <p className={styles.tileSub}>How often the two largest parties took the same position, across {bigTwo.totalDivisions} divisions.</p>
            </div>
            <button type="button" className={`${styles.expandBtn} ${styles.agAction} ${styles.agBtnTop}`} aria-expanded={open} aria-controls={PANEL} onClick={() => setOpen(!open)}>
              <span className={styles.swapLabel}><span data-on={!open ? '' : undefined}>{`Show ${divisions.length} divisions`}</span><span data-on={open ? '' : undefined}>{`Hide ${divisions.length} divisions`}</span></span>
              <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <AgreementTile {...bigTwo} />
          <button type="button" className={`${styles.expandBtn} ${styles.agBtnBottom}`} aria-expanded={open} aria-controls={PANEL} onClick={() => setOpen(!open)}>
            <span className={styles.swapLabel}><span data-on={!open ? '' : undefined}>{`Show ${divisions.length} divisions`}</span><span data-on={open ? '' : undefined}>{`Hide ${divisions.length} divisions`}</span></span>
            <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <div id={PANEL} className={`${styles.alPanel} ${styles.agPanel}`} role="region" aria-label={open ? 'Divisions where Sinn Féin and the DUP agreed' : undefined} hidden={!open}>
            {open && (
              <>
                <div className={styles.alPanelHead}>
                  <h4 className={styles.alPanelTitle}>Sinn Féin and the DUP</h4>
                  <button type="button" className={styles.alClose} aria-label="Close divisions" onClick={() => setOpen(false)}>
                    <X size={20} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
                <DivisionList wide partyA="Sinn Féin" partyB="DUP" divisions={divisions} basePath={basePath} total={bigTwo?.totalDivisions} />
              </>
            )}
          </div>
        </section>
      )}
      {bloc && (
        <section className={styles.tile} aria-labelledby="blocs-heading">
          <div className={styles.tileHead}>
            <span className={`${styles.iconTile} ${styles.tnIndigo}`}><Scale size={22} strokeWidth={2} aria-hidden="true" /></span>
            <div className={styles.tileTitles}>
              <h3 className={styles.tileTitle} id="blocs-heading">Unionist and nationalist blocs</h3>
              <p className={styles.tileSub}>A bloc&apos;s position is the side more than half of its MLAs who voted took. Only Aye and No votes count.</p>
            </div>
          </div>
          <AgreementTile {...bloc} barColor="var(--c-indigo)" />
        </section>
      )}
    </>
  )
}
