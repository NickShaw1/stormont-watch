import { MessageCircleQuestion, Crown, ArrowDown } from 'lucide-react'
import { getQuestionTotalsAllMembers, getAllMandateMembers, getAllMinisters } from '@/lib/db/queries'
import RankingShell, { rankTones } from '../stats/RankingShell'
import RankingList from '../stats/RankingList'
import { rankRows } from '../stats/rankUtils'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'

// Shared by the live route and archive routes; mandate/basePath vary per route.
export default async function QuestionsPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [questionTotals, allMandateMembers, ministerRows] = await Promise.all([
    getQuestionTotalsAllMembers(mandate.id),
    getAllMandateMembers(mandate.id),
    getAllMinisters(mandate.id),
  ])

  const memberMap = new Map(allMandateMembers.map(m => [m.personId, m]))
  const ministerIds = new Set(ministerRows.map(m => m.personId))

  const rows = questionTotals
    .map(r => {
      const m = memberMap.get(r.personId)
      if (!m) return null
      if (!m.isCurrent) return null
      if (m.assemblyRole === 'Speaker' || ministerIds.has(r.personId)) return null
      const total = Number(r.total)
      return {
        id: r.personId,
        fullName: m.fullName,
        party: m.party,
        constituency: m.constituency,
        imgUrl: m.imgUrl,
        value: total,
        display: total.toLocaleString('en-GB'),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.value - a.value)

  const total = rows.reduce((s, r) => s + r.value, 0)
  const top = rows[0]
  const bottom = rows[rows.length - 1]

  return (
    <RankingShell
      title="MLA questions"
      sub={<>Questions tabled by every {sittingAdjective(mandate)} MLA since the {mandate.label} mandate began. Excludes current ministers and the Speaker. Data sourced from the NI Assembly.</>}
      stats={rows.length > 0 ? [
        { tone: rankTones.pink, icon: MessageCircleQuestion, label: 'Questions tabled', figure: total.toLocaleString('en-GB'), sub: `by ${rows.length} MLAs` },
        { tone: rankTones.amber, icon: Crown, label: 'Most questions', person: { href: `${basePath}/assembly/mlas/${top.id}`, personId: top.id, fullName: top.fullName, party: top.party, constituency: top.constituency, imgUrl: top.imgUrl, kind: 'top', pct: 100, value: `${top.value.toLocaleString('en-GB')} questions`, context: `top of ${rows.length} MLAs` } },
        { tone: rankTones.grey, icon: ArrowDown, label: 'Fewest questions', person: { href: `${basePath}/assembly/mlas/${bottom.id}`, personId: bottom.id, fullName: bottom.fullName, party: bottom.party, constituency: bottom.constituency, imgUrl: bottom.imgUrl, kind: 'low', pct: top.value > 0 ? (bottom.value / top.value) * 100 : 0, value: `${bottom.value.toLocaleString('en-GB')} questions`, context: `lowest of ${rows.length} MLAs` } },
      ] : []}
    >
      <RankingList rows={rankRows(rows, r => r.value)} ariaLabel="MLA questions ranked list" countSuffix=" with questions on record" />
    </RankingShell>
  )
}
