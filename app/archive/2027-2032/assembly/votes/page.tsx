export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import VotesPageBody from '@/app/assembly/votes/VotesPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `Votes - ${mandate.label} archive`,
  description: `Every recorded division in the Northern Ireland Assembly during the ${mandate.label} mandate.`,
}

export default function ArchiveVotesPage() {
  return <VotesPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
