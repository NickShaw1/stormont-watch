import { Sigma, Crown, Calculator } from 'lucide-react'
import { getAllMandateMembers, getAllMemberRoleHistories, getTotalExpensesPerMember, mlaImg } from '@/lib/db/queries'
import { calculateMandateEarnings, apiRoleToSalaryRole, salaryRatesPublished, type RoleInterval } from '@/lib/salaries'
import { formatMemberName, gbp } from '@/lib/format'
import RankingShell, { rankTones } from '../stats/RankingShell'
import OverallCostListClient from './OverallCostListClient'
import { rankRows } from '../stats/rankUtils'
import type { Mandate } from '@/lib/constants/mandates'

// Shared by the live route and archive routes; mandate/basePath vary per route.
export default async function OverallCostPageBody({
  mandate,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [allMandateMembers, allRoleHistories, totalExpensesData] = await Promise.all([
    getAllMandateMembers(mandate.id),
    getAllMemberRoleHistories(mandate.id),
    getTotalExpensesPerMember(mandate.id),
  ])

  const rolesByPerson = new Map<string, typeof allRoleHistories>()
  for (const r of allRoleHistories) {
    if (!rolesByPerson.has(r.personId)) rolesByPerson.set(r.personId, [])
    rolesByPerson.get(r.personId)!.push(r)
  }

  const expenseTotalsMap = new Map(totalExpensesData.map(r => [r.personId, parseFloat(r.totalExpenses)]))
  const today = new Date().toISOString().slice(0, 10)
  const ratesPublished = salaryRatesPublished(mandate.id)

  const rows = allMandateMembers
    .map(m => {
      const roleIntervals: RoleInterval[] = (rolesByPerson.get(m.personId) ?? [])
        .map(r => {
          const salaryRole = apiRoleToSalaryRole(r.roleType, r.role, r.organisation ?? '')
          if (!salaryRole) return null
          return { salaryRole, startDate: r.startDate, endDate: r.endDate ?? null }
        })
        .filter((r): r is RoleInterval => r !== null)
      const mandateEarnings = calculateMandateEarnings(roleIntervals, today, mandate.id) ?? 0
      const totalExpenses = expenseTotalsMap.get(m.personId) ?? 0
      const value = mandateEarnings + totalExpenses
      return {
        id: m.personId,
        fullName: m.fullName,
        party: m.party ?? null,
        constituency: m.constituency ?? null,
        imgUrl: mlaImg(m.personId),
        value,
        display: gbp(value),
        isCurrent: m.isCurrent,
        note: !m.isCurrent && m.mandateEnd ? `Left ${new Date(m.mandateEnd).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}` : undefined,
      }
    })
    .sort((a, b) => b.value - a.value)

  const ranked = rankRows(rows, r => r.value)
  const grand = rows.reduce((s, r) => s + r.value, 0)
  const top = rows[0]

  return (
    <RankingShell
      title="Overall cost"
      sub={<>Total estimated mandate salary plus all published expenses for every MLA of the {mandate.label} mandate, current and former. Salary estimates are based on published Assembly rates and may not reflect all personal circumstances.</>}
      stats={ratesPublished && rows.length > 0 ? [
        { tone: rankTones.purple, icon: Sigma, label: 'Combined cost', figure: gbp(grand), sub: `all ${rows.length} MLAs this mandate, current and former` },
        { tone: rankTones.amber, icon: Crown, label: 'Highest cost', figure: gbp(top.value), sub: formatMemberName(top.fullName) },
        { tone: rankTones.blue, icon: Calculator, label: 'Average per MLA', figure: gbp(grand / rows.length), sub: `across all ${rows.length} MLAs, current and former` },
      ] : []}
    >
      {ratesPublished ? (
        <OverallCostListClient rows={ranked} />
      ) : (
        <div className="notice-card">Overall cost figures for the {mandate.label} mandate are not yet available: the salary component depends on the Assembly&apos;s published pay rates, which have not been released for this mandate.</div>
      )}
    </RankingShell>
  )
}
