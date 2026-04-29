import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { calculateMandateEarnings, SALARY_PERIODS, apiRoleToSalaryRole, ROLE_PRIORITY, type RoleInterval, type SalaryRole } from '../lib/salaries'

const CURRENT_MANDATE = '2022-2027'
const PERSON_IDS = ['216', '5595', '5800']

function pad(s: string, n: number) { return s.padEnd(n) }
function gbp(n: number) { return `£${Math.round(n).toLocaleString('en-GB')}` }

function verboseEarnings(intervals: RoleInterval[], todayStr: string): number {
  const today = new Date(todayStr)
  let total = 0

  const earliestStart = intervals.reduce((earliest, interval) => {
    return interval.startDate < earliest ? interval.startDate : earliest
  }, intervals[0]?.startDate ?? todayStr)

  for (const period of SALARY_PERIODS) {
    const periodStart = new Date(Math.max(
      new Date(period.start).getTime(),
      new Date(earliestStart).getTime()
    ))
    const fullPeriodStart = new Date(period.start)
    const periodEnd = period.end ? new Date(period.end) : today
    const effectivePeriodEnd = periodEnd < today ? periodEnd : today
    const fullPeriodEnd = period.end ? new Date(period.end) : new Date('2027-05-06')
    const fullDaysInPeriod = (fullPeriodEnd.getTime() - fullPeriodStart.getTime()) / 86400000

    if (periodStart >= effectivePeriodEnd) continue

    console.log(`\n  ── Period: ${period.start} → ${period.end ?? 'present'}${period.isSuspension ? ' [SUSPENSION]' : ''} (${Math.round(fullDaysInPeriod)} days total)`)

    const boundaries = new Set<number>()
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

      let bestRole: SalaryRole = 'member'
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

      let effectiveRole: SalaryRole = bestRole
      if (period.isSuspension) {
        if (bestRole !== 'speaker' && bestRole !== 'deputy_speaker' && bestRole !== 'commission') {
          effectiveRole = 'member'
        }
      }

      const rate = period.rates[effectiveRole]
      const segEarnings = (rate * daysInSeg) / fullDaysInPeriod
      total += segEarnings

      const roleDisplay = effectiveRole !== bestRole ? `${bestRole} → ${effectiveRole} (suspension)` : effectiveRole
      console.log(
        `    ${pad(segStart.toISOString().slice(0, 10), 12)} → ${pad(segEnd.toISOString().slice(0, 10), 12)}` +
        `  ${pad(String(Math.round(daysInSeg)) + 'd', 6)}` +
        `  role: ${pad(roleDisplay, 30)}` +
        `  rate: ${pad(gbp(rate) + '/yr', 12)}` +
        `  segment: ${gbp(segEarnings)}`
      )
    }
  }

  return Math.round(total)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  const sql = neon(url)
  const db = drizzle(sql, { schema })
  const today = new Date().toISOString().slice(0, 10)

  for (const personId of PERSON_IDS) {
    console.log(`\n${'='.repeat(80)}`)

    const member = await db
      .select({ fullName: schema.members.fullName, party: schema.members.party })
      .from(schema.members)
      .where(eq(schema.members.personId, personId))
      .limit(1)

    const name = member[0]?.fullName ?? `Person ${personId}`
    const party = member[0]?.party ?? 'Unknown'
    console.log(`PERSON ${personId}: ${name} (${party})`)

    const roleRows = await db
      .select()
      .from(schema.memberRoleHistory)
      .where(and(
        eq(schema.memberRoleHistory.personId, personId),
        eq(schema.memberRoleHistory.mandate, CURRENT_MANDATE)
      ))

    console.log(`\n  Role history (${roleRows.length} rows):`)
    for (const r of roleRows) {
      console.log(`    [${r.affiliationId}] ${r.roleType} / ${r.role} / ${r.organisation ?? '-'} | ${r.startDate} → ${r.endDate ?? 'present'}`)
    }

    const intervals: RoleInterval[] = roleRows
      .map(r => {
        const salaryRole = apiRoleToSalaryRole(r.roleType, r.role, r.organisation ?? '')
        if (!salaryRole) return null
        return { salaryRole, startDate: r.startDate, endDate: r.endDate ?? null }
      })
      .filter((r): r is RoleInterval => r !== null)

    console.log(`\n  Mapped to ${intervals.length} salary interval(s):`)
    for (const iv of intervals) {
      console.log(`    ${iv.salaryRole} | ${iv.startDate} → ${iv.endDate ?? 'present'}`)
    }

    if (intervals.length === 0) {
      console.log('\n  No salary intervals — earnings: £0')
      continue
    }

    console.log('\n  Segment-by-segment breakdown:')
    const total = verboseEarnings(intervals, today)
    console.log(`\n  TOTAL MANDATE EARNINGS: ${gbp(total)}`)
  }

  console.log(`\n${'='.repeat(80)}`)
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
