export type ImpactLevel = 'none' | 'low' | 'medium' | 'high'

export interface BillSummary {
  billSlug: string
  summary: string
  impact: {
    fiscal: ImpactLevel
    rights: ImpactLevel
    publicServices: ImpactLevel
    crossCommunity: ImpactLevel
    environment: ImpactLevel
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getBillSummary(_slug: string): Promise<BillSummary | null> {
  return null
}
