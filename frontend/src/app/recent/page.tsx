'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, UploadCloud, LayoutGrid, List } from 'lucide-react'
import { FileGrid } from '@/components/drive/FileGrid'
import { FileList } from '@/components/drive/FileList'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/Loading'
import { useToast } from '@/components/shared/Toast'
import { supabase } from '@/lib/supabase'
import {
  fetchRecentFiles,
  downloadFile,
  toggleStarFile,
  trashFileSingle,
  renameFilePhysical,
} from '@/lib/storage'
import { logAudit } from '@/lib/audit'
import type { FileRecord } from '@/lib/types'
import type { FileActionKey } from '@/components/drive/types'
import { RenameModal } from '@/components/drive/RenameModal'
import { DetailsModal } from '@/components/drive/DetailsModal'
import { PreviewModal } from '@/components/drive/PreviewModal'

export default function RecentPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [renameTarget, setRenameTarget] = useState<FileRecord | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<FileRecord | null>(null)
  const [previewTarget, setPreviewTarget] = useState<FileRecord | null>(null)

  useEffect(() => {
    let active = true
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const recent = await fetchRecentFiles(user.id, 50)
      if (active) setFiles(recent)
    }
    run().catch(() => { if (true) setFiles([]) }).finally(() => setLoading(false))
    return () => { active = false }
  }, [])

  const findFile = (id: string) => files.find((f) => f.id === id)

  const handleAction = async (id: string, action: FileActionKey) => {
    const file = findFile(id)
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
      case 'rename':
        setRenameTarget(file)
        break
      case 'details':
        setDetailsTarget(file)
        break
      case 'star':
        try {
          await toggleStarFile(file.id, file.is_starred)
          setFiles((prev) => prev.map((f) => f.id === file.id ? { ...f, is_starred: !f.is_starred } : f))
          success(file.is_starred ? 'Removed from Starred' : 'Added to Starred')
        } catch { toastError('Could not update star.') }
        break
      case 'delete':
        try {
          await trashFileSingle(file.id)
          await logAudit({ action: 'FILE_DELETED', resourceType: 'file', resourceId: file.id })
          setFiles((prev) => prev.filter((f) => f.id !== file.id))
          success('Moved to Trash')
        } catch { toastError('Could not delete file.') }
        break
      case 'move':
        router.push(`/drive?moveFile=${file.id}`)
        break
      case 'share':
        router.push(`/drive?shareFile=${file.id}`)
        break
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-neutral-100 p-2 dark:bg-neutral-800">
            <Clock className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Recent</h1>
            <p className="text-sm text-neutral-500">Your most recently modified files.</p>
          </div>
        </div>
        <div className="flex items-center overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
          <button onClick={() => setView('grid')} aria-label="Grid view" className={`p-2 transition-colors ${view === 'grid' ? 'bg-neutral-200/70 dark:bg-white/10 text-neutral-900 dark:text-white' : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setView('list')} aria-label="List view" className={`p-2 transition-colors ${view === 'list' ? 'bg-neutral-200/70 dark:bg-white/10 text-neutral-900 dark:text-white' : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : files.length === 0 ? (
        <EmptyState
          icon={<UploadCloud className="h-9 w-9 text-neutral-400 dark:text-neutral-500" />}
          title="No recent files"
          description="Files you upload or edit will appear here."
        />
      ) : view === 'grid' ? (
        <FileGrid files={files} folders={[]} onFileAction={handleAction} onFolderAction={() => undefined} />
      ) : (
        <FileList files={files} folders={[]} onFileAction={handleAction} onFolderAction={() => undefined} />
      )}

      <RenameModal
        open={renameTarget !== null}
        initialName={renameTarget?.name ?? ''}
        title="Rename file"
        onClose={() => setRenameTarget(null)}
        onSave={async (name) => {
          if (renameTarget) {
            try {
              const updated = await renameFilePhysical(renameTarget, name)
              setFiles((prev) => prev.map((f) => f.id === updated.id ? updated : f))
              success('File renamed')
            } catch {
              toastError('Could not rename file.')
            }
          }
          setRenameTarget(null)
        }}
      />

      <DetailsModal
        open={detailsTarget !== null}
        onClose={() => setDetailsTarget(null)}
        item={detailsTarget}
        kind="file"
      />

      <PreviewModal
        file={previewTarget}
        onClose={() => setPreviewTarget(null)}
      />
    </div>
  )
}
