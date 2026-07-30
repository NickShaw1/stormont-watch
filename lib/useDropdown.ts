import { useState, useRef, useEffect } from 'react'

/** Shared open/close + outside-click + focus-on-open + arrow-key nav behavior
 *  for mobile filter dropdowns — matches app/assembly/mlas/MlasListClient.tsx's
 *  original useDropdown, factored out here so every ranking page can reuse it. */
export function useDropdown() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!open) return
    const list = listRef.current
    if (list) {
      const sel = list.querySelector<HTMLLIElement>('[aria-selected="true"]') ?? list.querySelector<HTMLLIElement>('li')
      sel?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  function handleKeyDown(e: React.KeyboardEvent<HTMLLIElement>, onSelect: () => void) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect()
    } else if (e.key === 'Escape') {
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const items = Array.from(listRef.current?.querySelectorAll<HTMLLIElement>('li') ?? [])
      items[items.indexOf(e.currentTarget) + 1]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const items = Array.from(listRef.current?.querySelectorAll<HTMLLIElement>('li') ?? [])
      items[items.indexOf(e.currentTarget) - 1]?.focus()
    }
  }

  return { open, setOpen, wrapRef, triggerRef, listRef, handleKeyDown }
}
