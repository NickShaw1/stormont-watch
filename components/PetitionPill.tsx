import { ShieldAlert } from 'lucide-react'
import styles from './PetitionPill.module.css'

export default function PetitionPill({ children = 'Petition of Concern', iconOnlyOnPhone }: { children?: React.ReactNode; iconOnlyOnPhone?: boolean }) {
  return (
    <span className={`${styles.pill}${iconOnlyOnPhone ? ` ${styles.iconOnly}` : ''}`}>
      <ShieldAlert size={14} strokeWidth={2} aria-hidden="true" />
      <span className={styles.text}>{children}</span>
    </span>
  )
}
