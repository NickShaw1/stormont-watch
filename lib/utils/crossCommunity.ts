export function failedDespiteMajority(isCrossCommunity: boolean | undefined, passed: boolean | null, ayes: number, noes: number): boolean {
  return isCrossCommunity === true && passed === false && ayes > noes
}

export const MAJORITY_NOT_ENOUGH = 'Majority in favour, but short of cross-community support'
