export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import VotingPageBody from '@/app/assembly/stats/voting/VotingPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `Voting - Stats - ${mandate.label} archive`,
  description: `How MLAs and parties vote. Attendance records, party cohesion, rebellion rates and cross-community trends since ${mandate.startLabel}.`,
}

export default function ArchiveVotingPage() {
  return <VotingPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
