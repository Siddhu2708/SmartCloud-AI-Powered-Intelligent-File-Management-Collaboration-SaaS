'use client'

import { useEffect, useState } from 'react'
import { Loader2, HardDrive, Folder, ChevronRight } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { fetchFolders } from '@/lib/storage'
import type { Folder as FolderType } from '@/lib/types'

interface MoveModalProps {
  open: boolean
  onClose: () => void
  onMove: (folderId: string | null) => Promise<void>
  itemName: string
}

export function MoveModal({ open, onClose, onMove, itemName }: MoveModalProps) {
  const [currentParent, setCurrentParent] = useState<string | null>(null)
  const [path, setPath] = useState<FolderType[]>([])
  const [folders, setFolders] = useState<FolderType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCurrentParent(null)
    setPath([])
    setError(null)
    load(currentParent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const load = async (parentId: string | null) => {
    setLoading(true)
    try {
      setFolders(await fetchFolders(parentId))
    } catch {
      setFolders([])
    } finally {
      setLoading(false)
    }
  }

  const enter = async (folder: FolderType) => {
    setPath((p) => [...p, folder])
    setCurrentParent(folder.id)
    await load(folder.id)
  }

  const goUp = async () => {
    const parent = path[path.length - 1]?.parent_id ?? null
    setPath((p) => p.slice(0, -1))
    setCurrentParent(parent)
    await load(parent)
  }

  const submit = async () => {
    setLoading(true)
    setError(null)
    try {
      await onMove(currentParent)
      onClose()
    } catch {
      setError('Could not move. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Move to">
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 truncate">{itemName}</p>

      <div className="flex items-center gap-1 text-xs text-neutral-500 mb-3 flex-wrap">
        <button onClick={() => { setCurrentParent(null); setPath([]); load(null) }} className="flex items-center gap-1 hover:text-neutral-900 dark:hover:text-white">
          <HardDrive className="w-3.5 h-3.5" /> My Drive
        </button>
        {path.map((f, i) => (
          <span key={f.id} className="flex items-center gap-1 min-w-0">
            <ChevronRight className="w-3 h-3" />
            <button
              onClick={() => {
                const newParent = f.parent_id
                setPath(path.slice(0, i + 1))
                setCurrentParent(newParent)
                load(newParent)
              }}
              className="truncate max-w-[120px] hover:text-neutral-900 dark:hover:text-white"
            >
              {f.name}
            </button>
          </span>
        ))}
      </div>

      {path.length > 0 && (
        <button onClick={goUp} className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white mb-2">
          ↑ Up one level
        </button>
      )}

      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg max-h-56 overflow-auto divide-y divide-neutral-100 dark:divide-neutral-800">
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-neutral-400" /></div>
        ) : folders.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500 text-center">No subfolders here.</p>
        ) : (
          folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => enter(folder)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white text-left"
            >
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="truncate">{folder.name}</span>
            </button>
          ))
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Move here
        </button>
      </div>
    </Modal>
  )
}