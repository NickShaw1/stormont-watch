export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { members } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ constituency: string }> }
) {
  const { constituency: rawConstituency } = await params
  const constituency = decodeURIComponent(rawConstituency)
  const mlas = await db
    .select({
      personId: members.personId,
      fullName: members.fullName,
      party: members.party,
      imgUrl: members.imgUrl,
    })
    .from(members)
    .where(and(
      eq(members.constituency, constituency),
      eq(members.isCurrent, true)
    ))
  return NextResponse.json(mlas)
}
