'use client'

import type { FileRecord } from '@/lib/types'
import { formatBytes, formatDate } from '@/lib/utils'
import { FileIcon } from '@/components/shared/FileIcon'
import { DropdownMenu } from '@/components/shared/DropdownMenu'
import { Eye, Star } from 'lucide-react'

export interface FileActionsConfig {
  onOpen: () => void
  onPreview: () => void
  onDownload: () => void
  onRename: () => void
  onMove: () => void
  onShare: () => void
  onStar: () => void
  onDetails: () => void
  onDelete: () => void
  starred: boolean
}

export function FileCard({ file, actions, onContextMenu }: { file: FileRecord; actions: FileActionsConfig; onContextMenu?: React.MouseEventHandler }) {
  return (
    <div
      onClick={actions.onOpen}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(e)
      }}
      className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:border-neutral-300 dark:hover:border-neutral-700 group select-none"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
          <FileIcon name={file.name} className="w-6 h-6" />
        </div>
        <DropdownMenu
          ariaLabel={`Actions for ${file.name}`}
          actions={[
            { label: 'Open', onClick: actions.onOpen },
            { label: 'Preview', icon: <Eye className="w-4 h-4 text-neutral-400" />, onClick: actions.onPreview },
            { label: 'Download', onClick: actions.onDownload },
            { label: 'Rename', onClick: actions.onRename },
            { label: 'Move', onClick: actions.onMove },
            { label: 'Share', onClick: actions.onShare },
            {
              label: actions.starred ? 'Remove from Starred' : 'Add to Starred',
              icon: <Star className={`w-4 h-4 ${actions.starred ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-400'}`} />,
              onClick: actions.onStar,
            },
            { label: 'Details', onClick: actions.onDetails },
            { divider: true, label: '', onClick: () => {} },
            { label: 'Delete', onClick: actions.onDelete, danger: true },
          ]}
        />
      </div>
      <p className="font-medium text-neutral-900 dark:text-white text-sm truncate" title={file.name}>
        {file.name}
      </p>
      <p className="text-xs text-neutral-500 mt-1">
        {file.file_type ?? 'Unknown'} • {formatBytes(file.file_size)}
      </p>
      <p className="text-xs text-neutral-500 mt-0.5">Modified {formatDate(file.updated_at)}</p>
    </div>
  )
}
