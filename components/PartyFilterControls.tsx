'use client'

import { abbreviateParty } from '@/lib/format'
import { useDropdown } from '@/lib/useDropdown'

export function partyLabel(party: string): string {
  return abbreviateParty(party) || party
}

interface Props {
  // The host page's CSS module, so each page keeps its exact styling.
  styles: Record<string, string>
  parties: string[]
  active: string
  onSelect: (party: string) => void
}

// Desktop pill row + mobile dropdown for the ranking pages' party filter.
export default function PartyFilterControls({ styles, parties, active, onSelect }: Props) {
  const partyDropdown = useDropdown()

  return (
    <>
      {/* Party filter pills (desktop) */}
      <div className={`${styles.filterRow} ${styles.filterRowDesktop}`} role="group" aria-label="Filter by party">
        <button
          className={`${styles.filterBtn} ${active === 'ALL' ? `${styles.filterBtnActive} ${styles.filterBtnActiveAll}` : ''}`}
          onClick={() => onSelect('ALL')}
          aria-pressed={active === 'ALL'}
        >
          All parties
        </button>
        {parties.map(party => {
          const isActive = active === party
          return (
            <button
              key={party}
              className={`${styles.filterBtn} ${isActive ? `${styles.filterBtnActive} ${styles.filterBtnActiveAll}` : ''}`}
              onClick={() => onSelect(party)}
              aria-pressed={isActive}
            >
              {partyLabel(party)}
            </button>
          )
        })}
      </div>

      {/* Party filter dropdown (mobile) */}
      <div className={styles.filterDropdownWrap}>
        <div className={styles.dropdownWrap} ref={partyDropdown.wrapRef}>
          <button
            ref={partyDropdown.triggerRef}
            type="button"
            className={styles.dropdownTrigger}
            onClick={() => partyDropdown.setOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={partyDropdown.open}
          >
            {active === 'ALL' ? 'All parties' : partyLabel(active)}
            <svg
              className={`${styles.dropdownTriggerChevron} ${partyDropdown.open ? styles.dropdownTriggerChevronOpen : ''}`}
              width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
            >
              <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {partyDropdown.open && (
            <ul ref={partyDropdown.listRef} className={styles.dropdownList} role="listbox">
              <li
                role="option"
                tabIndex={0}
                aria-selected={active === 'ALL'}
                className={`${styles.dropdownItem} ${active === 'ALL' ? styles.dropdownItemSelected : ''}`}
                onClick={() => { onSelect('ALL'); partyDropdown.setOpen(false) }}
                onKeyDown={(e) => partyDropdown.handleKeyDown(e, () => { onSelect('ALL'); partyDropdown.setOpen(false) })}
              >
                All parties
              </li>
              {parties.map(party => (
                <li
                  key={party}
                  role="option"
                  tabIndex={0}
                  aria-selected={party === active}
                  className={`${styles.dropdownItem} ${party === active ? styles.dropdownItemSelected : ''}`}
                  onClick={() => { onSelect(party); partyDropdown.setOpen(false) }}
                  onKeyDown={(e) => partyDropdown.handleKeyDown(e, () => { onSelect(party); partyDropdown.setOpen(false) })}
                >
                  {partyLabel(party)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
