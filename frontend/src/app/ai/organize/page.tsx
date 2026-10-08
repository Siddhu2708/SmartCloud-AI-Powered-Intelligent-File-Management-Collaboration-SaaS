'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Wand2,
  Loader2,
  CheckCircle2,
  XCircle,
  FolderOpen,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Settings2,
} from 'lucide-react'
import {
  fetchFiles,
  fetchFolders,
  createFolder,
  moveFile,
} from '@/lib/storage'
import { logAudit } from '@/lib/audit'
import type { FileRecord, Folder } from '@/lib/types'
import { getCategory } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import { EmptyState } from '@/components/shared/EmptyState'

// ── AI classification logic ──────────────────────────────────────────────────

interface Suggestion {
  file: FileRecord
  sector: string
  targetFolderName: string
  confidence: 'high' | 'medium' | 'low'
  status: 'pending' | 'accepted' | 'rejected' | 'moving'
}

const SECTOR_MAP: Record<string, { sector: string; folder: string }> = {
  pdf:         { sector: 'Documents',  folder: 'Documents' },
  word:        { sector: 'Documents',  folder: 'Documents' },
  excel:       { sector: 'Data',       folder: 'Data & Spreadsheets' },
  powerpoint:  { sector: 'Documents',  folder: 'Presentations' },
  image:       { sector: 'Images',     folder: 'Images' },
  video:       { sector: 'Videos',     folder: 'Videos' },
  audio:       { sector: 'Audio',      folder: 'Audio' },
  archive:     { sector: 'Archives',   folder: 'Archives' },
  code:        { sector: 'Code',       folder: 'Code & Projects' },
  text:        { sector: 'Documents',  folder: 'Documents' },
  unknown:     { sector: 'Other',      folder: 'Other' },
}

const AI_KEYWORDS: Record<string, { sector: string; folder: string }> = {
  'machine learning':   { sector: 'AI & ML',       folder: 'AI & Machine Learning' },
  'deep learning':      { sector: 'AI & ML',       folder: 'AI & Machine Learning' },
  'neural network':     { sector: 'AI & ML',       folder: 'AI & Machine Learning' },
  'nlp':                { sector: 'AI & ML',       folder: 'AI & Machine Learning' },
  'cloud':              { sector: 'Technology',    folder: 'Cloud Computing' },
  'kubernetes':         { sector: 'Technology',    folder: 'Cloud Computing' },
  'docker':             { sector: 'Technology',    folder: 'Cloud Computing' },
  'resume':             { sector: 'Career',        folder: 'Career' },
  'cv':                 { sector: 'Career',        folder: 'Career' },
  'cover letter':       { sector: 'Career',        folder: 'Career' },
  'invoice':            { sector: 'Finance',       folder: 'Finance' },
  'receipt':            { sector: 'Finance',       folder: 'Finance' },
  'budget':             { sector: 'Finance',       folder: 'Finance' },
  'research':           { sector: 'Research',      folder: 'Research' },
  'thesis':             { sector: 'Academic',      folder: 'Academic' },
  'lecture':            { sector: 'Academic',      folder: 'Academic' },
  'assignment':         { sector: 'Academic',      folder: 'Academic' },
  'project':            { sector: 'Projects',      folder: 'Projects' },
  'report':             { sector: 'Documents',     folder: 'Reports' },
  'legal':              { sector: 'Legal',         folder: 'Legal' },
  'contract':           { sector: 'Legal',         folder: 'Legal' },
  'medical':            { sector: 'Medical',       folder: 'Medical' },
  'health':             { sector: 'Medical',       folder: 'Medical' },
  'personal':           { sector: 'Personal',      folder: 'Personal' },
}

function classifyFile(file: FileRecord): { sector: string; folder: string; confidence: 'high' | 'medium' | 'low' } {
  const nameLower = file.name.toLowerCase()

  // Check keyword rules first (highest confidence)
  for (const [keyword, mapping] of Object.entries(AI_KEYWORDS)) {
    if (nameLower.includes(keyword)) {
      return { ...mapping, confidence: 'high' }
    }
  }

  // Fall back to extension-based category
  const cat = getCategory(file.name)
  const mapping = SECTOR_MAP[cat] ?? SECTOR_MAP.unknown
  const confidence = cat === 'unknown' ? 'low' : 'medium'
  return { ...mapping, confidence }
}

// ── Suggestion card ───────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: Suggestion
  onAccept: () => void
  onReject: () => void
}) {
  const confidenceColor = {
    high:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    low:    'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
  }[suggestion.confidence]

  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{suggestion.file.name}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
          <span>→</span>
          <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-medium text-neutral-700 dark:text-neutral-300">{suggestion.targetFolderName}</span>
          <ChevronRight className="h-3 w-3" />
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${confidenceColor}`}>
            {suggestion.confidence}
          </span>
        </div>
      </div>

      {suggestion.status === 'moving' ? (
        <Loader2 className="h-4 w-4 animate-spin text-neutral-400 shrink-0" />
      ) : suggestion.status === 'accepted' ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
      ) : suggestion.status === 'rejected' ? (
        <XCircle className="h-5 w-5 text-neutral-300 dark:text-neutral-600 shrink-0" />
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onReject}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Accept
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SmartOrganizePage() {
  const { success, error: toastError } = useToast()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [autoOrg, setAutoOrg] = useState(false)
  const [orgMode, setOrgMode] = useState<'manual' | 'suggest' | 'auto'>('suggest')

  // Load settings from localStorage
  useEffect(() => {
    const mode = window.localStorage.getItem('smartcloud.org-mode') as 'manual' | 'suggest' | 'auto' | null
    if (mode) setOrgMode(mode)
  }, [])

  const analyze = useCallback(async () => {
    setLoading(true)
    try {
      const files = await fetchFiles(null)
      // Only suggest for files in root (no folder) that could be better organized
      const rootFiles = files.filter((f) => !f.folder_id && !f.is_trashed)

      const newSuggestions: Suggestion[] = rootFiles
        .map((file) => {
          const { sector, folder, confidence } = classifyFile(file)
          return {
            file,
            sector,
            targetFolderName: folder,
            confidence,
            status: 'pending' as const,
          }
        })
        .filter((s) => s.confidence !== 'low' || s.targetFolderName !== 'Other')

      setSuggestions(newSuggestions)
      setAnalyzed(true)
    } catch {
      toastError('Could not analyze your files.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  const ensureFolder = async (name: string, existingFolders: Folder[]): Promise<string> => {
    const existing = existingFolders.find((f) => f.name === name && !f.is_trashed)
    if (existing) return existing.id
    const created = await createFolder(name, null)
    return created.id
  }

  const acceptSuggestion = async (index: number) => {
    const s = suggestions[index]
    setSuggestions((prev) => prev.map((x, i) => i === index ? { ...x, status: 'moving' } : x))
    try {
      const folders = await fetchFolders(null)
      const folderId = await ensureFolder(s.targetFolderName, folders)
      await moveFile(s.file.id, folderId)
      await logAudit({ action: 'FILE_MOVED', resourceType: 'file', resourceId: s.file.id, metadata: { to: s.targetFolderName, ai: true } })
      setSuggestions((prev) => prev.map((x, i) => i === index ? { ...x, status: 'accepted' } : x))
      success(`Moved "${s.file.name}" to ${s.targetFolderName}`)
    } catch {
      setSuggestions((prev) => prev.map((x, i) => i === index ? { ...x, status: 'pending' } : x))
      toastError(`Could not move "${s.file.name}". Please try again.`)
    }
  }

  const rejectSuggestion = (index: number) => {
    setSuggestions((prev) => prev.map((x, i) => i === index ? { ...x, status: 'rejected' } : x))
  }

  const acceptAll = async () => {
    const pending = suggestions
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.status === 'pending')
    for (const { i } of pending) {
      await acceptSuggestion(i)
    }
  }

  const pendingCount = suggestions.filter((s) => s.status === 'pending').length
  const acceptedCount = suggestions.filter((s) => s.status === 'accepted').length

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="h-5 w-5 text-amber-500" />
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Smart Organize</h1>
        </div>
        <p className="text-sm text-neutral-500">
          SmartCloud AI analyzes your files and suggests the best folder structure based on content type and keywords.
        </p>
      </div>

      {/* Settings card */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="h-4 w-4 text-neutral-500" />
          <p className="text-sm font-medium text-neutral-900 dark:text-white">Organization mode</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['manual', 'suggest', 'auto'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => { setOrgMode(mode); window.localStorage.setItem('smartcloud.org-mode', mode) }}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition capitalize ${
                orgMode === mode
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black'
                  : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800'
              }`}
            >
              {mode === 'manual' ? 'Manual' : mode === 'suggest' ? 'Suggest' : 'Auto'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-neutral-400">
          {orgMode === 'manual' && 'Files are never moved automatically.'}
          {orgMode === 'suggest' && 'SmartCloud will suggest moves — you approve each one.'}
          {orgMode === 'auto' && 'SmartCloud automatically organizes new uploads. You can always undo.'}
        </p>
      </div>

      {/* Analyze button */}
      {!analyzed ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-16 text-center dark:border-neutral-800">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/20">
            <Wand2 className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Analyze your Drive</h2>
          <p className="mt-2 max-w-xs text-sm text-neutral-500">
            SmartCloud will scan your root files and suggest the best folder for each one.
          </p>
          <button
            type="button"
            onClick={() => void analyze()}
            disabled={loading}
            className="mt-6 flex items-center gap-2 rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Analyzing…' : 'Analyze my Drive'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-white">
                {suggestions.length === 0
                  ? 'Your Drive is already well organized!'
                  : `${pendingCount} suggestion${pendingCount !== 1 ? 's' : ''} pending`}
              </p>
              {acceptedCount > 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{acceptedCount} moved successfully</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setSuggestions([]); setAnalyzed(false) }}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Re-analyze
              </button>
              {pendingCount > 1 && (
                <button
                  type="button"
                  onClick={() => void acceptAll()}
                  className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-black"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Accept all ({pendingCount})
                </button>
              )}
            </div>
          </div>

          {suggestions.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-9 w-9 text-emerald-400" />}
              title="Drive looks great!"
              description="All your root files are already in appropriate folders, or there are no files to organize."
            />
          ) : (
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <SuggestionCard
                  key={s.file.id}
                  suggestion={s}
                  onAccept={() => void acceptSuggestion(i)}
                  onReject={() => rejectSuggestion(i)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
