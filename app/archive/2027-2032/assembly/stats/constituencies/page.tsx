export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import ConstituencyStatsBody from '@/app/assembly/stats/constituencies/ConstituencyStatsBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `Constituencies - Stats - ${mandate.label} archive`,
  description: `Every Northern Ireland constituency ranked on attendance, questions, expenses, expenses per seat, MLAs who have left and a fun overall score across the ${mandate.label} mandate.`,
}

export default function ArchiveConstituencyStatsPage() {
  return <ConstituencyStatsBody mandate={mandate} basePath="/archive/2027-2032" />
}
