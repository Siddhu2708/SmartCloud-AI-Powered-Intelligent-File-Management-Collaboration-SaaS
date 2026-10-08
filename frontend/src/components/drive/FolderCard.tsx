'use client'

import type { Folder } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { Folder as FolderIcon, Star } from 'lucide-react'
import { DropdownMenu } from '@/components/shared/DropdownMenu'

export interface FolderActionsConfig {
  onOpen: () => void
  onRename: () => void
  onMove: () => void
  onShare: () => void
  onStar: () => void
  onDetails: () => void
  onDelete: () => void
  starred: boolean
}

export function FolderCard({ folder, actions, onContextMenu }: { folder: Folder; actions: FolderActionsConfig; onContextMenu?: React.MouseEventHandler }) {
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
          <FolderIcon className="w-6 h-6 text-amber-500" />
        </div>
        <DropdownMenu
          ariaLabel={`Actions for folder ${folder.name}`}
          actions={[
            { label: 'Open', onClick: actions.onOpen },
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
      <p className="font-medium text-neutral-900 dark:text-white text-sm truncate" title={folder.name}>
        {folder.name}
      </p>
      <p className="text-xs text-neutral-500 mt-1">Folder</p>
      <p className="text-xs text-neutral-500 mt-0.5">Modified {formatDate(folder.updated_at)}</p>
    </div>
  )
}
