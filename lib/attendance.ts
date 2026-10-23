export type AttendanceGrade = 'good' | 'low' | 'poor'

interface AttendanceSource {
  assembly_role: string | null
  assembly_role_end: string | null
  attendance_pct: number | string | null
}

export function attendanceFloor(mlas: AttendanceSource[], average: number): number {
  const values = mlas
    .filter((m) => !(m.assembly_role === 'Speaker' && !m.assembly_role_end) && m.attendance_pct !== null)
    .map((m) => Number(m.attendance_pct))
  const spread = values.length
    ? Math.sqrt(values.reduce((a, b) => a + (b - average) ** 2, 0) / values.length)
    : 0
  return average - spread
}

export function gradeAttendance(pct: number, average: number, floor: number): AttendanceGrade {
  if (pct >= average) return 'good'
  if (pct >= floor) return 'low'
  return 'poor'
}
