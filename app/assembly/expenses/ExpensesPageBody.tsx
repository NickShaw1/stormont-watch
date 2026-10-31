import { Coins, Crown, UserX } from 'lucide-react'
import { getAllExpensesLeagueTable, getMlasWithoutExpenses } from '@/lib/db/queries'
import { formatMemberName, gbp } from '@/lib/format'
import { financialYearEnd } from '@/lib/constituencies'
import ExpensesListClient from './ExpensesListClient'
import RankingShell, { rankTones } from '../stats/RankingShell'
import type { Mandate } from '@/lib/constants/mandates'

// Shared by the live route and archive routes; mandate/basePath vary per route.
export default async function ExpensesPageBody({
  mandate,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [allRows, missing] = await Promise.all([
    getAllExpensesLeagueTable(mandate.id),
    getMlasWithoutExpenses(mandate.id),
  ])

  const years = [...new Set(allRows.map(r => r.financialYear as string))].sort((a, b) => b.localeCompare(a))
  const latestYear = years[0] ?? null

  const mappedRows = allRows.map(r => ({
    personId: r.personId as string,
    fullName: r.fullName as string,
    party: r.party as string | null,
    constituency: r.constituency as string | null,
    imgUrl: r.imgUrl as string | null,
    mandateStart: r.mandateStart as string | null,
    mandateEnd: r.mandateEnd as string | null,
    isCurrent: r.isCurrent as boolean,
    total: r.total as string | null,
    period: r.period as string | null,
    financialYear: r.financialYear as string,
    yearRank: r.yearRank,
    yearPool: r.yearPool,
    mandateRank: r.mandateRank,
    mandatePool: r.mandatePool,
  }))

  const byPerson = new Map<string, { name: string; total: number }>()
  for (const r of mappedRows) {
    const e = byPerson.get(r.personId) ?? { name: r.fullName, total: 0 }
    e.total += parseFloat(r.total ?? '0')
    byPerson.set(r.personId, e)
  }
  const people = [...byPerson.values()].sort((a, b) => b.total - a.total)
  const grand = people.reduce((s, p) => s + p.total, 0)

  const missingRows = missing.map(m => ({
    id: m.person_id,
    fullName: m.full_name,
    party: m.party,
    constituency: m.constituency,
    imgUrl: m.img_url,
    value: 0,
    display: 'No data',
    rank: '-',
    note: !m.is_current && m.mandate_end ? `Left ${new Date(m.mandate_end).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}` : undefined,
  }))

  return (
    <RankingShell
      title="MLA expenses"
      sub="Expenses claimed by every MLA with published expenses, current and former: staff costs, constituency office costs, allowances (including travel allowances) and other expenses."
      stats={people.length > 0 ? [
        { tone: rankTones.amber, icon: Coins, label: 'Total claimed', figure: gbp(grand), sub: `${people.length} MLAs, all published years` },
        { tone: rankTones.coral, icon: Crown, label: 'Highest claimant', figure: gbp(people[0].total), sub: `${formatMemberName(people[0].name)}, all published years` },
        { tone: rankTones.indigo, icon: UserX, label: 'No record', figure: missing.length, sub: missing.length === 1 ? 'MLA has no expenses on record' : 'MLAs have no expenses on record' },
      ] : []}
    >
      <ExpensesListClient rows={mappedRows} years={years} latestYear={latestYear} missing={missingRows} windowStart={mandate.start} windowEnd={latestYear ? financialYearEnd(latestYear) : null} />
    </RankingShell>
  )
}
