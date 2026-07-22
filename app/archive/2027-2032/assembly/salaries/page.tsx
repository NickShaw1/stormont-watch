export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import SalariesPageBody from '@/app/assembly/salaries/SalariesPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `MLA Salaries - ${mandate.label} archive`,
  description: `MLA salaries and mandate earnings during the ${mandate.label} mandate.`,
}

export default function ArchiveSalariesPage() {
  return <SalariesPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
