import Link from 'next/link'
import { getAllMembers, getAllMemberRoleHistories } from '@/lib/db/queries'
import { calculateMandateEarnings, getCurrentAnnualSalary, apiRoleToSalaryRole, salaryRatesPublished, type RoleInterval } from '@/lib/salaries'
import SalariesListClient from './SalariesListClient'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'

const mlaImg = (personId: string) => `/mla-images/${personId}.jpg`

/**
 * Shared body for the salaries page — rendered by both the live route (current mandate,
 * basePath '') and the archive route (`/archive/<id>`). `mandate` drives the queries
 * and copy; `basePath` prefixes internal links.
 */
export default async function SalariesPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [allMembers, allRoleHistories] = await Promise.all([
    getAllMembers(mandate.id),
    getAllMemberRoleHistories(mandate.id),
  ])

  const rolesByPerson = new Map<string, typeof allRoleHistories>()
  for (const r of allRoleHistories) {
    if (!rolesByPerson.has(r.personId)) rolesByPerson.set(r.personId, [])
    rolesByPerson.get(r.personId)!.push(r)
  }

  const today = new Date().toISOString().slice(0, 10)
  const ratesPublished = salaryRatesPublished(mandate.id)

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
      currentSalary: getCurrentAnnualSalary(roleIntervals, today, mandate.id) ?? 0,
      mandateEarnings: calculateMandateEarnings(roleIntervals, today, mandate.id) ?? 0,
    }
  })

  const bySalary = [...rows].sort((a, b) => b.currentSalary - a.currentSalary)
  const byEarnings = [...rows].sort((a, b) => b.mandateEarnings - a.mandateEarnings)

  return (
    <div className="container">
      <header className="page-header">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li><Link href={`${basePath}/assembly/stats`}>Statistics</Link></li>
            <li aria-current="page">MLA Salaries</li>
          </ol>
        </nav>
        <h1>MLA Salaries</h1>
        <p className="lede">Estimated salaries for all {sittingAdjective(mandate)} MLAs based on published Assembly rates. Figures include role supplements for ministers, committee chairs and other officeholders.</p>
      </header>

      {ratesPublished ? (
        <>
          <div className="notice-card">Salary estimates are based on published Assembly rates and may not reflect all personal circumstances.</div>
          <SalariesListClient bySalary={bySalary} byEarnings={byEarnings} />
        </>
      ) : (
        <div className="notice-card">Salary figures for the {mandate.label} mandate are not yet available: the Assembly&apos;s published pay rates for this mandate have not been released.</div>
      )}
    </div>
  )
}
