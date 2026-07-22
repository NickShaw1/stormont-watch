import { pgTable, text, integer, timestamp, date, serial, unique, boolean, numeric, primaryKey, smallint, uniqueIndex } from 'drizzle-orm/pg-core'

export const members = pgTable('members', {
  personId: text('person_id').primaryKey(),
  fullName: text('full_name').notNull(),
  party: text('party'),
  constituency: text('constituency'),
  imgUrl: text('img_url'),
  isCurrent: boolean('is_current').notNull().default(false),
  mandateStart: date('mandate_start'),
  mandateEnd: date('mandate_end'),
  assemblyRole: text('assembly_role'),
  assemblyRoleStart: date('assembly_role_start'),
  assemblyRoleEnd: date('assembly_role_end'),
  email: text('email'),
  mandate: text('mandate').notNull(),
  confirmedSilent: boolean('confirmed_silent').notNull().default(false),
  designation: text('designation'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// --- Multi-mandate model (expand phase) ---
// `people` = stable identity, `member_terms` = per-mandate snapshot, `mandates` =
// registry. The `members` table above is, on migrated databases, a compatibility
// VIEW over people + member_terms for the current mandate; Drizzle still reads it as
// before. New code writes people + member_terms directly.

export const mandates = pgTable('mandates', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  electionDate: date('election_date'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  isCurrent: boolean('is_current').notNull().default(false),
})

export const people = pgTable('people', {
  personId: text('person_id').primaryKey(),
  fullName: text('full_name').notNull(),
  imgUrl: text('img_url'),
  email: text('email'),
})

export const memberTerms = pgTable('member_terms', {
  personId: text('person_id').notNull().references(() => people.personId),
  mandate: text('mandate').notNull().references(() => mandates.id),
  party: text('party'),
  constituency: text('constituency'),
  designation: text('designation'),
  isCurrent: boolean('is_current').notNull().default(false),
  mandateStart: date('mandate_start'),
  mandateEnd: date('mandate_end'),
  assemblyRole: text('assembly_role'),
  assemblyRoleStart: date('assembly_role_start'),
  assemblyRoleEnd: date('assembly_role_end'),
  confirmedSilent: boolean('confirmed_silent').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.personId, t.mandate] }),
}))

export type Mandate = typeof mandates.$inferSelect
export type Person = typeof people.$inferSelect
export type MemberTerm = typeof memberTerms.$inferSelect

export const divisions = pgTable('divisions', {
  documentId: text('document_id').primaryKey(),
  eventId: text('event_id'),
  subject: text('subject').notNull(),
  divisionDate: timestamp('division_date', { withTimezone: true }).notNull(),
  divisionType: text('division_type'),
  outcome: text('outcome'),
  totalAyes: integer('total_ayes'),
  totalNoes: integer('total_noes'),
  totalAbstains: integer('total_abstains'),
  nationalistAyes: integer('nationalist_ayes'),
  unionistAyes: integer('unionist_ayes'),
  otherAyes: integer('other_ayes'),
  nationalistNoes: integer('nationalist_noes'),
  unionistNoes: integer('unionist_noes'),
  otherNoes: integer('other_noes'),
  motionText: text('motion_text'),
  title: text('title'),
  tabledBy: text('tabled_by'),
  isMotionAmendment: boolean('is_motion_amendment').default(false),
  parentMotionText: text('parent_motion_text'),
  mandate: text('mandate').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const votes = pgTable('votes', {
  id: serial('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => divisions.documentId),
  personId: text('person_id').notNull().references(() => members.personId),
  vote: text('vote').notNull(),
  designation: text('designation'),
  mandate: text('mandate').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  unq: unique().on(t.documentId, t.personId),
}))

export const hansardReports = pgTable('hansard_reports', {
  reportDocId: text('report_doc_id').primaryKey(),
  plenaryDate: date('plenary_date').notNull(),
  sessionName: text('session_name'),
  fullyProcessed: boolean('fully_processed').notNull().default(false),
  mandate: text('mandate').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const hansardContributions = pgTable('hansard_contributions', {
  id: serial('id').primaryKey(),
  personId: text('person_id').notNull().references(() => members.personId),
  reportDocId: text('report_doc_id').notNull(),
  plenaryDate: date('plenary_date').notNull(),
  debateTitle: text('debate_title').notNull(),
  mandate: text('mandate').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueContribution: uniqueIndex('hansard_contributions_person_report_debate_unique')
    .on(table.personId, table.reportDocId, table.debateTitle),
}))

export const ministers = pgTable('ministers', {
  personId: text('person_id').notNull().references(() => members.personId),
  department: text('department').notNull(),
  roleTitle: text('role_title'),
  mandate: text('mandate').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  // Per-mandate: a person can hold a minister row in each mandate, so past-mandate
  // rows survive as an archive. Sync prunes only the current mandate's snapshot.
  pk: primaryKey({ columns: [t.personId, t.mandate] }),
}))

export const committeeChairs = pgTable('committee_chairs', {
  personId: text('person_id').notNull().references(() => members.personId),
  committeeName: text('committee_name').notNull(),
  mandate: text('mandate').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.personId, t.mandate] }),
}))

export const expenses = pgTable('expenses', {
  personId: text('person_id').notNull().references(() => members.personId),
  financialYear: text('financial_year').notNull(),
  period: text('period').notNull(),
  constituencyOffice: numeric('constituency_office', { precision: 10, scale: 2 }).default('0'),
  otherExpenses: numeric('other_expenses', { precision: 10, scale: 2 }).default('0'),
  allowances: numeric('allowances', { precision: 10, scale: 2 }).default('0'),
  staffCosts: numeric('staff_costs', { precision: 10, scale: 2 }).default('0'),
  total: numeric('total', { precision: 10, scale: 2 }).default('0'),
  mandate: text('mandate').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.personId, t.financialYear] }),
}))

export const bills = pgTable('bills', {
  billId: text('bill_id').primaryKey(),
  shortTitle: text('short_title').notNull(),
  longTitle: text('long_title'),
  billType: text('bill_type'),
  isAccelerated: boolean('is_accelerated').default(false),
  currentStage: text('current_stage'),
  latestDate: timestamp('latest_date', { withTimezone: true }),
  royalAssentDate: date('royal_assent_date'),
  actTitle: text('act_title'),
  mandate: text('mandate').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const billStages = pgTable('bill_stages', {
  documentId: text('document_id').primaryKey(),
  billId: text('bill_id').references(() => bills.billId),
  stage: text('stage').notNull(),
  plenaryDate: timestamp('plenary_date', { withTimezone: true }).notNull(),
  hasDivision: boolean('has_division').default(false),
  divisionId: text('division_id').references(() => divisions.documentId),
  mandate: text('mandate').notNull(),
  itemTitle: text('item_title'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export type Member = typeof members.$inferSelect
export type Division = typeof divisions.$inferSelect
export type Vote = typeof votes.$inferSelect
export type HansardReport = typeof hansardReports.$inferSelect
export type Minister = typeof ministers.$inferSelect
export type CommitteeChair = typeof committeeChairs.$inferSelect
export type Expense = typeof expenses.$inferSelect
export type Bill = typeof bills.$inferSelect
export type BillStage = typeof billStages.$inferSelect

export const registeredInterests = pgTable('registered_interests', {
  id: serial('id').primaryKey(),
  personId: text('person_id').notNull().references(() => members.personId),
  registerCategoryId: text('register_category_id').notNull(),
  registerCategory: text('register_category').notNull(),
  registerEntry: text('register_entry').notNull(),
  registerEntryStartDate: timestamp('register_entry_start_date', { withTimezone: true }),
  mandate: text('mandate').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  unq: unique().on(t.personId, t.registerCategoryId, t.registerEntry, t.mandate),
}))

export type RegisteredInterest = typeof registeredInterests.$inferSelect

export const plenaryItems = pgTable('plenary_items', {
  documentId: text('document_id').primaryKey(),
  title: text('title').notNull(),
  plenaryDate: date('plenary_date').notNull(),
  plenaryType: text('plenary_type').notNull(),
  plenaryTypeId: text('plenary_type_id').notNull(),
  motionCategory: text('motion_category'),
  motionCategoryId: text('motion_category_id'),
  text: text('text'),
  tabledDate: date('tabled_date'),
  mandate: text('mandate').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export type PlenaryItem = typeof plenaryItems.$inferSelect

export const questionStats = pgTable('question_stats', {
  id: serial('id').primaryKey(),
  personId: text('person_id').notNull().references(() => members.personId),
  year: smallint('year').notNull(),
  month: smallint('month').notNull(),
  writtenCount: integer('written_count').notNull().default(0),
  oralCount: integer('oral_count').notNull().default(0),
  mandate: text('mandate').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  personYearMonth: unique().on(table.personId, table.year, table.month),
}))

export type QuestionStat = typeof questionStats.$inferSelect

export const memberRoleHistory = pgTable('member_role_history', {
  id: serial('id').primaryKey(),
  personId: text('person_id').notNull().references(() => members.personId),
  affiliationId: text('affiliation_id').notNull().unique(),
  roleType: text('role_type').notNull(),
  role: text('role').notNull(),
  organisation: text('organisation'),
  organisationId: text('organisation_id'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  mandate: text('mandate').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export type MemberRoleHistory = typeof memberRoleHistory.$inferSelect

export const plenaryDiary = pgTable('plenary_diary', {
  eventId: text('event_id').primaryKey(),
  eventDate: date('event_date').notNull(),
  eventType: text('event_type').notNull(),
  organisationName: text('organisation_name'),
  startTime: timestamp('start_time', { withTimezone: true }),
  endTime: timestamp('end_time', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export type PlenaryDiaryEvent = typeof plenaryDiary.$inferSelect
