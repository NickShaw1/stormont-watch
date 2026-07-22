export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import ExpensesPageBody from '@/app/assembly/expenses/ExpensesPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `MLA Expenses - ${mandate.label} archive`,
  description: `MLA expenses claimed during the ${mandate.label} mandate.`,
}

export default function ArchiveExpensesPage() {
  return <ExpensesPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
