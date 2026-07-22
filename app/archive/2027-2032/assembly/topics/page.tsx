export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import TopicsPageBody from '@/app/assembly/topics/TopicsPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `MLA Topics - ${mandate.label} archive`,
  description: `Debate topics spoken on by MLAs during the ${mandate.label} mandate.`,
}

export default function ArchiveTopicsPage() {
  return <TopicsPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
