import { Banknote, PiggyBank, Sigma } from 'lucide-react'
import { getAllMembers, getAllMemberRoleHistories, mlaImg } from '@/lib/db/queries'
import { calculateMandateEarnings, getCurrentAnnualSalary, apiRoleToSalaryRole, salaryRatesPublished, type RoleInterval } from '@/lib/salaries'
import { formatMemberName, gbp } from '@/lib/format'
import SalariesListClient from './SalariesListClient'
import RankingShell, { rankTones } from '../stats/RankingShell'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'

// Shared by the live route and archive routes; mandate/basePath vary per route.
export default async function SalariesPageBody({
  mandate,
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
  const earningsTotal = rows.reduce((s, r) => s + r.mandateEarnings, 0)

  return (
    <RankingShell
      title="MLA salaries"
      sub={<>Estimated salaries for all {sittingAdjective(mandate)} MLAs based on published Assembly rates. Each MLA is paid the full published salary for the highest-paid role they hold on any given day (for example minister, statutory committee chair or the basic MLA rate), not a supplement on top of the basic salary. Salary estimates are based on published Assembly rates and may not reflect all personal circumstances.</>}
      stats={ratesPublished && rows.length > 0 ? [
        { tone: rankTones.green, icon: Banknote, label: 'Highest salary', figure: gbp(bySalary[0].currentSalary), sub: formatMemberName(bySalary[0].fullName) },
        { tone: rankTones.teal, icon: PiggyBank, label: 'Highest earnings', figure: gbp(byEarnings[0].mandateEarnings), sub: `${formatMemberName(byEarnings[0].fullName)}, this mandate` },
        { tone: rankTones.purple, icon: Sigma, label: 'Combined earnings', figure: gbp(earningsTotal), sub: `estimated, across ${rows.length} ${sittingAdjective(mandate)} MLAs` },
      ] : []}
    >
      {ratesPublished ? (
        <SalariesListClient bySalary={bySalary} byEarnings={byEarnings} />
      ) : (
        <div className="notice-card">Salary figures for the {mandate.label} mandate are not yet available: the Assembly&apos;s published pay rates for this mandate have not been released.</div>
      )}
    </RankingShell>
  )
}
