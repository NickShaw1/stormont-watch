import { Milestone } from 'lucide-react'
import styles from './BillStagePill.module.css'

interface Props {
  category: 'scheduled' | 'in-progress' | 'completed'
  currentStage: string | null
  passed: boolean | null
}

export default function BillStagePill({ category, currentStage, passed }: Props) {
  if (!currentStage || passed !== null || category === 'completed') return null
  return (
    <span className={styles.stageChip}>
      <Milestone size={12} strokeWidth={2} aria-hidden="true" />
      {category === 'scheduled' ? `Scheduled: ${currentStage}` : currentStage}
    </span>
  )
}
