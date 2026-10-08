'use client'

import type { FileGridProps } from './types'
import { FileIcon } from '@/components/shared/FileIcon'
import { DropdownMenu } from '@/components/shared/DropdownMenu'
import { Folder, Star } from 'lucide-react'
import { formatBytes, formatDate } from '@/lib/utils'

export function FileList({ files, folders, onFileAction, onFolderAction, onCardContextMenu }: FileGridProps) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-[minmax(0,1fr)_100px_90px_110px_36px] sm:grid-cols-[minmax(0,1fr)_120px_100px_130px_36px] gap-3 px-4 py-2.5 text-xs font-semibold text-neutral-400 uppercase tracking-widest border-b border-neutral-200 dark:border-neutral-800">
        <div>Name</div>
        <div>Type</div>
        <div>Size</div>
        <div>Modified</div>
        <div />
      </div>

      {folders.map((folder) => (
        <div
          key={folder.id}
          onClick={() => onFolderAction(folder.id, 'open')}
          onContextMenu={(e) => {
            e.preventDefault()
            onCardContextMenu?.(e, 'folder', folder.id)
          }}
          className="grid grid-cols-[minmax(0,1fr)_100px_90px_110px_36px] sm:grid-cols-[minmax(0,1fr)_120px_100px_130px_36px] gap-3 px-4 py-2.5 items-center hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40 rounded-lg cursor-pointer transition-colors border-b border-neutral-100 dark:border-neutral-800/60"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Folder className="w-5 h-5 text-amber-500 shrink-0" />
            <span className="text-sm text-neutral-900 dark:text-white truncate">{folder.name}</span>
            {folder.is_starred && <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0" />}
          </div>
          <span className="text-xs text-neutral-500">Folder</span>
          <span className="text-xs text-neutral-500">--</span>
          <span className="text-xs text-neutral-500">{formatDate(folder.updated_at)}</span>
          <div>
            <DropdownMenu
              ariaLabel={`Actions for folder ${folder.name}`}
              actions={[
                { label: 'Open', onClick: () => onFolderAction(folder.id, 'open') },
                { label: 'Rename', onClick: () => onFolderAction(folder.id, 'rename') },
                { label: 'Move', onClick: () => onFolderAction(folder.id, 'move') },
                { label: 'Share', onClick: () => onFolderAction(folder.id, 'share') },
                {
                  label: folder.is_starred ? 'Remove from Starred' : 'Add to Starred',
                  icon: <Star className={`w-4 h-4 ${folder.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-400'}`} />,
                  onClick: () => onFolderAction(folder.id, 'star'),
                },
                { label: 'Details', onClick: () => onFolderAction(folder.id, 'details') },
                { divider: true, label: '', onClick: () => {} },
                { label: 'Delete', onClick: () => onFolderAction(folder.id, 'delete'), danger: true },
              ]}
            />
          </div>
        </div>
      ))}

      {files.map((file) => (
        <div
          key={file.id}
          onClick={() => onFileAction(file.id, 'open')}
          onContextMenu={(e) => {
            e.preventDefault()
            onCardContextMenu?.(e, 'file', file.id)
          }}
          className="grid grid-cols-[minmax(0,1fr)_100px_90px_110px_36px] sm:grid-cols-[minmax(0,1fr)_120px_100px_130px_36px] gap-3 px-4 py-2.5 items-center hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40 rounded-lg cursor-pointer transition-colors border-b border-neutral-100 dark:border-neutral-800/60"
        >
          <div className="flex items-center gap-3 min-w-0">
            <FileIcon name={file.name} className="w-5 h-5 shrink-0" />
            <span className="text-sm text-neutral-900 dark:text-white truncate">{file.name}</span>
            {file.is_starred && <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0" />}
          </div>
          <span className="text-xs text-neutral-500">{file.file_type ?? 'Unknown'}</span>
          <span className="text-xs text-neutral-500">{formatBytes(file.file_size)}</span>
          <span className="text-xs text-neutral-500">{formatDate(file.updated_at)}</span>
          <div>
            <DropdownMenu
              ariaLabel={`Actions for ${file.name}`}
              actions={[
                { label: 'Open', onClick: () => onFileAction(file.id, 'open') },
                { label: 'Preview', onClick: () => onFileAction(file.id, 'preview') },
                { label: 'Download', onClick: () => onFileAction(file.id, 'download') },
                { label: 'Rename', onClick: () => onFileAction(file.id, 'rename') },
                { label: 'Move', onClick: () => onFileAction(file.id, 'move') },
                { label: 'Share', onClick: () => onFileAction(file.id, 'share') },
                {
                  label: file.is_starred ? 'Remove from Starred' : 'Add to Starred',
                  icon: <Star className={`w-4 h-4 ${file.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-400'}`} />,
                  onClick: () => onFileAction(file.id, 'star'),
                },
                { label: 'Details', onClick: () => onFileAction(file.id, 'details') },
                { divider: true, label: '', onClick: () => {} },
                { label: 'Delete', onClick: () => onFileAction(file.id, 'delete'), danger: true },
              ]}
            />
          </div>
        </div>
      ))}
    </div>
  )
}