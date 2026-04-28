export const dynamic = 'force-static'

import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllMembers, getAllMemberRoleHistories } from '@/lib/db/queries'
import { calculateMandateEarnings, getCurrentAnnualSalary, apiRoleToSalaryRole, type RoleInterval } from '@/lib/salaries'
import SalariesListClient from './SalariesListClient'

const mlaImg = (personId: string) => `/mla-images/${personId}.jpg`

export const metadata: Metadata = {
  title: 'MLA Salaries',
  description: 'All current MLAs ranked by salary and mandate earnings.',
  openGraph: {
    title: 'MLA Salaries — Stormont Watch',
    description: 'All current MLAs ranked by salary and mandate earnings.',
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/salaries' },
}

export default async function SalariesPage() {
  const [allMembers, allRoleHistories] = await Promise.all([
    getAllMembers(),
    getAllMemberRoleHistories(),
  ])

  const rolesByPerson = new Map<string, typeof allRoleHistories>()
  for (const r of allRoleHistories) {
    if (!rolesByPerson.has(r.personId)) rolesByPerson.set(r.personId, [])
    rolesByPerson.get(r.personId)!.push(r)
  }

  const today = new Date().toISOString().slice(0, 10)

  const rows = allMembers.map(m => {
    const history = rolesByPerson.get(m.personId) ?? []
    const roleIntervals: RoleInterval[] = history
      .map(r => {
        const salaryRole = apiRoleToSalaryRole(r.roleType, r.role, r.organisation ?? '')
        if (!salaryRole) return null
        return { salaryRole, startDate: r.startDate, endDate: r.endDate ?? null }
      })
      .filter((r): r is RoleInterval => r !== null)

    return {
      personId: m.personId,
      fullName: m.fullName,
      party: m.party ?? null,
      constituency: m.constituency ?? null,
      imgUrl: mlaImg(m.personId),
      mandateStart: m.mandateStart ?? null,
      currentSalary: getCurrentAnnualSalary(roleIntervals, today),
      mandateEarnings: calculateMandateEarnings(roleIntervals, today),
    }
  })

  const bySalary = [...rows].sort((a, b) => b.currentSalary - a.currentSalary)
  const byEarnings = [...rows].sort((a, b) => b.mandateEarnings - a.mandateEarnings)

  return (
    <div className="container">
      <header className="page-header">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li><Link href="/assembly/stats">Stats</Link></li>
            <li aria-current="page">MLA Salaries</li>
          </ol>
        </nav>
        <h1>MLA Salaries</h1>
        <p className="lede">Estimated salaries for all current MLAs based on published Assembly rates. Figures include role supplements for ministers, committee chairs and other officeholders.</p>
        <p style={{ fontSize: '12px', color: 'var(--ink-4)', fontStyle: 'italic', marginBottom: 'var(--s-4)' }}>* Salary estimates are based on published Assembly rates and may not reflect all personal circumstances.</p>
      </header>

      <SalariesListClient bySalary={bySalary} byEarnings={byEarnings} />
    </div>
  )
}
