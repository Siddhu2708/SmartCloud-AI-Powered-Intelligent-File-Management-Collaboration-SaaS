'use client'

import { Modal } from '@/components/shared/Modal'
import { FileIcon } from '@/components/shared/FileIcon'
import { formatBytes, formatDate } from '@/lib/utils'

interface DetailsModalProps {
  open: boolean
  onClose: () => void
  item: { name: string; file_size?: number; file_type?: string | null; created_at?: string; updated_at?: string; is_starred?: boolean } | null
  kind: 'file' | 'folder'
}

export function DetailsModal({ open, onClose, item, kind }: DetailsModalProps) {
  if (!item) return null
  return (
    <Modal open={open} onClose={onClose} title="Details">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
          {kind === 'folder' ? (
            <span className="text-xl">📁</span>
          ) : (
            <FileIcon name={item.name} className="w-6 h-6" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-neutral-900 dark:text-white truncate">{item.name}</p>
          <p className="text-xs text-neutral-500">{kind === 'folder' ? 'Folder' : (item.file_type ?? 'Unknown')}</p>
        </div>
      </div>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-500">Size</dt>
          <dd className="text-neutral-900 dark:text-white">{kind === 'file' ? formatBytes(item.file_size ?? 0) : '--'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">Created</dt>
          <dd className="text-neutral-900 dark:text-white">{formatDate(item.created_at ?? '')}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">Modified</dt>
          <dd className="text-neutral-900 dark:text-white">{formatDate(item.updated_at ?? '')}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">Starred</dt>
          <dd className="text-neutral-900 dark:text-white">{item.is_starred ? 'Yes' : 'No'}</dd>
        </div>
      </dl>
      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
  )
}