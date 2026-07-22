export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import SittingsPageBody from '@/app/assembly/sittings/SittingsPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `MLA Sittings - ${mandate.label} archive`,
  description: `Plenary sittings spoken in by MLAs during the ${mandate.label} mandate.`,
}

export default function ArchiveSittingsPage() {
  return <SittingsPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
