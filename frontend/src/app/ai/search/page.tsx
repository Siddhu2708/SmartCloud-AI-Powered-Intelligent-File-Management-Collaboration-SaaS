'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Search,
  Sparkles,
  File,
  Folder as FolderIcon,
  Loader2,
  X,
  Brain,
  Zap,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getUserId, logAuditAI } from '@/lib/storage'
import type { FileRecord, Folder } from '@/lib/types'
import { formatBytes, formatRelativeTime, getCategory } from '@/lib/utils'
import { FileIcon } from '@/components/shared/FileIcon'
import { EmptyState } from '@/components/shared/EmptyState'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface AISearchResult {
  title: string
  snippet: string
  score: number
}

interface SearchResults {
  files: FileRecord[]
  folders: Folder[]
  semanticResults?: AISearchResult[]
  searchType?: 'semantic' | 'keyword'
}

// ── Filter bar ────────────────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'PDFs', value: 'pdf' },
  { label: 'Documents', value: 'word' },
  { label: 'Spreadsheets', value: 'excel' },
  { label: 'Images', value: 'image' },
  { label: 'Videos', value: 'video' },
  { label: 'Code', value: 'code' },
]

// ── Relevance badge component ────────────────────────────────────────────────

function RelevanceBadge({ score }: { score: number }) {
  const percentage = Math.round(score * 100)
  let color = 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  if (score >= 0.7) color = 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  else if (score >= 0.5) color = 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {percentage}% match
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

function SmartSearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [typeFilter, setTypeFilter] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const runSearch = useCallback(async (q: string, type: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setLoading(true)
    setSearched(true)

    try {
      const userId = (await getUserId()) ?? ''
      if (!userId) {
        setResults({ files: [], folders: [] })
        return
      }

      // Escape special PostgREST characters in the search term
      const safe = trimmed.replace(/[%_]/g, '\\$&')
      const like = `%${safe}%`

      // Run file and folder queries in parallel
      const [fileRes, folderRes] = await Promise.all([
        supabase
          .from('files')
          .select('*')
          .eq('owner_id', userId)
          .eq('is_trashed', false)
          .ilike('name', like)
          .limit(40),
        supabase
          .from('folders')
          .select('*')
          .eq('owner_id', userId)
          .eq('is_trashed', false)
          .ilike('name', like)
          .limit(15),
      ])

      let foundFiles = (fileRes.data ?? []) as FileRecord[]

      // Also search by file_type if we got few name results
      if (foundFiles.length < 5) {
        const typeRes = await supabase
          .from('files')
          .select('*')
          .eq('owner_id', userId)
          .eq('is_trashed', false)
          .ilike('file_type', like)
          .limit(20)
        const typeFiles = (typeRes.data ?? []) as FileRecord[]
        // Merge without duplicates
        const seen = new Set(foundFiles.map((f) => f.id))
        for (const f of typeFiles) if (!seen.has(f.id)) foundFiles.push(f)
      }

      // Apply type filter client-side
      if (type) {
        foundFiles = foundFiles.filter((f) => getCategory(f.name) === type)
      }

      // Try AI semantic search (optional — never blocks results)
      let semanticResults: AISearchResult[] = []
      let searchType: 'semantic' | 'keyword' = 'keyword'
      try {
        const res = await fetch(`${API_BASE}/ai/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: trimmed,
            owner_id: userId, // Pass user ID for semantic search
            context_files: foundFiles.map((f) => ({
              id: f.id,
              name: f.name,
              type: f.file_type,
              size: f.file_size,
            })),
          }),
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const data = await res.json()
          semanticResults = (data.results ?? []) as AISearchResult[]
          searchType = (data.search_type ?? 'keyword') as 'semantic' | 'keyword'
        }
      } catch {
        /* AI unavailable — DB results still show */
      }

      setResults({
        files: foundFiles,
        folders: (folderRes.data ?? []) as Folder[],
        semanticResults,
        searchType,
      })

      void logAuditAI(`Search: ${trimmed}`)
    } catch (err) {
      console.error('[SmartSearch] error:', err)
      setResults({ files: [], folders: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  // Run search from URL param on mount
  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    if (q) void runSearch(q, typeFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/ai/search?q=${encodeURIComponent(query.trim())}`, { scroll: false })
      void runSearch(query, typeFilter)
    }
  }

  const clear = () => {
    setQuery('')
    setResults(null)
    setSearched(false)
    inputRef.current?.focus()
  }

  const totalResults =
    (results?.files.length ?? 0) + (results?.folders.length ?? 0) + (results?.semanticResults?.length ?? 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-5 w-5 text-violet-500" />
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Smart Search</h1>
        </div>
        <p className="text-sm text-neutral-500">
          Search your files by name, type, or meaning. AI-powered semantic search finds related documents.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={submit}>
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files, or describe what you're looking for…"
              className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-10 text-sm text-neutral-900 placeholder-neutral-400 transition focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
            />
            {query && (
              <button
                type="button"
                onClick={clear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="flex h-11 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>

        {/* Type filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          {TYPE_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTypeFilter(value)
                if (query.trim()) void runSearch(query, value)
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === value
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                  : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </form>

      {/* Search type indicator */}
      {results && searched && results.searchType && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          <Zap className="h-3 w-3" />
          {results.searchType === 'semantic' ? (
            <>
              <span>
                Using <strong>semantic AI search</strong> — finding documents by meaning, not just keywords
              </span>
            </>
          ) : (
            <>
              <span>Using keyword search</span>
            </>
          )}
        </div>
      )}

      {/* AI semantic results */}
      {results?.semanticResults && results.semanticResults.length > 0 && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
              Semantic Search Results
            </span>
          </div>
          <div className="space-y-2">
            {results.semanticResults.map((result, i) => (
              <div key={i} className="rounded-lg bg-white p-3 dark:bg-neutral-800/50">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                      {result.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <RelevanceBadge score={result.score} />
                    {result.file_id && (
                      <button
                        type="button"
                        onClick={() => router.push(`/drive?file=${result.file_id}`)}
                        className="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50 transition"
                        title="Open file"
                      >
                        Open
                      </button>
                    )}
                  </div>
                </div>
                {result.snippet && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                    {result.snippet}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      )}

      {!loading && searched && results && totalResults === 0 && (
        <EmptyState
          icon={<Search className="h-8 w-8 text-neutral-300" />}
          title="No results found"
          description={`No files or folders match "${query}". Try a different search term.`}
        />
      )}

      {!loading && results && totalResults > 0 && (
        <div className="space-y-6">
          <p className="text-sm text-neutral-500">
            Found <strong className="text-neutral-900 dark:text-white">{totalResults}</strong> result
            {totalResults !== 1 ? 's' : ''}
          </p>

          {results.folders.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                Folders
              </h2>
              <div className="space-y-1">
                {results.folders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => router.push(`/drive/${f.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/50"
                  >
                    <FolderIcon className="h-5 w-5 shrink-0 text-amber-500" />
                    <span className="flex-1 text-sm font-medium text-neutral-900 dark:text-white">
                      {f.name}
                    </span>
                    <span className="text-xs text-neutral-400">{formatRelativeTime(f.updated_at)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.files.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                Files
              </h2>
              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                {results.files.map((f, i) => (
                  <div
                    key={f.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${
                      i < results.files.length - 1
                        ? 'border-b border-neutral-100 dark:border-neutral-800'
                        : ''
                    }`}
                  >
                    <FileIcon name={f.name} className="h-5 w-5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                        {f.name}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        {f.file_type ?? 'Unknown'} • {formatBytes(f.file_size)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-neutral-400">
                        {formatRelativeTime(f.updated_at)}
                      </span>
                      <button
                        type="button"
                        onClick={() => router.push(`/drive?file=${f.id}`)}
                        className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition"
                        title="Open file"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Try searching for
          </h2>
          <div className="flex flex-wrap gap-2">
            {[
              'PDFs from this month',
              'machine learning documents',
              'financial reports',
              'project specifications',
              'meeting notes',
            ].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuery(s)
                  void runSearch(s, typeFilter)
                }}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SmartSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      }
    >
      <SmartSearchContent />
    </Suspense>
  )
}
