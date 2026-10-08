'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react'

const themes = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => setMounted(true), [])

  // Avoid hydration mismatch — render a same-size invisible button until mounted
  if (!mounted) {
    return (
      <button
        aria-hidden="true"
        className="h-9 w-9 rounded-lg border border-transparent opacity-0"
        tabIndex={-1}
      />
    )
  }

  const current = themes.find((t) => t.value === theme) ?? themes[2]
  const CurrentIcon = current.icon

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all
          bg-white dark:bg-neutral-900
          border-neutral-200 dark:border-neutral-800
          text-neutral-700 dark:text-neutral-300
          hover:bg-neutral-50 dark:hover:bg-neutral-800
          hover:border-neutral-300 dark:hover:border-neutral-700
          shadow-sm"
      >
        <CurrentIcon className="w-4 h-4" />
        <span className="hidden sm:block">{current.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 top-11 z-20 w-40 rounded-xl border shadow-xl overflow-hidden
            bg-white dark:bg-neutral-900
            border-neutral-200 dark:border-neutral-800">
            {themes.map(({ value, label, icon: Icon }) => {
              const isActive = theme === value
              const isResolved = resolvedTheme === value && value !== 'system'
              return (
                <button
                  key={value}
                  onClick={() => { setTheme(value); setOpen(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                    ${isActive
                      ? 'text-black dark:text-white bg-neutral-100 dark:bg-neutral-800 font-semibold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                    }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-black dark:text-white' : 'text-neutral-400'}`} />
                  <span>{label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-black dark:bg-white" />
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
