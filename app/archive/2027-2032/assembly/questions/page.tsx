export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import QuestionsPageBody from '@/app/assembly/questions/QuestionsPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `MLA Questions - ${mandate.label} archive`,
  description: `Questions tabled by MLAs during the ${mandate.label} mandate.`,
}

export default function ArchiveQuestionsPage() {
  return <QuestionsPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
