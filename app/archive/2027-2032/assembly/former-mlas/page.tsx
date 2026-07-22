export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import FormerMlasPageBody from '@/app/assembly/former-mlas/FormerMlasPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `Former MLAs - ${mandate.label} archive`,
  description: `Members of the Northern Ireland Legislative Assembly who left during the ${mandate.label} mandate.`,
}

export default function ArchiveFormerMlasPage() {
  return <FormerMlasPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
