export const dynamic = 'force-static'

import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllMembers, getAllMemberRoleHistories, getTotalExpensesPerMember } from '@/lib/db/queries'
import { calculateMandateEarnings, apiRoleToSalaryRole, type RoleInterval } from '@/lib/salaries'
import OverallCostListClient from './OverallCostListClient'

export const metadata: Metadata = {
  title: 'MLA Overall Cost',
  description: 'All current MLAs ranked by total public cost — mandate salary plus all published expenses.',
  openGraph: {
    title: 'MLA Overall Cost — Stormont Watch',
    description: 'All current MLAs ranked by total public cost — mandate salary plus all published expenses.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/overall-cost' },
}

const mlaImg = (personId: string) => `/mla-images/${personId}.jpg`

export default async function OverallCostPage() {
  const [allMembers, allRoleHistories, totalExpensesData] = await Promise.all([
    getAllMembers(),
    getAllMemberRoleHistories(),
    getTotalExpensesPerMember(),
  ])

  const rolesByPerson = new Map<string, typeof allRoleHistories>()
  for (const r of allRoleHistories) {
    if (!rolesByPerson.has(r.personId)) rolesByPerson.set(r.personId, [])
    rolesByPerson.get(r.personId)!.push(r)
  }

  const expenseTotalsMap = new Map(totalExpensesData.map(r => [r.personId, parseFloat(r.totalExpenses)]))
  const today = new Date().toISOString().slice(0, 10)

  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10)

  const rows = allMembers
    .filter(m => m.mandateStart && m.mandateStart <= oneYearAgoStr)
    .map(m => {
      const history = rolesByPerson.get(m.personId) ?? []
      const roleIntervals: RoleInterval[] = history
        .map(r => {
          const salaryRole = apiRoleToSalaryRole(r.roleType, r.role, r.organisation ?? '')
          if (!salaryRole) return null
          return { salaryRole, startDate: r.startDate, endDate: r.endDate ?? null }
        })
        .filter((r): r is RoleInterval => r !== null)

      const mandateEarnings = calculateMandateEarnings(roleIntervals, today)
      const totalExpenses = expenseTotalsMap.get(m.personId) ?? 0

      return {
        personId: m.personId,
        fullName: m.fullName,
        party: m.party ?? null,
        constituency: m.constituency ?? null,
        imgUrl: mlaImg(m.personId),
        mandateStart: m.mandateStart ?? null,
        mandateEarnings,
        totalExpenses,
        totalCost: mandateEarnings + totalExpenses,
      }
    })
    .sort((a, b) => b.totalCost - a.totalCost)

  return (
    <div className="container">
      <header className="page-header">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li><Link href="/assembly/stats">Stats</Link></li>
            <li aria-current="page">Overall cost</li>
          </ol>
        </nav>
        <h1>Overall cost</h1>
        <p className="lede">Total estimated mandate salary plus all published expenses for every MLA. MLAs who joined within the last year are excluded as their figures are not comparable.</p>
        <p style={{ fontSize: '12px', color: 'var(--ink-4)', fontStyle: 'italic', marginBottom: 'var(--s-4)' }}>* Salary estimates are based on published Assembly rates and may not reflect all personal circumstances.</p>
      </header>

      <OverallCostListClient rows={rows} />
    </div>
  )
}
