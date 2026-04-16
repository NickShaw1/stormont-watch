'use server'

import { getMembersByConstituency } from '@/lib/db/queries'

export async function fetchMLAsForConstituency(constituency: string) {
  return getMembersByConstituency(constituency)
}
