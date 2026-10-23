export interface StageInfo {
  summary: string
  guideId: string | null
}

export const STAGE_INFO: Record<string, StageInfo> = {
  'First Stage': {
    summary: 'The bill is formally introduced and published. There is no debate or vote.',
    guideId: 'first-stage',
  },
  'Second Stage': {
    summary: 'All MLAs debate the general principles of the bill and vote on whether it can proceed. If approved, it goes to the relevant committee.',
    guideId: 'second-stage',
  },
  'Committee Stage': {
    summary: 'The committee takes evidence and scrutinises each clause, then reports to the Assembly with any proposed amendments.',
    guideId: 'committee-stage',
  },
  'Consideration Stage': {
    summary: 'The whole Assembly debates the bill and votes on each clause, schedule and proposed amendment.',
    guideId: 'consideration-stage',
  },
  'Further Consideration Stage': {
    summary: 'A second opportunity to amend the bill. Only new amendments are debated.',
    guideId: 'further-consideration-stage',
  },
  'Final Stage': {
    summary: 'MLAs debate and vote on whether to pass the bill as a whole. No amendments are debated.',
    guideId: 'final-stage',
  },
  'Awaiting Royal Assent': {
    summary: 'The bill has passed Final Stage but has no Royal Assent date yet. Further checks follow before it can become an Act.',
    guideId: 'royal-assent',
  },
  'Became law': {
    summary: 'The bill has received Royal Assent and is an Act of the Northern Ireland Assembly.',
    guideId: 'royal-assent',
  },
  Defeated: {
    summary: 'The Assembly voted against the bill, so it will not become law.',
    guideId: null,
  },
}

export function stageSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
