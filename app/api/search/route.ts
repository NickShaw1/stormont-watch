import { NextResponse } from 'next/server'
import { getAllMembers, getAllDivisionsForList, getAllBills } from '@/lib/db/queries'
import { isPassed } from '@/lib/bills'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'

export const dynamic = 'force-static'
export const revalidate = 86400

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

export async function GET() {
  const [members, divisions, bills] = await Promise.all([
    getAllMembers(),
    getAllDivisionsForList(),
    getAllBills(),
  ])

  const mlas = members.map((m) => ({
    type: 'mla' as const,
    id: m.personId,
    name: m.fullName,
    party: m.party ?? '',
    constituency: m.constituency ?? '',
    href: `/assembly/mlas/${m.personId}`,
  }))

  const votes = divisions.map((d) => {
    const { title } = formatDivisionSubject(d.subject ?? '')
    return {
      type: 'vote' as const,
      id: d.documentId,
      title,
      date: d.divisionDate instanceof Date
        ? d.divisionDate.toISOString().slice(0, 10)
        : String(d.divisionDate).slice(0, 10),
      passed: isPassed(d.outcome ?? null),
      href: `/assembly/divisions/${d.documentId}`,
    }
  })

  const legislation = bills.map((b) => ({
    type: 'bill' as const,
    id: b.bill_id,
    title: b.short_title,
    stage: b.display_stage ?? b.current_stage,
    href: `/assembly/bills/${billSlug(b.bill_id)}`,
  }))

  return NextResponse.json({ mlas, votes, legislation })
}
