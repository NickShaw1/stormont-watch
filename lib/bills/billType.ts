export type BillTypeKey = 'executive' | 'private' | 'committee' | 'other'

export function billTypeKey(billType: string | null): BillTypeKey {
  const t = (billType ?? '').toLowerCase()
  if (t.startsWith('executive')) return 'executive'
  if (t.startsWith('private')) return 'private'
  if (t.startsWith('committee')) return 'committee'
  return 'other'
}
