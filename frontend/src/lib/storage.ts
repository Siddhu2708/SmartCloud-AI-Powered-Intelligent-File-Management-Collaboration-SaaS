import { supabase } from './supabase'
import type { FileRecord, Folder, Share } from './types'
import { getCategory, getMimeType, getDisplayType } from './utils'

const BUCKET = 'documents'

// ============================================================
// Folders
// ============================================================

export async function fetchFolders(parentId: string | null, { starred, trashed }: { starred?: boolean; trashed?: boolean } = {}) {
  let query = supabase
    .from('folders')
    .select('*')
    .eq('owner_id', (await getUserId()) ?? '')
    .order('name', { ascending: true })

  if (trashed) {
    query = query.eq('is_trashed', true).is('parent_id', null)
  } else {
    query = query.eq('is_trashed', false)
    if (starred) {
      query = query.eq('is_starred', true)
    } else {
      query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null)
    }
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Folder[]
}

export async function fetchFolderBreadcrumb(folderId: string | null): Promise<Folder[]> {
  if (!folderId) return []
  const crumb: Folder[] = []
  const seen = new Set<string>()
  let current = folderId
  while (current && !seen.has(current)) {
    seen.add(current)
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('id', current)
      .single()
    if (error || !data) break
    crumb.unshift(data)
    current = data.parent_id
  }
  return crumb
}

export async function createFolder(name: string, parentId: string | null): Promise<Folder> {
  const userId = (await getUserId()) ?? ''
  const { data, error } = await supabase
    .from('folders')
    .insert({ owner_id: userId, parent_id: parentId, name })
    .select()
    .single()
  if (error) throw error
  void logAuditEvent('FOLDER_CREATED', 'folder', data.id, { name })
  return data
}

export async function renameFolder(folderId: string, name: string): Promise<void> {
  const { error } = await supabase.from('folders').update({ name }).eq('id', folderId)
  if (error) throw error
}

export async function renameFileRecord(fileId: string, name: string, storagePath: string): Promise<void> {
  const { error } = await supabase
    .from('files')
    .update({ name, storage_path: storagePath, updated_at: new Date().toISOString() })
    .eq('id', fileId)
  if (error) throw error
}

export async function moveFile(fileId: string, folderId: string | null): Promise<void> {
  const { error } = await supabase.from('files').update({ folder_id: folderId, updated_at: new Date().toISOString() }).eq('id', fileId)
  if (error) throw error
}

export async function moveFolder(folderId: string, parentId: string | null): Promise<void> {
  const { error } = await supabase.from('folders').update({ parent_id: parentId }).eq('id', folderId)
  if (error) throw error
}

export async function trashFolder(folderId: string): Promise<void> {
  // Recursively mark folder and all descendants as trashed (soft delete).
  const userId = (await getUserId()) ?? ''
  const explore = async (id: string) => {
    const { data: sub, error } = await supabase.from('folders').select('id').eq('parent_id', id).eq('owner_id', userId)
    if (!error && sub) {
      for (const s of sub) await explore(s.id)
    }
    const { error: ferr } = await supabase.from('files').update({ is_trashed: true, updated_at: new Date().toISOString() }).eq('folder_id', id).eq('owner_id', userId)
    if (ferr) throw ferr
    const { error: oerr } = await supabase.from('folders').update({ is_trashed: true }).eq('id', id).eq('owner_id', userId)
    if (oerr) throw oerr
  }
  await explore(folderId)
  void logAuditEvent('FOLDER_DELETED', 'folder', folderId)
}

export async function restoreFolder(folderId: string): Promise<void> {
  const userId = (await getUserId()) ?? ''
  const explore = async (id: string) => {
    const { data: sub, error } = await supabase.from('folders').select('id').eq('parent_id', id).eq('owner_id', userId)
    if (!error && sub) {
      for (const s of sub) await explore(s.id)
    }
    const { error: ferr } = await supabase.from('files').update({ is_trashed: false, updated_at: new Date().toISOString() }).eq('folder_id', id).eq('owner_id', userId)
    if (ferr) throw ferr
    const { error: oerr } = await supabase.from('folders').update({ is_trashed: false }).eq('id', id).eq('owner_id', userId)
    if (oerr) throw oerr
  }
  await explore(folderId)
}

// ============================================================
// Files
// ============================================================

export async function fetchFiles(folderId: string | null, { starred, trashed }: { starred?: boolean; trashed?: boolean } = {}) {
  let query = supabase
    .from('files')
    .select('*')
    .eq('owner_id', (await getUserId()) ?? '')
    .order('name', { ascending: true })

  if (trashed) {
    query = query.eq('is_trashed', true).is('folder_id', null)
  } else {
    query = query.eq('is_trashed', false)
    if (starred) {
      query = query.eq('is_starred', true)
    } else {
      query = folderId ? query.eq('folder_id', folderId) : query.is('folder_id', null)
    }
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as FileRecord[]
}

export async function fetchRecentFiles(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('owner_id', userId)
    .eq('is_trashed', false)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as FileRecord[]
}

export async function getFile(fileId: string): Promise<FileRecord | null> {
  const { data, error } = await supabase.from('files').select('*').eq('id', fileId).single()
  if (error) return null
  return data
}

export async function getFolder(folderId: string): Promise<Folder | null> {
  const { data, error } = await supabase.from('folders').select('*').eq('id', folderId).single()
  if (error) return null
  return data
}

export async function toggleStarFile(fileId: string, current: boolean): Promise<void> {
  const { error } = await supabase.from('files').update({ is_starred: !current }).eq('id', fileId)
  if (error) throw error
}

export async function toggleStarFolder(folderId: string, current: boolean): Promise<void> {
  const { error } = await supabase.from('folders').update({ is_starred: !current }).eq('id', folderId)
  if (error) throw error
}

export async function trashFileSingle(fileId: string): Promise<void> {
  const { error } = await supabase.from('files').update({ is_trashed: true, updated_at: new Date().toISOString() }).eq('id', fileId)
  if (error) throw error
}

export async function restoreFileSingle(fileId: string): Promise<void> {
  const { error } = await supabase.from('files').update({ is_trashed: false, updated_at: new Date().toISOString() }).eq('id', fileId)
  if (error) throw error
}

export async function permanentlyDeleteFile(fileId: string, storagePath: string): Promise<void> {
  // permanent delete (used from trash "delete forever")
  try {
    await supabase.storage.from(BUCKET).remove([storagePath])
  } catch { /* object may not exist */ }
  const { error } = await supabase.from('files').delete().eq('id', fileId)
  if (error) throw error
  void logAuditEvent('FILE_DELETED', 'file', fileId)
}

export async function permanentlyDeleteFolder(folderId: string): Promise<void> {
  // permanently delete a trashed folder and all its descendants (ownership-scoped).
  const userId = (await getUserId()) ?? ''
  const explore = async (id: string) => {
    const { data: sub, error } = await supabase.from('folders').select('id, owner_id').eq('parent_id', id).eq('owner_id', userId)
    if (!error && sub) {
      for (const s of sub) await explore(s.id)
    }
    const { data: files, error: ferr } = await supabase.from('files').select('id, storage_path').eq('folder_id', id).eq('owner_id', userId)
    if (!ferr && files) {
      for (const f of files) {
        try { await supabase.storage.from(BUCKET).remove([f.storage_path]) } catch { /* ignore */ }
        await supabase.from('files').delete().eq('id', f.id).eq('owner_id', userId)
      }
    }
    const { error: oerr } = await supabase.from('folders').delete().eq('id', id).eq('owner_id', userId)
    if (oerr) throw oerr
  }
  await explore(folderId)
}

// ============================================================
// Uploads
// ============================================================

export interface UploadOptions {
  parentId: string | null
  onProgress?: (percent: number) => void
}

export async function uploadFile(
  file: File,
  { parentId, onProgress }: UploadOptions,
): Promise<FileRecord> {
  const userId = (await getUserId()) ?? ''
  if (!userId) throw new Error('Not authenticated')

  // ── Phase 1: Insert DB record (placeholder path) ──────────────────────────
  // We create the DB row first so we get the UUID needed for the storage path.
  const placeholderPath = `${userId}/pending/${Date.now()}-${file.name}`
  const { data: inserted, error: dbInsertError } = await supabase
    .from('files')
    .insert({
      owner_id: userId,
      folder_id: parentId,        // ← correct folder always passed in
      name: file.name,
      storage_path: placeholderPath,
      file_type: getDisplayType(file.name),
      mime_type: file.type || getMimeType(file.name),
      file_size: file.size,
    })
    .select()
    .single()

  if (dbInsertError || !inserted) {
    throw dbInsertError ?? new Error('DB insert returned no row')
  }

  onProgress?.(20)

  // ── Phase 2: Upload bytes to Storage ──────────────────────────────────────
  // Real path: documents/{userId}/{fileId}/{filename}
  const storagePath = `${userId}/${inserted.id}/${file.name}`

  const fileBody = await file.arrayBuffer()

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBody, {
      contentType: file.type || getMimeType(file.name),
      upsert: true,
    })

  if (storageError) {
    // Storage failed — delete the orphaned DB row so the user can retry clean
    await supabase.from('files').delete().eq('id', inserted.id).eq('owner_id', userId)
    throw storageError
  }

  onProgress?.(80)

  // ── Phase 3: Patch DB row with the real storage path ─────────────────────
  const { error: patchError } = await supabase
    .from('files')
    .update({ storage_path: storagePath, updated_at: new Date().toISOString() })
    .eq('id', inserted.id)

  if (patchError) {
    // Path patch failed — try to clean up the storage object too so nothing
    // is left in an inconsistent state
    try { await supabase.storage.from(BUCKET).remove([storagePath]) } catch { /* best-effort */ }
    await supabase.from('files').delete().eq('id', inserted.id).eq('owner_id', userId)
    throw patchError
  }

  onProgress?.(100)

  void logAuditEvent('FILE_UPLOADED', 'file', inserted.id, { name: file.name, size: file.size })

  return { ...(inserted as FileRecord), storage_path: storagePath }
}

// Upload a folder recursively, preserving structure, using a folder creation
// walk. Returns created file records.
export async function uploadFolder(files: { path: string; file: File }[], parentId: string | null): Promise<{ created: number; total: number }> {
  let created = 0
  const total = files.length

  // Group by top-level directory to map created folders
  const folderCache = new Map<string, string | null>() // dirPath (relative) -> folderId
  folderCache.set('', parentId)

  const ensureDir = async (relDir: string): Promise<string | null> => {
    if (!relDir) return parentId
    const cached = folderCache.get(relDir)
    if (cached !== undefined) return cached
    const parentDir = relDir.includes('/') ? relDir.slice(0, relDir.lastIndexOf('/')) : ''
    const parentIdRes = await ensureDir(parentDir)
    const name = relDir.split('/').pop()!
    const { data, error } = await supabase
      .from('folders')
      .insert({ owner_id: (await getUserId()) ?? '', parent_id: parentIdRes, name })
      .select('id')
      .single()
    if (error || !data) throw error
    folderCache.set(relDir, data.id)
    return data.id
  }

  for (const { path, file } of files) {
    const norm = path.replace(/\\/g, '/')
    const parts = norm.split('/')
    const dirs = parts.slice(0, -1)
    const dirPath = dirs.join('/')
    const targetFolderId = await ensureDir(dirPath)
    await uploadFile(file, { parentId: targetFolderId })
    created++
  }

  return { created, total }
}

// ============================================================
// Download
// ============================================================

export async function downloadFile(file: FileRecord): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).download(file.storage_path)
  if (error || !data) throw error
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function getPublicPreviewUrl(file: FileRecord): Promise<string | null> {
  if (getCategory(file.name) !== 'image') return null
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(file.storage_path, 3600)
  return data?.signedUrl ?? null
}

/**
 * Return a short-lived signed URL for previewing a file in the browser.
 * Works for PDFs, images, and plain text.  Always fetches fresh — never
 * cache a URL that may have already expired.
 *
 * Returns null for unsupported types (caller shows Download fallback).
 */
export async function getSignedPreviewUrl(file: FileRecord): Promise<string | null> {
  const cat = getCategory(file.name)
  const previewable = ['pdf', 'image', 'text']
  if (!previewable.includes(cat)) return null

  // 5-minute expiry — fresh URL every time the preview modal opens
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, 300)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

// ============================================================
// Rename (rename file physically + metadata)
// ============================================================

export async function renameFilePhysical(file: FileRecord, newName: string): Promise<FileRecord> {
  const userId = file.owner_id
  const newStoragePath = `${userId}/${file.id}/${newName}`
  const { error: moveError } = await supabase.storage.from(BUCKET).move(file.storage_path, newStoragePath)
  if (moveError) throw moveError
  await renameFileRecord(file.id, newName, newStoragePath)
  return { ...file, name: newName, storage_path: newStoragePath }
}

// ============================================================
// Sharing
// ============================================================

export interface SharedItem {
  share: Share
  file?: FileRecord | null
  folder?: Folder | null
  owner_email?: string
  owner_name?: string
}

export async function fetchSharedWithMe(userId: string): Promise<SharedItem[]> {
  const { data, error } = await supabase
    .from('shares')
    .select('*')
    .eq('shared_with', userId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
  if (error) throw error

  const shares = (data ?? []) as Share[]
  const items: SharedItem[] = []
  const ownerIds = Array.from(new Set(shares.map((s) => s.owner_id)))

  // Fetch owner emails + names
  const ownerMap = new Map<string, { email?: string; name?: string }>()
  const { data: profiles } = await supabase.from('profiles').select('id, email, full_name').in('id', ownerIds)
  if (profiles) {
    for (const p of profiles as { id: string; email: string | null; full_name: string | null }[]) {
      ownerMap.set(p.id, { email: p.email ?? undefined, name: p.full_name ?? undefined })
    }
  }

  for (const share of shares) {
    let file: FileRecord | null = null
    let folder: Folder | null = null
    if (share.file_id) {
      const { data: f } = await supabase.from('files').select('*').eq('id', share.file_id).maybeSingle()
      file = (f as FileRecord) ?? null
    }
    if (share.folder_id) {
      const { data: fo } = await supabase.from('folders').select('*').eq('id', share.folder_id).maybeSingle()
      folder = (fo as Folder) ?? null
    }
    const owner = ownerMap.get(share.owner_id)
    items.push({
      share,
      file,
      folder,
      owner_email: owner?.email,
      owner_name: owner?.name,
    })
  }
  return items
}

export async function createShare(input: {
  file_id?: string
  folder_id?: string
  shared_with: string
  permission: 'viewer' | 'editor'
  expires_at?: string | null
}): Promise<void> {
  const userId = (await getUserId()) ?? ''
  const { error } = await supabase.from('shares').insert({
    file_id: input.file_id ?? null,
    folder_id: input.folder_id ?? null,
    owner_id: userId,
    shared_with: input.shared_with,
    permission: input.permission,
    expires_at: input.expires_at ?? null,
  })
  if (error) throw error
  void logAuditEvent('SHARE_CREATED', input.file_id ? 'file' : 'folder', input.file_id ?? input.folder_id ?? undefined, { permission: input.permission })
}

export async function revokeShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('shares').delete().eq('id', shareId)
  if (error) throw error
}

// ============================================================
// Misc
// ============================================================

export async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function getStorageUsage(): Promise<{ usedBytes: number }> {
  const userId = (await getUserId()) ?? ''
  const { data, error } = await supabase
    .from('files')
    .select('file_size')
    .eq('owner_id', userId)
    .eq('is_trashed', false)
  if (error) throw error
  const used = (data ?? []).reduce((acc, f: { file_size: number }) => acc + (f.file_size || 0), 0)
  return { usedBytes: used }
}

export interface UserSubscription {
  id: string
  user_id: string
  plan: 'free' | 'pro' | 'business'
  storage_limit_bytes: number
  ai_request_quota: number
  ai_requests_used: number
  billing_cycle_start: string | null
  billing_cycle_end: string | null
  created_at: string
}

export async function getUserSubscription(): Promise<UserSubscription | null> {
  const userId = (await getUserId()) ?? ''
  if (!userId) return null
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as UserSubscription) ?? null
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export async function fetchAuditLogs(limit = 50): Promise<AuditLog[]> {
  const userId = (await getUserId()) ?? ''
  if (!userId) return []
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as AuditLog[]
}

async function logAuditEvent(
  action: string,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  // Audit logging must NEVER throw — primary flow must not be affected.
  try {
    const userId = (await getUserId()) ?? ''
    if (!userId) return
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      resource_type: resourceType ?? null,
      resource_id: resourceId ?? null,
      metadata: metadata ?? null,
    })
    if (error) {
      if (error.code === 'PGRST204') {
        // Column missing — schema migration not yet applied. Minimal fallback.
        await supabase.from('audit_logs').insert({ user_id: userId, action })
      } else {
        console.warn('[audit] storage.logAuditEvent failed:', error.message)
      }
    }
  } catch (err) {
    console.warn('[audit] Unexpected error in logAuditEvent:', err)
  }
}

// ============================================================
// AI audit logging (public, used by AI pages)
// ============================================================

export async function logAuditAI(query: string): Promise<void> {
  try {
    const userId = (await getUserId()) ?? ''
    if (!userId) return
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'AI_QUERY',
      resource_type: null,
      resource_id: null,
      metadata: { query: query.slice(0, 200) },
    })
    if (error?.code === 'PGRST204') {
      await supabase.from('audit_logs').insert({ user_id: userId, action: 'AI_QUERY' })
    }
  } catch { /* non-fatal */ }
}

// ============================================================
// File count helpers
// ============================================================

export async function getFileCounts(): Promise<{ files: number; folders: number }> {
  const userId = (await getUserId()) ?? ''
  const [{ count: fc }, { count: foc }] = await Promise.all([
    supabase.from('files').select('*', { count: 'exact', head: true }).eq('owner_id', userId).eq('is_trashed', false),
    supabase.from('folders').select('*', { count: 'exact', head: true }).eq('owner_id', userId).eq('is_trashed', false),
  ])
  return { files: fc ?? 0, folders: foc ?? 0 }
}
