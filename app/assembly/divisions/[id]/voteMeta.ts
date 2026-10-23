export type VoteKey = 'AYE' | 'NO' | 'ABSTAINED' | 'NO_SHOW'

export const VOTE_ORDER: VoteKey[] = ['AYE', 'NO', 'ABSTAINED', 'NO_SHOW']

export const VOTE_LABEL: Record<VoteKey, string> = {
  AYE: 'Aye',
  NO: 'No',
  ABSTAINED: 'Abstained',
  NO_SHOW: 'Did not vote',
}

export interface Ballot {
  personId: string
  fullName: string
  party: string | null
  vote: VoteKey
  designation: string | null
  constituency: string | null
  imgUrl: string | null
}

export function toBallots(
  votes: {
    personId: string
    fullName: string
    party: string | null
    vote: string
    designation: string | null
    memberDesignation: string | null
    constituency: string | null
    imgUrl: string | null
  }[],
): Ballot[] {
  return votes
    .filter((v): v is typeof v & { vote: VoteKey } => (VOTE_ORDER as string[]).includes(v.vote))
    .map((v) => ({
      personId: v.personId,
      fullName: v.fullName,
      party: v.party,
      vote: v.vote,
      designation: v.memberDesignation ?? v.designation ?? null,
      constituency: v.constituency,
      imgUrl: v.imgUrl,
    }))
}
