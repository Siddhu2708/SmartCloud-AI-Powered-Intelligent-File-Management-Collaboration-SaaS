'use client'

import { useEffect, useState } from 'react'
import { Folder as FolderIcon, FileText, RotateCcw, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/Loading'
import { useToast } from '@/components/shared/Toast'
import {
  fetchFiles,
  fetchFolders,
  permanentlyDeleteFile,
  permanentlyDeleteFolder,
  restoreFileSingle,
  restoreFolder,
} from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import type { FileRecord, Folder } from '@/lib/types'

interface TrashItem {
  id: string
  name: string
  kind: 'file' | 'folder'
  file?: FileRecord
  folder?: Folder
}

export default function TrashPage() {
  const { success, error: toastError } = useToast()
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [folderData, fileData] = await Promise.all([
      fetchFolders(null, { trashed: true }),
      fetchFiles(null, { trashed: true }),
    ])

    setItems([
      ...fileData.map((file) => ({ id: file.id, name: file.name, kind: 'file' as const, file })),
      ...folderData.map((folder) => ({ id: folder.id, name: folder.name, kind: 'folder' as const, folder })),
    ])
  }

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        await refresh()
      } catch {
        if (active) setItems([])
      } finally {
        if (active) setLoading(false)
      }
    }

    void run()

    return () => {
      active = false
    }
  }, [])

  const handleRestore = async (item: TrashItem) => {
    try {
      if (item.kind === 'file' && item.file) {
        await restoreFileSingle(item.file.id)
      }
      if (item.kind === 'folder' && item.folder) {
        await restoreFolder(item.folder.id)
      }
      success(`${item.name} restored`)
      await refresh()
    } catch {
      toastError('Could not restore this item.')
    }
  }

  const handleDeleteForever = async (item: TrashItem) => {
    try {
      if (item.kind === 'file' && item.file) {
        await permanentlyDeleteFile(item.file.id, item.file.storage_path)
      }
      if (item.kind === 'folder' && item.folder) {
        await permanentlyDeleteFolder(item.folder.id)
      }
      success(`${item.name} deleted permanently`)
      await refresh()
    } catch {
      toastError('Could not delete this item permanently.')
    }
  }

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-neutral-100 p-2.5 dark:bg-neutral-800">
          <Trash2 className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Trash</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Deleted items waiting to be restored or permanently removed.</p>
        </div>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Trash2 className="h-9 w-9 text-neutral-400 dark:text-neutral-500" />}
          title="Trash is empty"
          description="Deleted files and folders will appear here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const Icon = item.kind === 'file' ? FileText : FolderIcon
            return (
              <div key={item.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                    <Icon className={`h-5 w-5 ${item.kind === 'folder' ? 'text-amber-500' : 'text-neutral-700 dark:text-neutral-200'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{item.name}</p>
                    <p className="text-xs text-neutral-500">{item.kind === 'file' ? 'File' : 'Folder'}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRestore(item)}
                    className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteForever(item)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete forever
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
