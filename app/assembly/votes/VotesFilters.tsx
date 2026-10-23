'use client'

import { createContext, useContext, useMemo, useState } from 'react'

export type TypeFilter = 'ALL' | 'BILLS' | 'MOTIONS' | 'REGULATIONS'
export type ResultFilter = 'ALL' | 'PASSED' | 'FAILED'
export type CrossFilter = 'ALL' | 'both' | 'divided' | 'against' | 'level'
export type FilterDim = 'result' | 'type' | 'year' | 'cross'

interface VotesFilters {
  query: string
  setQuery: (v: string) => void
  yearFilter: string
  setYearFilter: (v: string) => void
  resultFilter: ResultFilter
  setResultFilter: (v: ResultFilter) => void
  typeFilter: TypeFilter
  setTypeFilter: (v: TypeFilter) => void
  crossFilter: CrossFilter
  setCrossFilter: (v: CrossFilter) => void
  dayFilter: string
  setDayFilter: (v: string) => void
  closeOnly: boolean
  setCloseOnly: (v: boolean) => void
  clearAll: () => void
  isApplied: (dim: FilterDim, value: string) => boolean
  toggle: (dim: FilterDim, value: string) => void
}

const Ctx = createContext<VotesFilters | null>(null)

export function useVotesFilters(): VotesFilters {
  const v = useContext(Ctx)
  if (!v) throw new Error('useVotesFilters must be used inside VotesFiltersProvider')
  return v
}

export function VotesFiltersProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('')
  const [yearFilter, setYearFilter] = useState('ALL')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('ALL')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [crossFilter, setCrossFilter] = useState<CrossFilter>('ALL')
  const [dayFilter, setDayFilter] = useState('ALL')
  const [closeOnly, setCloseOnly] = useState(false)

  const value = useMemo<VotesFilters>(() => {
    const current = (dim: FilterDim): string =>
      dim === 'result' ? resultFilter : dim === 'type' ? typeFilter : dim === 'year' ? yearFilter : crossFilter
    return {
      query, setQuery,
      yearFilter, setYearFilter,
      resultFilter, setResultFilter,
      typeFilter, setTypeFilter,
      crossFilter, setCrossFilter,
      dayFilter, setDayFilter,
      closeOnly, setCloseOnly,
      clearAll: () => {
        setQuery('')
        setYearFilter('ALL')
        setResultFilter('ALL')
        setTypeFilter('ALL')
        setCrossFilter('ALL')
        setDayFilter('ALL')
        setCloseOnly(false)
      },
      isApplied: (dim, v) => current(dim) === v,
      toggle: (dim, v) => {
        const next = current(dim) === v ? 'ALL' : v
        if (dim === 'result') setResultFilter(next as ResultFilter)
        else if (dim === 'type') setTypeFilter(next as TypeFilter)
        else if (dim === 'year') setYearFilter(next)
        else setCrossFilter(next as CrossFilter)
      },
    }
  }, [query, yearFilter, resultFilter, typeFilter, crossFilter, dayFilter, closeOnly])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
