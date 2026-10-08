'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Bell,
  Search,
  Settings,
  Sparkles,
  X,
  File,
  Folder as FolderIcon,
  Loader2,
  Menu,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getUserId } from '@/lib/storage'
import type { FileRecord, Folder } from '@/lib/types'
import { formatBytes } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'

interface UserInfo {
  name: string
  email: string
  initials: string
}

interface TopBarProps {
  title?: string
  onMenuClick?: () => void
  user?: UserInfo | null
}

// ── Global Search ────────────────────────────────────────────────────────────

interface SearchResult {
  files: FileRecord[]
  folders: Folder[]
}

function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Keyboard shortcut: / or Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '')) {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) { setResults(null); setLoading(false); return }
    setLoading(true)
    try {
      const userId = (await getUserId()) ?? ''
      const like = `%${trimmed}%`
      const [{ data: files }, { data: folders }] = await Promise.all([
        supabase
          .from('files')
          .select('*')
          .eq('owner_id', userId)
          .eq('is_trashed', false)
          .or(`name.ilike.${like},file_type.ilike.${like}`)
          .limit(6),
        supabase
          .from('folders')
          .select('*')
          .eq('owner_id', userId)
          .eq('is_trashed', false)
          .ilike('name', like)
          .limit(4),
      ])
      setResults({ files: (files ?? []) as FileRecord[], folders: (folders ?? []) as Folder[] })
    } catch {
      setResults(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults(null); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(() => void runSearch(val), 320)
  }

  const clear = () => { setQuery(''); setResults(null); setOpen(false) }

  const goToFile = (file: FileRecord) => {
    clear()
    const dest = file.folder_id ? `/drive/${file.folder_id}` : '/drive'
    router.push(dest)
  }

  const goToFolder = (folder: Folder) => {
    clear()
    router.push(`/drive/${folder.id}`)
  }

  const goToAI = () => {
    if (query.trim()) {
      router.push(`/ai?q=${encodeURIComponent(query.trim())}`)
      clear()
    }
  }

  const hasResults = results && (results.files.length > 0 || results.folders.length > 0)
  const showDropdown = open && query.trim().length > 0

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onFocus={() => { if (query.trim()) setOpen(true) }}
          placeholder="Search files, folders and ask AI..."
          aria-label="Global search"
          className="h-9 w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-8 text-sm text-neutral-900 placeholder-neutral-400 transition focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500 dark:focus:border-neutral-500"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900 animate-in">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          )}

          {!loading && !hasResults && (
            <div className="space-y-1 p-1">
              <button
                type="button"
                onClick={goToAI}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
                <span>Ask AI: &ldquo;{query}&rdquo;</span>
              </button>
              <p className="px-3 pb-2 text-xs text-neutral-400">No files or folders found.</p>
            </div>
          )}

          {!loading && hasResults && (
            <div className="p-1">
              {results!.folders.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    Folders
                  </p>
                  {results!.folders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => goToFolder(f)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                      <FolderIcon className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="flex-1 truncate text-left">{f.name}</span>
                    </button>
                  ))}
                </>
              )}

              {results!.files.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    Files
                  </p>
                  {results!.files.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => goToFile(f)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                      <File className="h-4 w-4 shrink-0 text-neutral-400" />
                      <span className="flex-1 truncate text-left">{f.name}</span>
                      <span className="shrink-0 text-[11px] text-neutral-400">{formatBytes(f.file_size)}</span>
                    </button>
                  ))}
                </>
              )}

              {/* AI shortcut */}
              <div className="mt-1 border-t border-neutral-100 pt-1 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={goToAI}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-violet-500" />
                  Ask AI about &ldquo;{query}&rdquo;
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── TopBar ───────────────────────────────────────────────────────────────────

export function TopBar({ title = 'Dashboard', onMenuClick, user }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/90 sm:px-6">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onMenuClick}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Page title — mobile only */}
      <h1 className="text-sm font-semibold text-neutral-900 dark:text-white md:hidden">{title}</h1>

      {/* Global search — desktop */}
      <div className="hidden flex-1 md:flex">
        <GlobalSearch />
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1.5">
        {/* AI shortcut */}
        <Link
          href="/ai"
          className="hidden items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 sm:flex"
        >
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          Ask AI
        </Link>

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Settings */}
        <Link
          href="/settings"
          aria-label="Settings"
          className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <Settings className="h-4 w-4" />
        </Link>

        {/* User avatar */}
        {user && (
          <Link
            href="/settings"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-bold text-white dark:bg-white dark:text-black"
          >
            {user.initials}
          </Link>
        )}
      </div>
    </header>
  )
}
