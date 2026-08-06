import { PoundSterling } from 'lucide-react'
import { getAllMembers, getAllMemberRoleHistories, getTotalExpensesPerMember, mlaImg } from '@/lib/db/queries'
import { calculateMandateEarnings, apiRoleToSalaryRole, salaryRatesPublished, hasServedOneYear, type RoleInterval } from '@/lib/salaries'
import OverallCostListClient from './OverallCostListClient'
import StatsBreadcrumb from '../stats/StatsBreadcrumb'
import styles from '../expenses/expenses.module.css'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'

// Shared by the live route and archive routes; mandate/basePath vary per route.
export default async function OverallCostPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [allMembers, allRoleHistories, totalExpensesData] = await Promise.all([
    getAllMembers(mandate.id),
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

  const rows = allMembers
    .filter(m => m.mandateStart && hasServedOneYear(m.mandateStart, today))
    .map(m => {
      const history = rolesByPerson.get(m.personId) ?? []
      const roleIntervals: RoleInterval[] = history
        .map(r => {
          const salaryRole = apiRoleToSalaryRole(r.roleType, r.role, r.organisation ?? '')
          if (!salaryRole) return null
          return { salaryRole, startDate: r.startDate, endDate: r.endDate ?? null }
        })
        .filter((r): r is RoleInterval => r !== null)

      const mandateEarnings = calculateMandateEarnings(roleIntervals, today, mandate.id) ?? 0
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
      <header className={styles.pageHeader}>
        <StatsBreadcrumb label="Overall cost" basePath={basePath} />
        <span className={styles.pageHeaderEyebrow}>Rankings</span>
        <h1 className={styles.pageHeaderTitle}>
          <PoundSterling className={styles.pageHeaderIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
          Overall cost
        </h1>
        <p className={styles.lede}>Total estimated mandate salary plus all published expenses for every {sittingAdjective(mandate)} MLA. MLAs who joined within the last year are excluded as their figures are not comparable. Salary estimates are based on published Assembly rates and may not reflect all personal circumstances.</p>
      </header>

      {ratesPublished ? (
        <OverallCostListClient rows={rows} />
      ) : (
        <div className="notice-card">Overall cost figures for the {mandate.label} mandate are not yet available: the salary component depends on the Assembly&apos;s published pay rates, which have not been released for this mandate.</div>
      )}
    </div>
  )
}
