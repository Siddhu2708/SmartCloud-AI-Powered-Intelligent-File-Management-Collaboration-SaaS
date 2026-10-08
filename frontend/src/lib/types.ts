export interface Folder {
  id: string
  owner_id: string
  parent_id: string | null
  name: string
  is_starred: boolean
  is_trashed: boolean
  created_at: string
  updated_at: string
}

export interface FileRecord {
  id: string
  owner_id: string
  folder_id: string | null
  name: string
  storage_path: string
  file_type: string | null
  mime_type: string | null
  file_size: number
  is_starred: boolean
  is_trashed: boolean
  created_at: string
  updated_at: string
}

export interface Share {
  id: string
  file_id: string | null
  folder_id: string | null
  owner_id: string
  shared_with: string
  permission: 'viewer' | 'editor'
  expires_at: string | null
  created_at: string
  owner_email?: string
  owner_name?: string
  file?: FileRecord | null
  folder?: Folder | null
}

export interface AuditAction {
  FILE_UPLOADED: string
  FILE_DOWNLOADED: string
  FILE_RENAMED: string
  FILE_DELETED: string
  FOLDER_CREATED: string
  FOLDER_RENAMED: string
  FOLDER_DELETED: string
  FILE_SHARED: string
  FILE_MOVED: string
  FOLDER_MOVED: string
  FILE_RESTORED: string
  FOLDER_RESTORED: string
}

export const AUDIT: AuditAction = {
  FILE_UPLOADED: 'FILE_UPLOADED',
  FILE_DOWNLOADED: 'FILE_DOWNLOADED',
  FILE_RENAMED: 'FILE_RENAMED',
  FILE_DELETED: 'FILE_DELETED',
  FOLDER_CREATED: 'FOLDER_CREATED',
  FOLDER_RENAMED: 'FOLDER_RENAMED',
  FOLDER_DELETED: 'FOLDER_DELETED',
  FILE_SHARED: 'FILE_SHARED',
  FILE_MOVED: 'FILE_MOVED',
  FOLDER_MOVED: 'FOLDER_MOVED',
  FILE_RESTORED: 'FILE_RESTORED',
  FOLDER_RESTORED: 'FOLDER_RESTORED',
}
