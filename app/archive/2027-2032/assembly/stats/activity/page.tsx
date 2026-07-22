export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import ActivityPageBody from '@/app/assembly/stats/activity/ActivityPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `Activity - Stats - ${mandate.label} archive`,
  description: `Questions to ministers and chamber participation across the ${mandate.label} Northern Ireland Assembly mandate.`,
}

export default function ArchiveActivityPage() {
  return <ActivityPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
