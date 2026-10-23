// Prints each party's estimated salary cost plus published expenses for a mandate, as of today.
// Run: npx tsx --env-file=.env.local scripts/mandate-cost-breakdown.ts [mandate-id]
// Uses the same salary logic as the site (lib/salaries.ts), so the figures match the pages.

import { neon } from '@neondatabase/serverless'
import { CURRENT_MANDATE } from '../lib/constants/mandates'
import { calculateMandateEarnings, apiRoleToSalaryRole, salaryRatesPublished, type RoleInterval } from '../lib/salaries'

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) throw new Error('DATABASE_URL not set')

const mandate = process.argv[2] ?? CURRENT_MANDATE.id
const today = new Date().toISOString().slice(0, 10)
const sql = neon(dbUrl)

type PartyStats = { memberCount: number; salaryTotal: number; expensesTotal: number }

async function run() {
  if (!salaryRatesPublished(mandate)) throw new Error(`No published pay rates for ${mandate} yet`)

  const members = await sql`
    SELECT person_id, full_name, party FROM members WHERE mandate = ${mandate} ORDER BY full_name
  `
  const roleRows = await sql`
    SELECT person_id, role, role_type, organisation, start_date::text AS start_date, end_date::text AS end_date
    FROM member_role_history WHERE mandate = ${mandate} ORDER BY person_id, start_date
  `
  const expenseRows = await sql`
    SELECT m.person_id, SUM(e.total) AS total_expenses
    FROM expenses e
    JOIN members m ON m.person_id = e.person_id AND m.mandate = ${mandate}
    WHERE e.mandate = ${mandate} AND e.total IS NOT NULL
    GROUP BY m.person_id
  `

  const rolesByPerson = new Map<string, typeof roleRows>()
  for (const row of roleRows) rolesByPerson.set(row.person_id, [...(rolesByPerson.get(row.person_id) ?? []), row])
  const expensesByPerson = new Map(expenseRows.map((r) => [r.person_id as string, Number(r.total_expenses)]))

  const parties = new Map<string, PartyStats>()
  let withoutRoles = 0
  for (const m of members) {
    const party = (m.party as string | null) ?? 'Independent'
    const intervals: RoleInterval[] = (rolesByPerson.get(m.person_id) ?? [])
      .map((r) => {
        const salaryRole = apiRoleToSalaryRole(r.role_type, r.role, r.organisation ?? '')
        return salaryRole ? { salaryRole, startDate: r.start_date as string, endDate: (r.end_date as string | null) ?? null } : null
      })
      .filter((r): r is RoleInterval => r !== null)
    if (intervals.length === 0) withoutRoles++

    const stats = parties.get(party) ?? { memberCount: 0, salaryTotal: 0, expensesTotal: 0 }
    stats.memberCount++
    stats.salaryTotal += calculateMandateEarnings(intervals, today, mandate) ?? 0
    stats.expensesTotal += expensesByPerson.get(m.person_id) ?? 0
    parties.set(party, stats)
  }

  const fmt = (n: number) => '£' + Math.round(n).toLocaleString('en-GB')
  console.log(`\n=== ${mandate} MANDATE COST BREAKDOWN (as of ${today}) ===\n`)
  console.log(`${'Party'.padEnd(45)} ${'MLAs'.padStart(5)} ${'Salary'.padStart(16)} ${'Expenses'.padStart(16)} ${'Combined'.padStart(16)}`)
  console.log('-'.repeat(102))

  let salary = 0
  let expenses = 0
  for (const [party, s] of [...parties.entries()].sort((a, b) => b[1].salaryTotal - a[1].salaryTotal)) {
    salary += s.salaryTotal
    expenses += s.expensesTotal
    console.log(`${party.padEnd(45)} ${String(s.memberCount).padStart(5)} ${fmt(s.salaryTotal).padStart(16)} ${fmt(s.expensesTotal).padStart(16)} ${fmt(s.salaryTotal + s.expensesTotal).padStart(16)}`)
  }
  console.log('-'.repeat(102))
  console.log(`${'TOTAL'.padEnd(45)} ${String(members.length).padStart(5)} ${fmt(salary).padStart(16)} ${fmt(expenses).padStart(16)} ${fmt(salary + expenses).padStart(16)}`)
  console.log(`\nMembers with no salary-relevant role history: ${withoutRoles}`)
}

run().catch((err) => { console.error(err); process.exit(1) })
