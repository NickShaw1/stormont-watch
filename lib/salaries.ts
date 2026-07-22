// Published salary rates, keyed by mandate.
// Source (2022-2027): https://www.niassembly.gov.uk/your-mlas/members-salaries-and-expenses/salaries-and-expenditure-rates/salaries-and-expenditure-rates-2022-2027/

import { CURRENT_MANDATE, mandateById } from './constants/mandates'

export type SalaryRole =
  | 'member'
  | 'commission'
  | 'committee_chair'
  | 'speaker'
  | 'deputy_speaker'
  | 'first_minister'
  | 'deputy_first_minister'
  | 'minister'
  | 'junior_minister'

export interface SalaryPeriod {
  start: string
  end: string | null
  isSuspension: boolean
  rates: Record<SalaryRole, number>
}

export const SALARY_PERIODS: SalaryPeriod[] = [
  {
    start: '2022-05-05',
    end: '2022-12-31',
    isSuspension: false,
    rates: {
      member: 51500,
      commission: 57500,
      committee_chair: 63500,
      speaker: 89500,
      deputy_speaker: 57500,
      first_minister: 123500,
      deputy_first_minister: 123500,
      minister: 89500,
      junior_minister: 57500,
    },
  },
  {
    start: '2023-01-01',
    end: '2024-02-03',
    isSuspension: true,
    rates: {
      member: 37338,
      commission: 42138,
      committee_chair: 37338,
      speaker: 57298,
      deputy_speaker: 38838,
      first_minister: 37338,
      deputy_first_minister: 37338,
      minister: 37338,
      junior_minister: 37338,
    },
  },
  {
    start: '2024-02-04',
    end: '2024-03-31',
    isSuspension: false,
    rates: {
      member: 52000,
      commission: 58000,
      committee_chair: 64000,
      speaker: 90000,
      deputy_speaker: 58000,
      first_minister: 124000,
      deputy_first_minister: 124000,
      minister: 90000,
      junior_minister: 58000,
    },
  },
  {
    start: '2024-04-01',
    end: '2025-03-31',
    isSuspension: false,
    rates: {
      member: 52500,
      commission: 58500,
      committee_chair: 64500,
      speaker: 90500,
      deputy_speaker: 58500,
      first_minister: 124500,
      deputy_first_minister: 124500,
      minister: 90500,
      junior_minister: 58500,
    },
  },
  {
    start: '2025-04-01',
    end: '2026-03-31',
    isSuspension: false,
    rates: {
      member: 53000,
      commission: 59000,
      committee_chair: 65000,
      speaker: 91000,
      deputy_speaker: 59000,
      first_minister: 125000,
      deputy_first_minister: 125000,
      minister: 91000,
      junior_minister: 59000,
    },
  },
  {
    start: '2026-04-01',
    end: '2027-05-06',
    isSuspension: false,
    rates: {
      member: 67200,
      commission: 73200,
      committee_chair: 79200,
      speaker: 105200,
      deputy_speaker: 73200,
      first_minister: 139200,
      deputy_first_minister: 139200,
      minister: 105200,
      junior_minister: 73200,
    },
  },
]

/**
 * Published pay rates keyed by mandate. A mandate appears here ONLY once its rates are
 * published; a mandate that is absent means rates are pending — the salary functions then
 * return null so the UI can show "rates pending" instead of a misleading £0 (fail loud).
 */
export const SALARY_PERIODS_BY_MANDATE: Record<string, SalaryPeriod[]> = {
  '2022-2027': SALARY_PERIODS,
}

/** True if published pay rates exist for the mandate. Pages gate salary/cost UI on this. */
export function salaryRatesPublished(mandate: string): boolean {
  return mandate in SALARY_PERIODS_BY_MANDATE
}

export const ROLE_PRIORITY: Record<SalaryRole, number> = {
  first_minister: 9,
  deputy_first_minister: 8,
  speaker: 7,
  minister: 6,
  junior_minister: 5,
  committee_chair: 4,
  deputy_speaker: 3,
  commission: 2,
  member: 1,
}

export function apiRoleToSalaryRole(
  roleType: string,
  role: string,
  organisation: string
): SalaryRole | null {
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

export interface RoleInterval {
  salaryRole: SalaryRole
  startDate: string
  endDate: string | null
}

export function calculateMandateEarnings(
  intervals: RoleInterval[],
  todayStr: string,
  mandate: string = CURRENT_MANDATE.id
): number | null {
  const periods = SALARY_PERIODS_BY_MANDATE[mandate]
  if (!periods) return null // rates pending for this mandate — fail loud, do not report £0

  const today = new Date(todayStr)
  // For an open-ended (ongoing) band, the pro-rating denominator is the mandate's end, or
  // today while the mandate is still running.
  const mandateEnd = mandateById(mandate)?.end
  const openBandEnd = mandateEnd ? new Date(mandateEnd) : today
  let total = 0

  // Find earliest role start — do not calculate earnings before this date
  const earliestStart = intervals.reduce((earliest, interval) => {
    return interval.startDate < earliest ? interval.startDate : earliest
  }, intervals[0]?.startDate ?? todayStr)

  for (const period of periods) {
    const periodStart = new Date(Math.max(
      new Date(period.start).getTime(),
      new Date(earliestStart).getTime()
    ))
    const fullPeriodStart = new Date(period.start)
    const periodEnd = period.end ? new Date(period.end) : today
    const effectivePeriodEnd = periodEnd < today ? periodEnd : today
    const fullPeriodEnd = period.end ? new Date(period.end) : openBandEnd
    const fullDaysInPeriod = (fullPeriodEnd.getTime() - fullPeriodStart.getTime()) / 86400000

    if (periodStart >= effectivePeriodEnd) continue

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

      if (bestPriority > 0) total += (period.rates[effectiveRole] * daysInSeg) / fullDaysInPeriod
    }
  }

  return Math.round(total)
}

export function getCurrentAnnualSalary(
  intervals: RoleInterval[],
  todayStr: string,
  mandate: string = CURRENT_MANDATE.id
): number | null {
  const periods = SALARY_PERIODS_BY_MANDATE[mandate]
  if (!periods) return null // rates pending for this mandate — fail loud, do not report £0

  const today = new Date(todayStr)

  const currentPeriod = periods.find(p => {
    const start = new Date(p.start)
    const end = p.end ? new Date(p.end) : null
    return start <= today && (end === null || end >= today)
  })

  // No band covers today (e.g. an archived mandate viewed after it ended) — not applicable.
  if (!currentPeriod) return null

  let bestRole: SalaryRole = 'member'
  let bestPriority = 0

  for (const interval of intervals) {
    const iStart = new Date(interval.startDate)
    const iEnd = interval.endDate ? new Date(interval.endDate) : null
    if (iStart <= today && (iEnd === null || iEnd > today)) {
      const priority = ROLE_PRIORITY[interval.salaryRole]
      if (priority > bestPriority) {
        bestPriority = priority
        bestRole = interval.salaryRole
      }
    }
  }

  return currentPeriod.rates[bestRole]
}
