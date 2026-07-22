export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import HomePageBody from '@/app/HomePageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `Stormont Watch - ${mandate.label} archive`,
  description: `Stormont Watch tracks every vote, bill and expense in the Northern Ireland Assembly during the ${mandate.label} mandate.`,
}

export default function ArchiveHomePage() {
  return <HomePageBody mandate={mandate} basePath="/archive/2027-2032" />
}
