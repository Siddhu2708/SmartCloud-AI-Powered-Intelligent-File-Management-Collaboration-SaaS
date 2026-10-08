'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star, LayoutGrid, List } from 'lucide-react'
import { FileGrid } from '@/components/drive/FileGrid'
import { FileList } from '@/components/drive/FileList'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/Loading'
import { useToast } from '@/components/shared/Toast'
import {
  fetchFiles,
  fetchFolders,
  downloadFile,
  toggleStarFile,
  toggleStarFolder,
  trashFileSingle,
  trashFolder,
} from '@/lib/storage'
import { logAudit } from '@/lib/audit'
import { supabase } from '@/lib/supabase'
import type { FileRecord, Folder } from '@/lib/types'
import type { FileActionKey, FolderActionKey } from '@/components/drive/types'
import { DetailsModal } from '@/components/drive/DetailsModal'
import { PreviewModal } from '@/components/drive/PreviewModal'

export default function StarredPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()
  const [files, setFiles] = useState<FileRecord[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [detailsTarget, setDetailsTarget] = useState<{ item: FileRecord | Folder; kind: 'file' | 'folder' } | null>(null)
  const [previewTarget, setPreviewTarget] = useState<FileRecord | null>(null)

  const refresh = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [foldersData, filesData] = await Promise.all([
      fetchFolders(null, { starred: true }),
      fetchFiles(null, { starred: true }),
    ])
    setFolders(foldersData)
    setFiles(filesData)
  }

  useEffect(() => {
    let active = true
    refresh()
      .catch(() => { if (active) { setFiles([]); setFolders([]) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const handleFileAction = async (id: string, action: FileActionKey) => {
    const file = files.find((f) => f.id === id)
    if (!file) return
    switch (action) {
      case 'open':
      case 'download':
        try {
          await downloadFile(file)
          await logAudit({ action: 'FILE_DOWNLOADED', resourceType: 'file', resourceId: file.id })
        } catch { toastError('Download failed.') }
        break
      case 'preview':
        setPreviewTarget(file)
        break
      case 'star':
        try {
          await toggleStarFile(file.id, file.is_starred)
          setFiles((prev) => prev.filter((f) => f.id !== file.id))
          success('Removed from Starred')
        } catch { toastError('Could not update star.') }
        break
      case 'delete':
        try {
          await trashFileSingle(file.id)
          await logAudit({ action: 'FILE_DELETED', resourceType: 'file', resourceId: file.id })
          setFiles((prev) => prev.filter((f) => f.id !== file.id))
          success('Moved to Trash')
        } catch { toastError('Could not delete.') }
        break
      case 'details':
        setDetailsTarget({ item: file, kind: 'file' })
        break
      case 'move':
        router.push(`/drive?moveFile=${file.id}`)
        break
      case 'share':
        router.push(`/drive?shareFile=${file.id}`)
        break
      case 'rename':
        router.push(`/drive`)
        break
    }
  }

  const handleFolderAction = async (id: string, action: FolderActionKey) => {
    const folder = folders.find((f) => f.id === id)
    if (!folder) return
    switch (action) {
      case 'open':
        router.push(`/drive/${folder.id}`)
        break
      case 'star':
        try {
          await toggleStarFolder(folder.id, folder.is_starred)
          setFolders((prev) => prev.filter((f) => f.id !== folder.id))
          success('Removed from Starred')
        } catch { toastError('Could not update star.') }
        break
      case 'delete':
        try {
          await trashFolder(folder.id)
          await logAudit({ action: 'FOLDER_DELETED', resourceType: 'folder', resourceId: folder.id })
          setFolders((prev) => prev.filter((f) => f.id !== folder.id))
          success('Folder moved to Trash')
        } catch { toastError('Could not delete folder.') }
        break
      case 'details':
        setDetailsTarget({ item: folder, kind: 'folder' })
        break
      case 'rename':
      case 'move':
      case 'share':
        router.push(`/drive/${folder.id}`)
        break
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-yellow-50 p-2 dark:bg-yellow-950/20">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Starred</h1>
            <p className="text-sm text-neutral-500">Files and folders you pinned for quick access.</p>
          </div>
        </div>
        <div className="flex items-center overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
          <button onClick={() => setView('grid')} aria-label="Grid view" className={`p-2 transition-colors ${view === 'grid' ? 'bg-neutral-200/70 dark:bg-white/10 text-neutral-900 dark:text-white' : 'text-neutral-400'}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setView('list')} aria-label="List view" className={`p-2 transition-colors ${view === 'list' ? 'bg-neutral-200/70 dark:bg-white/10 text-neutral-900 dark:text-white' : 'text-neutral-400'}`}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : files.length === 0 && folders.length === 0 ? (
        <EmptyState
          icon={<Star className="h-9 w-9 fill-yellow-400 text-yellow-400" />}
          title="No starred items"
          description="Star files and folders to keep them here for quick access."
        />
      ) : view === 'grid' ? (
        <FileGrid files={files} folders={folders} onFileAction={handleFileAction} onFolderAction={handleFolderAction} />
      ) : (
        <FileList files={files} folders={folders} onFileAction={handleFileAction} onFolderAction={handleFolderAction} />
      )}

      <DetailsModal
        open={detailsTarget !== null}
        onClose={() => setDetailsTarget(null)}
        item={detailsTarget?.item ?? null}
        kind={detailsTarget?.kind ?? 'file'}
      />

      <PreviewModal
        file={previewTarget}
        onClose={() => setPreviewTarget(null)}
      />
    </div>
  )
}
