import { sql, eq, and } from 'drizzle-orm'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import { people, memberTerms } from './schema'
import { mandateForToday } from '../constants/mandates'

type Db = NeonHttpDatabase<typeof schema>

export type MemberSnapshot = {
  personId: string
  fullName: string
  imgUrl: string | null
  party: string | null
  constituency: string | null
  isCurrent: boolean
  /** Only pass when a source actually provides it; omit to leave any existing email untouched. */
  email?: string | null
}

/**
 * Upsert a member's stable identity into `people` and their per-mandate snapshot
 * (party / constituency / current status) into `member_terms` for the current mandate.
 * Replaces the old single-row write into the `members` table.
 */
export async function upsertMemberSnapshot(db: Db, m: MemberSnapshot): Promise<void> {
  // Identity. Never overwrite a locally-downloaded image with an API URL, and don't
  // clobber an email set elsewhere (the base member API doesn't provide one).
  await db
    .insert(people)
    .values({
      personId: m.personId,
      fullName: m.fullName,
      imgUrl: m.imgUrl,
      email: m.email ?? null,
    })
    .onConflictDoUpdate({
      target: people.personId,
      set: {
        fullName: m.fullName,
        imgUrl: sql`CASE WHEN ${people.imgUrl} LIKE '/mla-images/%' THEN ${people.imgUrl} ELSE ${m.imgUrl} END`,
        ...(m.email !== undefined ? { email: m.email } : {}),
      },
    })

  // Per-mandate snapshot for the current term.
  await db
    .insert(memberTerms)
    .values({
      personId: m.personId,
      mandate: mandateForToday().id,
      party: m.party,
      constituency: m.constituency,
      isCurrent: m.isCurrent,
    })
    .onConflictDoUpdate({
      target: [memberTerms.personId, memberTerms.mandate],
      set: {
        party: m.party,
        constituency: m.constituency,
        isCurrent: m.isCurrent,
        updatedAt: new Date(),
      },
    })
}

/**
 * Update the per-mandate role fields (mandate window + special assembly role) on the
 * current-mandate `member_terms` row for a member. Mirrors the old UPDATE on `members`.
 */
export async function updateMemberTermRoles(
  db: Db,
  personId: string,
  r: {
    mandateStart?: string | null
    mandateEnd: string | null
    assemblyRole: string | null
    assemblyRoleStart: string | null
    assemblyRoleEnd: string | null
    /** Pass to set designation (including null to clear); omit to leave it untouched. */
    designation?: string | null
  },
): Promise<void> {
  await db
    .update(memberTerms)
    .set({
      ...(r.mandateStart ? { mandateStart: r.mandateStart } : {}),
      mandateEnd: r.mandateEnd ?? null,
      assemblyRole: r.assemblyRole,
      assemblyRoleStart: r.assemblyRoleStart ?? null,
      assemblyRoleEnd: r.assemblyRoleEnd ?? null,
      ...(r.designation !== undefined ? { designation: r.designation } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(memberTerms.personId, personId), eq(memberTerms.mandate, mandateForToday().id)))
}
