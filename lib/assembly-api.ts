/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * NI Assembly Open Data API client.
 * All calls are server-side only. Never import this in client components.
 * The `any` casts below are intentional — we defensively unwrap an untyped
 * government API whose response shape varies across endpoints.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface DivisionListItem {
  EventID: string
  DocumentID: string
  DivisionSubject: string
  DivisionDate: string
  DivisonType: string // typo in API — one 'i', do not correct
}

export interface DivisionResult {
  EventId: string
  Title: string
  DocumentID: string
  Outcome: string
  DecisionType: 'Cross-Community' | 'Simple Majority'
  TotalAyes: string
  TotalNoes: string
  TotalAbstentions: string
  NationalistAyes: string
  UnionistAyes: string
  OtherAyes: string
  NationalistNoes: string
  UnionistNoes: string
  OtherNoes: string
  NationalistAbstentions: string
  UnionistAbstentions: string
  OtherAbstentions: string
}

export interface MemberVote {
  DocumentID: string
  PersonID: string
  MemberName: string
  Vote: 'AYE' | 'NO' | 'ABSTAINED'
  Designation: 'Unionist' | 'Nationalist' | 'Other'
  VoteInVacancy: string
}

export interface Member {
  PersonId: string
  MemberFullDisplayName: string
  PartyName: string
  ConstituencyName: string
  MemberImgUrl: string
}

export interface Minister {
  PersonId: string
  MemberFullDisplayName: string
  PartyName: string
  ConstituencyName: string
  MemberImgUrl: string
  MinisterTitle?: string
  Department?: string
}

export interface CommitteeChair {
  PersonId: string
  MemberFullDisplayName: string
  PartyName: string
  ConstituencyName: string
  MemberImgUrl: string
  CommitteeName?: string
}

export interface MemberRole {
  PersonId: string
  MemberFullDisplayName: string
  RoleType: string
  RoleDescription: string
  Department?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

const BASE_CUTOFF = '2024-02-01'

function base(): string {
  return process.env.ASSEMBLY_API_BASE ?? 'http://data.niassembly.gov.uk'
}

async function apiFetch<T>(path: string, cacheOption: RequestInit['next']): Promise<T | null> {
  const url = `${base()}${path}`
  try {
    const res = await fetch(url, { next: cacheOption })
    if (!res.ok) {
      console.error(`[assembly-api] ${res.status} ${res.statusText} — ${url}`)
      return null
    }
    const json = await res.json()
    return json as T
  } catch (err) {
    console.error(`[assembly-api] fetch error for ${url}:`, err)
    return null
  }
}

/** Safely pick a value from an object, returning '' for null/undefined. */
function str(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
}

function isoDate(val: unknown): string {
  const s = str(val)
  if (!s) return ''
  // API sometimes returns /Date(1234567890000)/ format
  const msMatch = s.match(/\/Date\((-?\d+)\)\//)
  if (msMatch) {
    return new Date(parseInt(msMatch[1], 10)).toISOString().slice(0, 10)
  }
  // Try to normalise whatever comes back
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return s
}

function isAfterCutoff(dateStr: string): boolean {
  if (!dateStr) return false
  return dateStr >= BASE_CUTOFF
}

// ── Public API functions ───────────────────────────────────────────────────

export async function getAllCurrentMembers(): Promise<Member[]> {
  const data = await apiFetch<Record<string, unknown>>(
    '/members.asmx/GetAllCurrentMembers_JSON',
    { revalidate: 86400 },
  )
  if (!data) return []
  const raw = (data as any)?.AllMembersList?.Member
  if (!Array.isArray(raw)) return []
  return raw.map((m: any): Member => ({
    PersonId: str(m?.PersonID ?? m?.PersonId),
    MemberFullDisplayName: str(m?.MemberFullDisplayName),
    PartyName: str(m?.PartyName),
    ConstituencyName: str(m?.ConstituencyName),
    MemberImgUrl: str(m?.MemberImgUrl),
  })).filter((m) => m.PersonId)
}

export async function getAllCurrentMinisters(): Promise<Minister[]> {
  const url = `${base()}/members.asmx/GetAllCurrentMinisters`
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) {
      console.error(`[assembly-api] ${res.status} ${res.statusText} — ${url}`)
      return []
    }
    const text = await res.text()
    const matches = text.matchAll(/<Minister>([\s\S]*?)<\/Minister>/g)
    return Array.from(matches).map((m) => {
      const block = m[1]
      return {
        PersonId: block.match(/<PersonId>(.*?)<\/PersonId>/)?.[1] ?? '',
        MemberFullDisplayName: block.match(/<MemberFullDisplayName>(.*?)<\/MemberFullDisplayName>/)?.[1] ?? '',
        PartyName: '',
        ConstituencyName: '',
        MemberImgUrl: '',
        MinisterTitle: block.match(/<RoleName>(.*?)<\/RoleName>/)?.[1] ?? '',
        Department: block.match(/<Department>(.*?)<\/Department>/)?.[1] ?? '',
      }
    }).filter((m) => m.PersonId)
  } catch (err) {
    console.error('[assembly-api] ministers fetch error:', err)
    return []
  }
}

export async function getAllCurrentCommitteeChairs(): Promise<CommitteeChair[]> {
  const url = `${base()}/members.asmx/GetAllCurrentCommitteeChairs`
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) {
      console.error(`[assembly-api] ${res.status} ${res.statusText} — ${url}`)
      return []
    }
    const text = await res.text()
    const matches = text.matchAll(/<CommitteeChair>([\s\S]*?)<\/CommitteeChair>/g)
    return Array.from(matches).map((m) => {
      const block = m[1]
      return {
        PersonId: block.match(/<PersonId>(.*?)<\/PersonId>/)?.[1] ?? '',
        MemberFullDisplayName: block.match(/<MemberFullDisplayName>(.*?)<\/MemberFullDisplayName>/)?.[1] ?? '',
        PartyName: '',
        ConstituencyName: '',
        MemberImgUrl: '',
        CommitteeName: block.match(/<Committee>(.*?)<\/Committee>/)?.[1] ?? '',
      }
    }).filter((m) => m.PersonId)
  } catch (err) {
    console.error('[assembly-api] committee chairs fetch error:', err)
    return []
  }
}

export async function getAllMemberRoles(): Promise<MemberRole[]> {
  const data = await apiFetch<Record<string, unknown>>(
    '/members.asmx/GetAllMemberRoles_JSON',
    { revalidate: 86400 },
  )
  if (!data) return []
  const raw = (data as any)?.AllMembersRoles?.Role
  if (!Array.isArray(raw)) return []
  return raw.map((m: any): MemberRole => ({
    PersonId: str(m?.PersonID ?? m?.PersonId),
    MemberFullDisplayName: str(m?.MemberFullDisplayName),
    RoleType: str(m?.RoleType),
    RoleDescription: str(m?.AffiliationTitle),
    Department: str(m?.Department),
  })).filter((m) => m.PersonId)
}

export async function getVotesOnDivision(
  startDate: string,
  endDate: string,
): Promise<DivisionListItem[]> {
  const data = await apiFetch<Record<string, unknown>>(
    `/plenary.asmx/GetVotesOnDivision_JSON?startdate=${startDate}&enddate=${endDate}`,
    { revalidate: 86400 },
  )
  if (!data) return []
  const raw = (data as any)?.DivisionList?.Division
  if (!Array.isArray(raw)) return []
  return raw
    .map((d: any): DivisionListItem => ({
      EventID: str(d?.EventID),
      DocumentID: str(d?.DocumentID),
      DivisionSubject: str(d?.DivisionSubject),
      DivisionDate: isoDate(d?.DivisionDate),
      DivisonType: str(d?.DivisonType),
    }))
    .filter((d) => d.DocumentID && isAfterCutoff(d.DivisionDate))
}

export async function getDivisionResult(documentId: string): Promise<DivisionResult | null> {
  const data = await apiFetch<Record<string, unknown>>(
    `/plenary.asmx/GetDivisionResult_JSON?documentId=${documentId}`,
    { revalidate: 86400 },
  )
  if (!data) return null
  const raw = (data as any)?.DivisionDetails?.Division
  const r = Array.isArray(raw) ? raw[0] : raw
  if (!r) return null
  return {
    EventId: str(r?.EventId),
    Title: str(r?.Title),
    DocumentID: str(r?.DocumentID),
    Outcome: str(r?.Outcome),
    DecisionType: str(r?.DecisionType) === 'Cross-Community' ? 'Cross-Community' : 'Simple Majority',
    TotalAyes: str(r?.TotalAyes),
    TotalNoes: str(r?.TotalNoes),
    TotalAbstentions: str(r?.TotalAbstentions),
    NationalistAyes: str(r?.NationalistAyes),
    UnionistAyes: str(r?.UnionistAyes),
    OtherAyes: str(r?.OtherAyes),
    NationalistNoes: str(r?.NationalistNoes),
    UnionistNoes: str(r?.UnionistNoes),
    OtherNoes: str(r?.OtherNoes),
    NationalistAbstentions: str(r?.NationalistAbstentions),
    UnionistAbstentions: str(r?.UnionistAbstentions),
    OtherAbstentions: str(r?.OtherAbstentions),
  }
}

export async function getDivisionMemberVoting(documentId: string): Promise<MemberVote[]> {
  const data = await apiFetch<Record<string, unknown>>(
    `/plenary.asmx/GetDivisionMemberVoting_JSON?documentId=${documentId}`,
    { revalidate: 86400 },
  )
  if (!data) return []
  const raw = (data as any)?.MemberVoting?.Member
  if (!Array.isArray(raw)) return []
  return raw.map((v: any): MemberVote => ({
    DocumentID: str(v?.DocumentID),
    PersonID: str(v?.PersonID),
    MemberName: str(v?.MemberName),
    Vote: (['AYE', 'NO', 'ABSTAINED'].includes(str(v?.Vote))
      ? str(v?.Vote)
      : 'ABSTAINED') as MemberVote['Vote'],
    Designation: (['Unionist', 'Nationalist', 'Other'].includes(str(v?.Designation))
      ? str(v?.Designation)
      : 'Other') as MemberVote['Designation'],
    VoteInVacancy: str(v?.VoteInVacancy),
  })).filter((v) => v.PersonID)
}

/**
 * Fetch all divisions since February 2024, querying year by year to ensure
 * complete coverage regardless of any API pagination limits.
 */
export async function getAllDivisionsSince2024(): Promise<DivisionListItem[]> {
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let year = 2024; year <= currentYear; year++) {
    years.push(year)
  }
  const results = await Promise.all(
    years.map((year) =>
      getVotesOnDivision(
        year === 2024 ? '2024-02-01' : `${year}-01-01`,
        `${year}-12-31`,
      ),
    ),
  )
  const merged = results.flat().sort((a, b) => b.DivisionDate.localeCompare(a.DivisionDate))
  return merged
}

/**
 * Derive No Shows by comparing all current members against those who voted.
 */
export function deriveNoShows(
  allMembers: Member[],
  memberVotes: MemberVote[],
): Member[] {
  const votedIds = new Set(memberVotes.map((v) => v.PersonID))
  return allMembers.filter((m) => !votedIds.has(m.PersonId))
}
