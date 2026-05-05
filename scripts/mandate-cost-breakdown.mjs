// mandate-cost-breakdown.mjs
// Run: node --env-file=.env.local scripts/mandate-cost-breakdown.mjs

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'

const TODAY = '2026-05-05'
const KNOWN_EXPENSES_TOTAL = 39368902.32

// ---- inline salary logic (copied from lib/salaries.ts) ----
const SALARY_PERIODS = [
  { start: '2022-05-05', end: '2022-12-31', isSuspension: false, rates: { member:51500, commission:57500, committee_chair:63500, speaker:89500, deputy_speaker:57500, first_minister:123500, deputy_first_minister:123500, minister:89500, junior_minister:57500 } },
  { start: '2023-01-01', end: '2024-02-03', isSuspension: true,  rates: { member:37338, commission:42138, committee_chair:37338, speaker:57298, deputy_speaker:38838, first_minister:37338, deputy_first_minister:37338, minister:37338, junior_minister:37338 } },
  { start: '2024-02-04', end: '2024-03-31', isSuspension: false, rates: { member:52000, commission:58000, committee_chair:64000, speaker:90000, deputy_speaker:58000, first_minister:124000, deputy_first_minister:124000, minister:90000, junior_minister:58000 } },
  { start: '2024-04-01', end: '2025-03-31', isSuspension: false, rates: { member:52500, commission:58500, committee_chair:64500, speaker:90500, deputy_speaker:58500, first_minister:124500, deputy_first_minister:124500, minister:90500, junior_minister:58500 } },
  { start: '2025-04-01', end: '2026-03-31', isSuspension: false, rates: { member:53000, commission:59000, committee_chair:65000, speaker:91000, deputy_speaker:59000, first_minister:125000, deputy_first_minister:125000, minister:91000, junior_minister:59000 } },
  { start: '2026-04-01', end: '2027-05-06', isSuspension: false, rates: { member:67200, commission:73200, committee_chair:79200, speaker:105200, deputy_speaker:73200, first_minister:139200, deputy_first_minister:139200, minister:105200, junior_minister:73200 } },
]

const ROLE_PRIORITY = { first_minister:9, deputy_first_minister:8, speaker:7, minister:6, junior_minister:5, committee_chair:4, deputy_speaker:3, commission:2, member:1 }

function apiRoleToSalaryRole(roleType, role, organisation) {
  if (role === 'First Minister and deputy First Minister') return null
  if (roleType === 'Assembly Membership Role') {
    if (role === 'MLA') return 'member'
    if (role === 'Speaker') return 'speaker'
    if (role === 'Deputy Speaker' || role === 'Principal Deputy Speaker') return 'deputy_speaker'
  }
  if (roleType === 'Ministerial Role') {
    if (role === 'First Minister') return 'first_minister'
    if (role === 'deputy First Minister') return 'deputy_first_minister'
    if (role === 'Minister') return 'minister'
    if (role === 'junior Minister') return 'junior_minister'
  }
  if (roleType === 'Committee Role (incl Assembly Commission)') {
    if (organisation === 'Northern Ireland Assembly Commission') return 'commission'
    if (role === 'Committee Chair') return 'committee_chair'
  }
  return null
}

function calculateMandateEarnings(intervals, todayStr) {
  const today = new Date(todayStr)
  let total = 0
  const earliestStart = intervals.reduce((earliest, interval) => {
    return interval.startDate < earliest ? interval.startDate : earliest
  }, intervals[0]?.startDate ?? todayStr)

  for (const period of SALARY_PERIODS) {
    const periodStart = new Date(Math.max(new Date(period.start).getTime(), new Date(earliestStart).getTime()))
    const fullPeriodStart = new Date(period.start)
    const periodEnd = period.end ? new Date(period.end) : today
    const effectivePeriodEnd = periodEnd < today ? periodEnd : today
    const fullPeriodEnd = period.end ? new Date(period.end) : new Date('2027-05-06')
    const fullDaysInPeriod = (fullPeriodEnd.getTime() - fullPeriodStart.getTime()) / 86400000

    if (periodStart >= effectivePeriodEnd) continue

    const boundaries = new Set()
    boundaries.add(periodStart.getTime())
    boundaries.add(effectivePeriodEnd.getTime())

    for (const interval of intervals) {
      const iStart = new Date(interval.startDate).getTime()
      const iEnd = interval.endDate ? new Date(interval.endDate).getTime() : today.getTime()
      if (iStart > periodStart.getTime() && iStart < effectivePeriodEnd.getTime()) boundaries.add(iStart)
      if (iEnd > periodStart.getTime() && iEnd < effectivePeriodEnd.getTime()) boundaries.add(iEnd)
    }

    const sorted = Array.from(boundaries).sort((a, b) => a - b)

    for (let i = 0; i < sorted.length - 1; i++) {
      const segStart = new Date(sorted[i])
      const segEnd = new Date(sorted[i + 1])
      const midpoint = new Date((segStart.getTime() + segEnd.getTime()) / 2)
      const daysInSeg = (segEnd.getTime() - segStart.getTime()) / 86400000

      let bestRole = 'member'
      let bestPriority = 0
      for (const interval of intervals) {
        const iStart = new Date(interval.startDate)
        const iEnd = interval.endDate ? new Date(interval.endDate) : today
        if (iStart <= midpoint && iEnd > midpoint) {
          const priority = ROLE_PRIORITY[interval.salaryRole]
          if (priority > bestPriority) {
            bestPriority = priority
            bestRole = interval.salaryRole
          }
        }
      }

      let effectiveRole = bestRole
      if (period.isSuspension) {
        if (bestRole !== 'speaker' && bestRole !== 'deputy_speaker' && bestRole !== 'commission') {
          effectiveRole = 'member'
        }
      }

      if (bestPriority > 0) total += (period.rates[effectiveRole] * daysInSeg) / fullDaysInPeriod
    }
  }

  return Math.round(total)
}

// ---- main ----
const dbUrl = process.env.DATABASE_URL
if (!dbUrl) throw new Error('DATABASE_URL not set')

const sql = neon(dbUrl)

async function run() {
  // 1. Get all mandate members
  const membersRows = await sql`
    SELECT person_id, full_name, party, is_current
    FROM members
    WHERE mandate = '2022-2027'
    ORDER BY full_name
  `

  // 2. Get all role histories in one query
  const allRoleHistory = await sql`
    SELECT person_id, role, role_type, organisation, start_date, end_date
    FROM member_role_history
    ORDER BY person_id, start_date
  `

  // 3. Group role history by personId
  const rolesByPerson = {}
  for (const row of allRoleHistory) {
    if (!rolesByPerson[row.person_id]) rolesByPerson[row.person_id] = []
    rolesByPerson[row.person_id].push(row)
  }

  // 4. Get expenses by person
  const expensesRows = await sql`
    SELECT e.person_id, m.party, SUM(e.total) as total_expenses
    FROM expenses e
    JOIN members m ON m.person_id = e.person_id
    WHERE m.mandate = '2022-2027'
    AND e.total IS NOT NULL
    GROUP BY e.person_id, m.party
  `
  const expensesByPerson = {}
  for (const row of expensesRows) {
    expensesByPerson[row.person_id] = Number(row.total_expenses)
  }

  // 5. Calculate per-member salary
  const partyStats = {}
  let grandSalaryTotal = 0

  for (const member of membersRows) {
    const pid = member.person_id
    const party = member.party || 'Independent'
    const historyRows = rolesByPerson[pid] || []

    // Convert to RoleIntervals
    const intervals = []
    for (const row of historyRows) {
      const salaryRole = apiRoleToSalaryRole(row.role_type, row.role, row.organisation)
      if (!salaryRole) continue
      intervals.push({
        salaryRole,
        startDate: row.start_date,
        endDate: row.end_date || null,
      })
    }

    const earnings = calculateMandateEarnings(intervals, TODAY)
    grandSalaryTotal += earnings

    if (!partyStats[party]) {
      partyStats[party] = { memberCount: 0, salaryTotal: 0, expensesTotal: 0, members: [] }
    }
    partyStats[party].memberCount++
    partyStats[party].salaryTotal += earnings
    partyStats[party].members.push({ fullName: member.full_name, earnings })
  }

  // 6. Add expenses by party
  for (const row of expensesRows) {
    const party = row.party || 'Independent'
    if (!partyStats[party]) partyStats[party] = { memberCount: 0, salaryTotal: 0, expensesTotal: 0, members: [] }
    partyStats[party].expensesTotal += Number(row.total_expenses)
  }

  // 7. Output
  const fmt = (n) => '£' + Math.round(n).toLocaleString('en-GB')

  console.log('\n=== 2022-2027 MANDATE COST BREAKDOWN (as of 2026-05-05) ===\n')
  console.log(`${'Party'.padEnd(45)} ${'MLAs'.padStart(5)} ${'Salary Total'.padStart(18)} ${'Expenses Total'.padStart(18)} ${'Combined'.padStart(18)}`)
  console.log('-'.repeat(110))

  const sortedParties = Object.entries(partyStats).sort((a, b) => b[1].salaryTotal - a[1].salaryTotal)
  let grandExpenses = 0

  for (const [party, stats] of sortedParties) {
    grandExpenses += stats.expensesTotal
    const combined = stats.salaryTotal + stats.expensesTotal
    console.log(`${party.padEnd(45)} ${String(stats.memberCount).padStart(5)} ${fmt(stats.salaryTotal).padStart(18)} ${fmt(stats.expensesTotal).padStart(18)} ${fmt(combined).padStart(18)}`)
  }

  console.log('-'.repeat(110))
  const grandCombined = grandSalaryTotal + grandExpenses
  console.log(`${'GRAND TOTAL'.padEnd(45)} ${String(membersRows.length).padStart(5)} ${fmt(grandSalaryTotal).padStart(18)} ${fmt(grandExpenses).padStart(18)} ${fmt(grandCombined).padStart(18)}`)

  console.log('\n--- Using known expenses total of £39,368,902.32 ---')
  const correctedTotal = grandSalaryTotal + KNOWN_EXPENSES_TOTAL
  console.log(`Salary total:   ${fmt(grandSalaryTotal)}`)
  console.log(`Expenses total: £39,368,902`)
  console.log(`CORRECTED OVERALL MANDATE COST: ${fmt(correctedTotal)}`)

  // Member count check
  console.log(`\nTotal members in mandate: ${membersRows.length}`)
  console.log(`Members with zero salary (no role history): ${membersRows.filter(m => {
    const h = rolesByPerson[m.person_id] || []
    return h.length === 0
  }).length}`)
}

run().catch(err => { console.error(err); process.exit(1) })
