export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import ConstituenciesPageBody from '@/app/assembly/constituencies/ConstituenciesPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `Constituencies - ${mandate.label} archive`,
  description: `The MLAs who held each constituency's seats during the ${mandate.label} mandate.`,
}

export default function ArchiveConstituenciesPage() {
  return <ConstituenciesPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
