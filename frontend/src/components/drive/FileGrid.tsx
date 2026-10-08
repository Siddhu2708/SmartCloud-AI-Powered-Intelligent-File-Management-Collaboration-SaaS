'use client'

import type { FileRecord, Folder } from '@/lib/types'
import { FolderCard } from './FolderCard'
import { FileCard } from './FileCard'
import type { FileActionKey, FolderActionKey } from './types'

interface FileGridProps {
  files: FileRecord[]
  folders: Folder[]
  onFileAction: (id: string, action: FileActionKey) => void
  onFolderAction: (id: string, action: FolderActionKey) => void
  onCardContextMenu?: (e: React.MouseEvent, kind: 'file' | 'folder', id: string) => void
}

export function FileGrid({ files, folders, onFileAction, onFolderAction, onCardContextMenu }: FileGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          folder={folder}
          onContextMenu={onCardContextMenu ? (e) => onCardContextMenu(e, 'folder', folder.id) : undefined}
          actions={{
            onOpen: () => onFolderAction(folder.id, 'open'),
            onRename: () => onFolderAction(folder.id, 'rename'),
            onMove: () => onFolderAction(folder.id, 'move'),
            onShare: () => onFolderAction(folder.id, 'share'),
            onStar: () => onFolderAction(folder.id, 'star'),
            onDetails: () => onFolderAction(folder.id, 'details'),
            onDelete: () => onFolderAction(folder.id, 'delete'),
            starred: folder.is_starred,
          }}
        />
      ))}
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          onContextMenu={onCardContextMenu ? (e) => onCardContextMenu(e, 'file', file.id) : undefined}
          actions={{
            onOpen: () => onFileAction(file.id, 'open'),
            onPreview: () => onFileAction(file.id, 'preview'),
            onDownload: () => onFileAction(file.id, 'download'),
            onRename: () => onFileAction(file.id, 'rename'),
            onMove: () => onFileAction(file.id, 'move'),
            onShare: () => onFileAction(file.id, 'share'),
            onStar: () => onFileAction(file.id, 'star'),
            onDetails: () => onFileAction(file.id, 'details'),
            onDelete: () => onFileAction(file.id, 'delete'),
            starred: file.is_starred,
          }}
        />
      ))}
    </div>
  )
}
