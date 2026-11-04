export interface MlaRowSource {
  person_id: string
  full_name: string
  party: string | null
  constituency: string | null
  img_url: string | null
  assembly_role: string | null
  assembly_role_end: string | null
  attendance_pct: number | string | null
}

export type AttendanceGradeOrNa = 'good' | 'low' | 'poor' | 'na'

export function buildRoleLookup(
  ministers: { personId: string; roleTitle: string | null }[],
  chairs: { personId: string }[],
): Record<string, string> {
  const roleLookup: Record<string, string> = {}
  for (const m of ministers) {
    if (m.roleTitle === 'First Minister') {
      roleLookup[m.personId] = 'First Minister'
    } else if (m.roleTitle === 'deputy First Minister') {
      roleLookup[m.personId] = 'Deputy FM'
    } else if (m.roleTitle?.toLowerCase() === 'junior minister') {
      roleLookup[m.personId] = 'Junior Minister'
    } else {
      roleLookup[m.personId] = 'Minister'
    }
  }
  for (const c of chairs) {
    if (!roleLookup[c.personId]) roleLookup[c.personId] = 'Chair'
  }
  return roleLookup
}

export function rolesOf(m: Pick<MlaRowSource, 'person_id' | 'assembly_role' | 'assembly_role_end'>, roleLookup: Record<string, string>): string[] {
  const roles: string[] = []
  if (m.assembly_role && !m.assembly_role_end) {
    roles.push(m.assembly_role.replace(/\bPrincipal Deputy\b/g, 'Pr. Dep.').replace(/\bPrincipal\b/g, 'Pr.'))
  }
  const other = roleLookup[m.person_id]
  if (other && !roles.some((r) => r.toLowerCase() === other.toLowerCase())) roles.push(other)
  return roles
}

export function attendanceGradeOf(
  attendance: number | null,
  attendanceNa: boolean,
  average: number,
  floor: number,
): AttendanceGradeOrNa {
  if (attendanceNa || attendance === null) return 'na'
  if (attendance >= average) return 'good'
  if (attendance >= floor) return 'low'
  return 'poor'
}
