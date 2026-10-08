'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'

export interface MenuAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  divider?: boolean
}

interface DropdownMenuProps {
  actions: MenuAction[]
  align?: 'left' | 'right'
  trigger?: React.ReactNode
  ariaLabel?: string
}

export function DropdownMenu({ actions, align = 'right', trigger, ariaLabel = 'More options' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', escHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        aria-label={ariaLabel}
        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        {trigger ?? <MoreVertical className="w-5 h-5" />}
      </button>
      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-9 z-40 w-56 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl py-1.5 animate-in`}
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((action, i) => (
            <div key={`${action.label}-${i}`}>
              {action.divider && <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />}
              <button
                onClick={() => { setOpen(false); action.onClick() }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  action.danger
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                    : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                {action.icon && <span className="w-4 h-4 shrink-0">{action.icon}</span>}
                {action.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
