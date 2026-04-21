'use client'

import { useState } from 'react'
import styles from './mlaDetail.module.css'

type Expenses = {
  financial_year: string
  period: string
  constituency_office: string | null
  other_expenses: string | null
  allowances: string | null
  staff_costs: string | null
  total: string | null
  rank: number
  total_members: number
} | null

type Interest = {
  id: number
  personId: string
  registerCategoryId: string
  registerCategory: string
  registerEntry: string
  registerEntryStartDate: string | null
  updatedAt: string | null
}

interface Props {
  expenses: Expenses
  interests: Interest[]
}

const gbp = (val: string | null | undefined) =>
  val ? `£${parseFloat(val).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '£0.00'

function formatInterestDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

type Tab = 'expenses' | 'interests'

function toSentenceCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export default function FinancesTabsClient({ expenses: latestExpenses, interests }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('expenses')

  const grouped = interests.reduce<Record<string, Interest[]>>((acc, item) => {
    if (!acc[item.registerCategory]) acc[item.registerCategory] = []
    acc[item.registerCategory].push(item)
    return acc
  }, {})

  return (
    <div className={styles.financesCard}>
      <div className={styles.financesTabs} role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'expenses'}
          className={`${styles.financesTab} ${activeTab === 'expenses' ? styles.financesTabActive : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          Expenses
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'interests'}
          className={`${styles.financesTab} ${activeTab === 'interests' ? styles.financesTabActive : ''}`}
          onClick={() => setActiveTab('interests')}
        >
          Register of Interests
        </button>
      </div>

      {activeTab === 'expenses' && latestExpenses && (
        <div className={styles.financesContent}>
          <p className={styles.sectionMeta}>{latestExpenses.period}</p>
          <div className={styles.expensesGrid}>
            <div className={styles.expensesCard}>
              <span className={styles.expenseLabel}>Staff costs</span>
              <span className={styles.expenseValue}>{gbp(latestExpenses.staff_costs)}</span>
            </div>
            <div className={styles.expensesCard}>
              <span className={styles.expenseLabel}>Constituency office</span>
              <span className={styles.expenseValue}>{gbp(latestExpenses.constituency_office)}</span>
            </div>
            <div className={styles.expensesCard}>
              <span className={styles.expenseLabel}>Allowances</span>
              <span className={styles.expenseValue}>{gbp(latestExpenses.allowances)}</span>
            </div>
            <div className={styles.expensesCard}>
              <span className={styles.expenseLabel}>Other expenses</span>
              <span className={styles.expenseValue}>{gbp(latestExpenses.other_expenses)}</span>
            </div>
            <div className={styles.expensesCard}>
              <span className={styles.expenseLabel}>Expenses ranking</span>
              <span className={styles.expenseValue}>{latestExpenses.rank}<span className={styles.expenseFraction}>/{latestExpenses.total_members}</span></span>
            </div>
            <div className={styles.expensesCard}>
              <span className={styles.expenseLabel}>Total</span>
              <span className={styles.expenseValue}>{gbp(latestExpenses.total)}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'interests' && (
        <div className={`${styles.financesContent} ${styles.interestsSection}`}>
          {interests.length === 0 ? (
            <p className={styles.interestsEmpty}>No interests currently registered.</p>
          ) : (
            Object.entries(grouped).map(([category, entries]) => (
              <div key={category} className={styles.interestCategory}>
                <h3 className={styles.interestCategoryHeading}>{toSentenceCase(category)}</h3>
                <ul className={styles.interestList}>
                  {entries.map((entry) => (
                    <li key={entry.id} className={styles.interestItem}>
                      <span className={styles.interestEntry}>{entry.registerEntry}</span>
                      {entry.registerEntryStartDate && (
                        <span className={styles.interestDate}>{formatInterestDate(entry.registerEntryStartDate)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
          <p className={styles.interestsAttribution}>
            Data from the{' '}
            <a
              href="https://www.niassembly.gov.uk/your-mlas/register-of-interests/"
              target="_blank"
              rel="noopener noreferrer"
            >
              NI Assembly Register of Members&apos; Interests
            </a>.
          </p>
        </div>
      )}
    </div>
  )
}
