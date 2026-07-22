'use client'
import { createContext, useContext, type ReactNode } from 'react'
import { CURRENT_MANDATE, type Mandate } from '@/lib/constants/mandates'

type MandateCtx = {
  /** The mandate currently being rendered (current for live, an archived one under /archive). */
  mandate: Mandate
  /** URL prefix for internal links: '' for live, '/archive/<id>' under the archive. */
  basePath: string
}

const Ctx = createContext<MandateCtx>({ mandate: CURRENT_MANDATE, basePath: '' })

export function MandateProvider({
  mandate,
  basePath,
  children,
}: MandateCtx & { children: ReactNode }) {
  return <Ctx.Provider value={{ mandate, basePath }}>{children}</Ctx.Provider>
}

/** Client-component access to the active mandate + link basePath. */
export function useMandate(): MandateCtx {
  return useContext(Ctx)
}
