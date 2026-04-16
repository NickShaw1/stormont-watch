import styles from './BillStagePill.module.css'

interface Props {
  category: 'scheduled' | 'in-progress' | 'completed'
  currentStage: string | null
  passed: boolean | null
}

export default function BillStagePill({ category, currentStage, passed }: Props) {
  if (!currentStage || passed !== null || category === 'completed') return null
  if (category === 'scheduled') {
    return <span className={styles.stagePillScheduled}>Scheduled: {currentStage}</span>
  }
  return <span className={styles.stagePill}>{currentStage}</span>
}
