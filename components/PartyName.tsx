import { formatPartyName } from '@/lib/format'

interface Props {
  party: string | null | undefined
}

export default function PartyName({ party }: Props) {
  if (!party) return null
  return <>{formatPartyName(party, true)}</>
}
