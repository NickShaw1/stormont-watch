export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import MlasPageBody from '@/app/assembly/mlas/MlasPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `MLAs - ${mandate.label} archive`,
  description: `Members of the Northern Ireland Legislative Assembly during the ${mandate.label} mandate.`,
}

export default function ArchiveMlasPage() {
  return <MlasPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
