// Checks that the same expenses and salary figures agree on every page of the site.
// Run: npm run verify:consistency   (needs DATABASE_URL in .env.local; read-only)
// Exits with a non-zero code if any figure disagrees, so it can gate a deploy.
//
// The site's rules, which this script enforces:
//   - An MLA's mandate expenses are the net sum of every published row (recoveries count).
//   - Ranks are standard competition ranks over everyone with expenses, current and former.
//   - Party expense figures cover current and former MLAs.
//   - Salary and earnings come from lib/salaries.ts for every page.

import { CURRENT_MANDATE } from '../lib/constants/mandates'
import {
  getAllExpensesLeagueTable, getExpensesByParty, getTotalExpensesPerMember, getAllMlaExpensesForLatestYear,
  getAllMandateMembers, getAllMemberRoleHistories, getMemberRoleHistory, getMandateExpensesRank, getAllMemberExpenses,
  getPartyExpenses, getPartyMandateExpenses, getAllPartiesWithStats,
} from '../lib/db/queries'
import { calculateMandateEarnings, getCurrentAnnualSalary, apiRoleToSalaryRole, type RoleInterval } from '../lib/salaries'

const mandate = process.argv[2] ?? CURRENT_MANDATE.id
const today = new Date().toISOString().slice(0, 10)

let checks = 0
const failures: string[] = []
function expect(label: string, page: unknown, other: unknown, tolerance = 0) {
  checks++
  const same = typeof page === 'number' && typeof other === 'number' ? Math.abs(page - other) <= tolerance : JSON.stringify(page) === JSON.stringify(other)
  if (!same) failures.push(`${label}: ${JSON.stringify(page)} vs ${JSON.stringify(other)}`)
}
const rankOf = (values: number[], v: number) => 1 + values.filter((x) => x > v).length
const toIntervals = (rows: { roleType: string; role: string; organisation: string | null; startDate: string; endDate: string | null }[]): RoleInterval[] =>
  rows
    .map((r) => {
      const salaryRole = apiRoleToSalaryRole(r.roleType, r.role, r.organisation ?? '')
      return salaryRole ? { salaryRole, startDate: r.startDate, endDate: r.endDate ?? null } : null
    })
    .filter((r): r is RoleInterval => r !== null)

async function main() {
  const [league, totals, byParty, allLatest, mandateMembers, allRoles, parties] = await Promise.all([
    getAllExpensesLeagueTable(mandate),
    getTotalExpensesPerMember(mandate),
    getExpensesByParty(mandate),
    getAllMlaExpensesForLatestYear(mandate),
    getAllMandateMembers(mandate),
    getAllMemberRoleHistories(mandate),
    getAllPartiesWithStats(mandate),
  ])
  const totalMap = new Map(totals.map((r) => [r.personId, parseFloat(r.totalExpenses)]))
  const rolesByPerson = new Map<string, typeof allRoles>()
  for (const r of allRoles) rolesByPerson.set(r.personId, [...(rolesByPerson.get(r.personId) ?? []), r])

  // 1. Salary and earnings: the profile's role-history path and the list pages' path must agree.
  for (const m of mandateMembers) {
    const viaProfile = toIntervals((await getMemberRoleHistory(m.personId, mandate)) as never)
    const viaLists = toIntervals((rolesByPerson.get(m.personId) ?? []) as never)
    expect(`earnings ${m.fullName}`, calculateMandateEarnings(viaProfile, today, mandate), calculateMandateEarnings(viaLists, today, mandate))
    expect(`current salary ${m.fullName}`, getCurrentAnnualSalary(viaProfile, today, mandate), getCurrentAnnualSalary(viaLists, today, mandate))
  }

  // 2 and 3. Each MLA: the profile's mandate total and ranks equal the Expenses page and the other lists.
  const leagueByPerson = new Map<string, typeof league>()
  for (const r of league) leagueByPerson.set(r.personId, [...(leagueByPerson.get(r.personId) ?? []), r])
  for (const [personId, rows] of leagueByPerson) {
    const name = rows[0].fullName
    const profileRows = (await getAllMemberExpenses(personId, mandate)) as { financial_year: string; total: string | null; rank: number | null; total_members: number | null }[]
    const profileTotal = profileRows.reduce((s, r) => s + (parseFloat(r.total ?? '0') || 0), 0)
    expect(`mandate expenses ${name}`, profileTotal, totalMap.get(personId) ?? 0, 0.005)
    const profileRank = await getMandateExpensesRank(personId, mandate)
    expect(`mandate rank ${name}`, profileRank ? Number(profileRank.rank) : null, rows[0].mandateRank)
    expect(`mandate rank pool ${name}`, profileRank ? Number(profileRank.total_members) : null, rows[0].mandatePool)
    for (const pr of profileRows) {
      const lr = rows.find((r) => r.financialYear === pr.financial_year)
      expect(`${pr.financial_year} rank ${name}`, pr.rank === null ? null : Number(pr.rank), lr?.yearRank ?? null)
      expect(`${pr.financial_year} rank pool ${name}`, pr.total_members === null ? null : Number(pr.total_members), lr?.yearPool ?? null)
    }
  }

  // 4. Parties, whole mandate: the party page equals the Spending page's totals, counts and ranks.
  const partyMap = new Map<string, { total: number; count: number }>()
  for (const m of mandateMembers) {
    if (!m.party) continue
    const p = partyMap.get(m.party) ?? { total: 0, count: 0 }
    p.total += totalMap.get(m.personId) ?? 0
    if (totalMap.has(m.personId)) p.count++
    partyMap.set(m.party, p)
  }
  const spendMandate = [...partyMap.entries()].filter(([, v]) => v.total > 0).map(([party, v]) => ({ party, total: v.total, count: v.count, avg: v.count ? v.total / v.count : 0 }))
  for (const p of parties) {
    const page = await getPartyMandateExpenses(p.party, mandate)
    const spend = spendMandate.find((s) => s.party === p.party)
    if (!page || !spend) continue
    expect(`mandate total ${p.party}`, page.mandateTotal, spend.total, 0.01)
    expect(`mandate count ${p.party}`, page.mlaCount, spend.count)
    expect(`mandate total rank ${p.party}`, page.rankTotal, rankOf(spendMandate.map((s) => s.total), spend.total))
    expect(`mandate average rank ${p.party}`, page.rankAvg, rankOf(spendMandate.map((s) => s.avg), spend.avg))
  }

  // 5. Parties, latest year: the party page equals the Spending page's party cards.
  const spendLatest = byParty.map((r) => ({ party: r.party, total: Number(r.party_total), avg: Number(r.per_mla_avg) }))
  for (const p of parties) {
    const page = await getPartyExpenses(p.party, mandate)
    const spend = spendLatest.find((s) => s.party === p.party)
    if (!page || !spend) continue
    expect(`latest-year total ${p.party}`, page.partyTotal, spend.total, 0.01)
    expect(`latest-year average ${p.party}`, page.avgPerMla, spend.avg, 0.01)
    expect(`latest-year total rank ${p.party}`, page.rankTotal, rankOf(spendLatest.map((s) => s.total), spend.total))
    expect(`latest-year average rank ${p.party}`, page.rankAvg, rankOf(spendLatest.map((s) => s.avg), spend.avg))
  }

  // 6. Site-wide totals: Homepage, Spending page, Stats hub and the party cards all add up to the same figures.
  const latestYear = league.map((r) => r.financialYear).sort().pop() ?? ''
  const hubLatest = league.filter((r) => r.financialYear === latestYear).reduce((s, r) => s + parseFloat(r.total ?? '0'), 0)
  expect(`latest-year total: Stats hub vs Spending "Current & former total"`, hubLatest, allLatest.total, 0.01)
  expect(`latest-year total: party cards vs Spending "Current & former total"`, spendLatest.reduce((s, r) => s + r.total, 0), allLatest.total, 0.01)
  const homeTotal = totals.reduce((s, r) => s + parseFloat(r.totalExpenses), 0)
  expect('mandate total: Homepage vs Spending grand total', homeTotal, spendMandate.reduce((s, r) => s + r.total, 0), 0.01)
  expect('mandate total: Homepage vs every row on the Expenses page', homeTotal, league.reduce((s, r) => s + parseFloat(r.total ?? '0'), 0), 0.01)

  console.log(`Consistency check for ${mandate} as of ${today}: ${checks} comparisons, ${failures.length} failures`)
  for (const f of failures.slice(0, 50)) console.log('  FAIL', f)
  if (failures.length > 50) console.log(`  ...and ${failures.length - 50} more`)
  process.exit(failures.length === 0 ? 0 : 1)
}

main().catch((err) => { console.error(err); process.exit(1) })
