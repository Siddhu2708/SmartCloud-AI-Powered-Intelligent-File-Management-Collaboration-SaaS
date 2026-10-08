export type FileActionKey =
  | 'open'
  | 'preview'
  | 'download'
  | 'rename'
  | 'move'
  | 'share'
  | 'star'
  | 'details'
  | 'delete'

export type FolderActionKey =
  | 'open'
  | 'rename'
  | 'move'
  | 'share'
  | 'star'
  | 'details'
  | 'delete'

export interface FileGridProps {
  files: Array<{ id: string; name: string; file_type: string | null; file_size: number; updated_at: string; is_starred: boolean }>
  folders: Array<{ id: string; name: string; updated_at: string; is_starred: boolean }>
  onFileAction: (id: string, action: FileActionKey) => void
  onFolderAction: (id: string, action: FolderActionKey) => void
  onCardContextMenu?: (e: React.MouseEvent, kind: 'file' | 'folder', id: string) => void
}
