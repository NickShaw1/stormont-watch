import { CalendarDays, MessageSquare, Crown, ArrowDown } from 'lucide-react'
import { getHansardAllByMLA, getHansardRankedTotals } from '@/lib/db/queries'
import RankingShell, { rankTones } from './RankingShell'
import RankingList from './RankingList'
import { rankRows } from './rankUtils'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'

export default async function HansardRankingPage({ mandate, metric, basePath }: { mandate: Mandate; metric: 'sittings' | 'debates'; basePath: string }) {
  const [raw, totals] = await Promise.all([getHansardAllByMLA(mandate.id), getHansardRankedTotals(mandate.id)])
  const sittings = metric === 'sittings'

  const rows = raw
    .map(r => {
      const value = Number(sittings ? r.sittings : r.debates)
      return {
        id: r.personId,
        fullName: r.fullName,
        party: r.party,
        constituency: r.constituency,
        imgUrl: r.imgUrl,
        value,
        display: value.toLocaleString('en-GB'),
      }
    })
    .sort((a, b) => b.value - a.value)

  const total = sittings ? totals.sittings : totals.debates
  const top = rows[0]
  const bottom = rows[rows.length - 1]
  const noun = sittings ? 'sittings' : 'topics'
  const Icon = sittings ? CalendarDays : MessageSquare

  return (
    <RankingShell
      title={sittings ? 'MLA sittings' : 'MLA topics'}
      sub={<>{sittings ? 'Plenary sittings spoken in' : 'Debate topics spoken on'} by every {sittingAdjective(mandate)} MLA since the {mandate.label} mandate began. Excludes presiding officers. Data sourced from Hansard.</>}
      stats={rows.length > 0 ? [
        { tone: sittings ? rankTones.blue : rankTones.purple, icon: Icon, label: sittings ? 'Sittings spoken in' : 'Topics spoken on', figure: total.toLocaleString('en-GB'), sub: `by ${rows.length} MLAs, each counted once` },
        { tone: rankTones.amber, icon: Crown, label: `Most ${noun}`, person: { href: `${basePath}/assembly/mlas/${top.id}`, personId: top.id, fullName: top.fullName, party: top.party, constituency: top.constituency, imgUrl: top.imgUrl, kind: 'top', pct: 100, value: `${top.value.toLocaleString('en-GB')} ${noun}`, context: `top of ${rows.length} MLAs` } },
        { tone: rankTones.grey, icon: ArrowDown, label: `Fewest ${noun}`, person: { href: `${basePath}/assembly/mlas/${bottom.id}`, personId: bottom.id, fullName: bottom.fullName, party: bottom.party, constituency: bottom.constituency, imgUrl: bottom.imgUrl, kind: 'low', pct: top.value > 0 ? (bottom.value / top.value) * 100 : 0, value: `${bottom.value.toLocaleString('en-GB')} ${noun}`, context: `lowest of ${rows.length} MLAs` } },
      ] : []}
    >
      <RankingList rows={rankRows(rows, r => r.value)} ariaLabel={`MLA ${noun} ranked list`} countSuffix=" on record" />
    </RankingShell>
  )
}
