'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Download,
  Eye,
  File as FileIcon,
  Folder as FolderIcon,
  Info,
  MoveRight,
  Pencil,
  Share2,
  Star,
  Trash2,
  UploadCloud,
  LayoutGrid,
  List,
  ArrowUpDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchFolders,
  fetchFiles,
  fetchFolderBreadcrumb,
  createFolder,
  uploadFile,
  uploadFolder,
  downloadFile,
  renameFilePhysical,
  renameFolder,
  moveFile,
  moveFolder,
  toggleStarFile,
  toggleStarFolder,
  trashFileSingle,
  trashFolder,
  createShare,
  getUserId,
} from '@/lib/storage'
import { logAudit } from '@/lib/audit'
import type { FileRecord, Folder } from '@/lib/types'
import { Breadcrumbs } from '@/components/drive/Breadcrumbs'
import { NewMenu } from '@/components/drive/NewMenu'
import { CreateFolderModal } from '@/components/drive/CreateFolderModal'
import { RenameModal } from '@/components/drive/RenameModal'
import { DetailsModal } from '@/components/drive/DetailsModal'
import { MoveModal } from '@/components/drive/MoveModal'
import { ShareModal } from '@/components/drive/ShareModal'
import { PreviewModal } from '@/components/drive/PreviewModal'
import { UploadProgress, type UploadItem } from '@/components/drive/UploadProgress'
import { FileGrid } from '@/components/drive/FileGrid'
import { FileList } from '@/components/drive/FileList'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ListSkeleton } from '@/components/shared/Loading'
import { useToast } from '@/components/shared/Toast'
import { DropdownMenu } from '@/components/shared/DropdownMenu'
import type { FileActionKey, FolderActionKey } from '@/components/drive/types'

type ViewMode = 'grid' | 'list'
type SortKey = 'name' | 'modified' | 'size' | 'type'

interface DriveProps {
  folderId: string | null
}

interface ContextMenuState {
  x: number
  y: number
  kind: 'file' | 'folder'
  id: string
}

type Target =
  | { kind: 'file'; item: FileRecord }
  | { kind: 'folder'; item: Folder }

const VIEW_KEY = 'smartcloud:drive-view'

export function DriveView({ folderId }: DriveProps) {
  const router = useRouter()
  const toast = useToast()

  // ── Stable refs for toast callbacks ─────────────────────────────────────────
  // useToast() returns a new object every render, so destructuring and putting
  // those functions into useCallback deps causes refresh() to get a new
  // reference every render, which makes useEffect([refresh]) fire in an
  // infinite loop.  Instead we hold stable refs that always point to the
  // current callbacks without ever changing identity.
  const toastRef = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])
  const success  = useCallback((msg: string) => toastRef.current.success(msg),  [])
  const toastError = useCallback((msg: string) => toastRef.current.error(msg),  [])
  const warning  = useCallback((msg: string) => toastRef.current.warning(msg),  [])

  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<FileRecord[]>([])
  const [crumbs, setCrumbs] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('grid')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{ files: FileRecord[]; folders: Folder[] } | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  const [modal, setModal] = useState<null | 'folder' | 'upload' | 'uploadFolder'>(null)
  const [renameTarget, setRenameTarget] = useState<Target | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<Target | null>(null)
  const [moveTarget, setMoveTarget] = useState<Target | null>(null)
  const [shareTarget, setShareTarget] = useState<Target | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Target | null>(null)
  const [previewTarget, setPreviewTarget] = useState<FileRecord | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [user, setUser] = useState<string | null>(null)
  // Tracks whether we hit a schema-cache error — used to show a dev-mode banner
  const [migrationNeeded, setMigrationNeeded] = useState(false)

  const folderInputRef = useRef<HTMLInputElement>(null)
  const uploadIdCounter = useRef(0)

  // Restore view preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_KEY)
    if (stored === 'grid' || stored === 'list') setView(stored)
  }, [])

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view)
  }, [view])

  useEffect(() => {
    getUserId().then(setUser)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      // ── Dev diagnostics (stripped from production bundles) ───────────────
      if (process.env.NODE_ENV === 'development') {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          console.warn('[DriveView] No active session at fetch time — queries will fail RLS.')
        }
      }

      const [fs, fls, c] = await Promise.all([
        fetchFolders(folderId),
        fetchFiles(folderId),
        fetchFolderBreadcrumb(folderId),
      ])

      if (process.env.NODE_ENV === 'development') {
        console.debug('[DriveView] loaded', { folders: fs.length, files: fls.length, folderId })
      }

      setFolders(fs)
      setFiles(fls)
      setCrumbs(c)
    } catch (err) {
      console.error('[DriveView] refresh error:', err)

      // Surface a more helpful message in development
      if (process.env.NODE_ENV === 'development') {
        const e = err as { code?: string; message?: string }
        if (e?.code === 'PGRST204') {
          console.error(
            '[DriveView] PGRST204 — a column referenced in the query does not exist in ' +
            'the live schema cache. Run database/migrations/001_fix_audit_logs_columns.sql ' +
            'in the Supabase SQL editor, then reload.',
          )
          setMigrationNeeded(true)
        } else if (e?.code === '42501') {
          console.error('[DriveView] 42501 — RLS denied. Check files/folders owner_id policies.')
        } else if (e?.code === '42P01') {
          console.error('[DriveView] 42P01 — table does not exist. Verify schema was applied.')
        }
      }

      toastError('Could not load your drive.')
    } finally {
      setLoading(false)
    }
  // toastError is a stable ref-backed callback — intentionally omitted from deps.
  // folderId is the only value that should trigger a re-fetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId])

  useEffect(() => { refresh() }, [refresh])

  // Debounced search across the entire drive
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false
    if (!debouncedSearch.trim()) {
      setSearchResults(null)
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    const q = `%${debouncedSearch.trim()}%`
    const run = async () => {
      const userId = user ?? (await getUserId()) ?? ''
      const [{ data: f }, { data: fo }] = await Promise.all([
        supabase
          .from('files')
          .select('*')
          .eq('owner_id', userId)
          .eq('is_trashed', false)
          .or(`name.ilike.${q},file_type.ilike.${q}`)
          .limit(50),
        supabase
          .from('folders')
          .select('*')
          .eq('owner_id', userId)
          .eq('is_trashed', false)
          .ilike('name', q)
          .limit(50),
      ])
      if (!cancelled) {
        setSearchResults({ files: (f ?? []) as FileRecord[], folders: (fo ?? []) as Folder[] })
        setSearchLoading(false)
      }
    }
    run().catch(() => { if (!cancelled) { setSearchResults(null); setSearchLoading(false) } })
    return () => { cancelled = true }
  }, [debouncedSearch, user])

  // Handle ?action= query from the sidebar New menu (mobile)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const action = params.get('action')
    if (action === 'new-folder') setModal('folder')
    else if (action === 'upload-file') setModal('upload')
    else if (action === 'upload-folder') setModal('uploadFolder')
    if (action) router.replace(folderId ? `/drive/${folderId}` : '/drive', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sorting
  const sortedFolders = [...folders].sort((a, b) => compareFolders(a, b, sortKey, sortAsc))
  const sortedFiles = [...files].sort((a, b) => compareFiles(a, b, sortKey, sortAsc))

  const searching = Boolean(debouncedSearch.trim())
  const displayFolders = searching ? (searchResults?.folders ?? []) : sortedFolders
  const displayFiles = searching ? (searchResults?.files ?? []) : sortedFiles

  // ---- Uploads ----
  const handleUploadFiles = useCallback(async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList)
    if (arr.length === 0) return
    setModal(null)

    const items = arr.map((f) => ({
      id: String(++uploadIdCounter.current),
      name: f.name,
      percent: 0,
      status: 'uploading' as const,
    }))
    setUploads((prev) => [...prev, ...items])

    let failedCount = 0

    for (const [i, file] of arr.entries()) {
      const id = items[i].id
      try {
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, percent: 5 } : u)))
        await uploadFile(file, {
          parentId: folderId,
          onProgress: (pct) => {
            setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, percent: pct } : u)))
          },
        })
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, percent: 100, status: 'complete' } : u)))
        await logAudit({ action: 'FILE_UPLOADED', resourceType: 'file', metadata: { name: file.name } })
      } catch {
        failedCount += 1
        setUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: 'error', error: 'Upload failed. Please try again.' } : u))
        )
      }
    }

    await refresh()

    if (failedCount > 0) {
      if (failedCount === arr.length) {
        toastError('Upload failed. Please try again.')
      } else {
        warning(`${failedCount} file${failedCount > 1 ? 's' : ''} failed to upload.`)
      }
    } else {
      success(arr.length === 1 ? `Uploaded ${arr[0].name}` : `Uploaded ${arr.length} files`)
    }
  }, [folderId, refresh, success, toastError, warning])

  const handleUploadFolderNative = useCallback(async (fileList: FileList) => {
    const arr = Array.from(fileList)
    if (arr.length === 0) return
    setModal(null)

    const rootName = arr[0]?.webkitRelativePath?.split('/')[0] ?? 'Folder'
    const uid = String(++uploadIdCounter.current)
    setUploads((prev) => [...prev, { id: uid, name: rootName, percent: 40, status: 'uploading' }])

    const pathMap = arr.map((f) => ({ path: f.webkitRelativePath || f.name, file: f }))
    try {
      await uploadFolder(pathMap, folderId)
      setUploads((prev) => prev.map((u) => (u.id === uid ? { ...u, percent: 100, status: 'complete' } : u)))
      success(`Uploaded folder ${rootName}`)
      await logAudit({ action: 'FILE_UPLOADED', resourceType: 'folder', metadata: { name: rootName } })
    } catch {
      setUploads((prev) => prev.map((u) => (u.id === uid ? { ...u, status: 'error', error: 'Folder upload failed. Please try again.' } : u)))
      toastError('Folder upload failed. Please try again.')
    }
    await refresh()
  }, [folderId, refresh, success, toastError])

  const handleShare = useCallback(async (email: string, permission: 'viewer' | 'editor', expiresAt: string | null) => {
    if (!shareTarget) return
    const ownerId = user ?? (await getUserId()) ?? ''
    const { data: shareWith } = await supabase.from('profiles').select('id').eq('email', email.trim()).maybeSingle()
    if (!shareWith) throw new Error('no-user')
    await createShare({
      file_id: shareTarget.kind === 'file' ? shareTarget.item.id : undefined,
      folder_id: shareTarget.kind === 'folder' ? shareTarget.item.id : undefined,
      shared_with: shareWith.id as string,
      permission,
      expires_at: expiresAt,
    })
    await logAudit({
      action: 'FILE_SHARED',
      resourceType: shareTarget.kind === 'file' ? 'file' : 'folder',
      resourceId: shareTarget.item.id,
      metadata: { with: email, permission },
    })
    success(`Shared with ${email.trim()}`)
  }, [shareTarget, user, success])

  // ---- Actions dispatch ----
  const findFile = (id: string) =>
    [...files, ...(searchResults?.files ?? [])].find((f) => f.id === id)
  const findFolder = (id: string) =>
    [...folders, ...(searchResults?.folders ?? [])].find((f) => f.id === id)

  const handleFileAction = (id: string, action: FileActionKey) => {
    const item = findFile(id)
    if (!item) return
    setContextMenu(null)
    switch (action) {
      case 'open': void runDownload(item); break
      case 'preview': setPreviewTarget(item); break
      case 'download': void runDownload(item); break
      case 'rename': setRenameTarget({ kind: 'file', item }); break
      case 'move': setMoveTarget({ kind: 'file', item }); break
      case 'share': setShareTarget({ kind: 'file', item }); break
      case 'star': void runStarFile(item); break
      case 'details': setDetailsTarget({ kind: 'file', item }); break
      case 'delete': setDeleteTarget({ kind: 'file', item }); break
    }
  }

  const handleFolderAction = (id: string, action: FolderActionKey) => {
    const item = findFolder(id)
    if (!item) return
    setContextMenu(null)
    switch (action) {
      case 'open': router.push(`/drive/${item.id}`); break
      case 'rename': setRenameTarget({ kind: 'folder', item }); break
      case 'move': setMoveTarget({ kind: 'folder', item }); break
      case 'share': setShareTarget({ kind: 'folder', item }); break
      case 'star': void runStarFolder(item); break
      case 'details': setDetailsTarget({ kind: 'folder', item }); break
      case 'delete': setDeleteTarget({ kind: 'folder', item }); break
    }
  }

  const runDownload = async (file: FileRecord) => {
    try {
      await downloadFile(file)
      await logAudit({ action: 'FILE_DOWNLOADED', resourceType: 'file', resourceId: file.id, metadata: { name: file.name } })
    } catch {
      toastError('Download failed. Please try again.')
    }
  }

  const runStarFile = async (file: FileRecord) => {
    try {
      await toggleStarFile(file.id, file.is_starred)
      setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, is_starred: !f.is_starred } : f)))
      success(file.is_starred ? 'Removed from Starred' : 'Added to Starred')
    } catch { toastError('Could not update star.') }
  }

  const runStarFolder = async (folder: Folder) => {
    try {
      await toggleStarFolder(folder.id, folder.is_starred)
      setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, is_starred: !f.is_starred } : f)))
      success(folder.is_starred ? 'Removed from Starred' : 'Added to Starred')
    } catch { toastError('Could not update star.') }
  }

  const onRenameSave = async (name: string) => {
    if (renameTarget?.kind === 'file') {
      const updated = await renameFilePhysical(renameTarget.item, name)
      await logAudit({ action: 'FILE_RENAMED', resourceType: 'file', resourceId: updated.id, metadata: { name } })
      success('File renamed')
    } else if (renameTarget?.kind === 'folder') {
      await renameFolder(renameTarget.item.id, name)
      await logAudit({ action: 'FOLDER_RENAMED', resourceType: 'folder', resourceId: renameTarget.item.id, metadata: { name } })
      success('Folder renamed')
    }
    setRenameTarget(null)
    await refresh()
  }

  const onMoveSave = async (destFolderId: string | null) => {
    if (moveTarget?.kind === 'file') {
      await moveFile(moveTarget.item.id, destFolderId)
      await logAudit({ action: 'FILE_MOVED', resourceType: 'file', resourceId: moveTarget.item.id })
    } else if (moveTarget?.kind === 'folder') {
      await moveFolder(moveTarget.item.id, destFolderId)
      await logAudit({ action: 'FOLDER_MOVED', resourceType: 'folder', resourceId: moveTarget.item.id })
    }
    success('Moved')
    setMoveTarget(null)
    await refresh()
  }

  const onDeleteConfirm = async () => {
    if (deleteTarget?.kind === 'file') {
      await trashFileSingle(deleteTarget.item.id)
      await logAudit({ action: 'FILE_DELETED', resourceType: 'file', resourceId: deleteTarget.item.id, metadata: { name: deleteTarget.item.name } })
      success('File moved to Trash')
    } else if (deleteTarget?.kind === 'folder') {
      await trashFolder(deleteTarget.item.id)
      await logAudit({ action: 'FOLDER_DELETED', resourceType: 'folder', resourceId: deleteTarget.item.id })
      success('Folder moved to Trash')
    }
    setDeleteTarget(null)
    await refresh()
  }

  const onCreateFolder = async (name: string) => {
    await createFolder(name, folderId)
    await logAudit({ action: 'FOLDER_CREATED', resourceType: 'folder', metadata: { name, parentId: folderId } })
    success('Folder created')
    await refresh()
  }

  // ---- context menu handlers ----
  const handleCardContextMenu = (e: React.MouseEvent, kind: 'file' | 'folder', id: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, kind, id })
  }

  useEffect(() => {
    const close = () => setContextMenu(null)
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null) }
    window.addEventListener('click', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', esc)
    }
  }, [])

  const contextItem =
    contextMenu?.kind === 'file'
      ? findFile(contextMenu.id)
      : contextMenu?.kind === 'folder'
      ? findFolder(contextMenu.id)
      : null

  // ---- render ----
  const headerActions = (
    <div className="flex items-center gap-2">
      <NewMenu
        onNewFolder={() => setModal('folder')}
        onUploadFile={() => setModal('upload')}
        onUploadFolder={() => setModal('uploadFolder')}
      />
      <div className="hidden sm:block">
        <DropdownMenu
          align="left"
          ariaLabel="Sort"
          trigger={
            <span className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-300 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <ArrowUpDown className="w-4 h-4" />
              <span className="hidden lg:inline">
                {sortKey === 'name' ? 'Name' : sortKey === 'modified' ? 'Modified' : sortKey === 'size' ? 'Size' : 'Type'}
              </span>
            </span>
          }
          actions={[
            { label: 'Name', onClick: () => setSortKey('name') },
            { label: 'Last modified', onClick: () => setSortKey('modified') },
            { label: 'File size', onClick: () => setSortKey('size') },
            { label: 'File type', onClick: () => setSortKey('type') },
            { divider: true, label: '', onClick: () => {} },
            { label: sortAsc ? 'Descending' : 'Ascending', onClick: () => setSortAsc((a) => !a) },
          ]}
        />
      </div>
      <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <button
          onClick={() => setView('grid')}
          aria-label="Grid view"
          className={`p-2 transition-colors ${view === 'grid' ? 'bg-neutral-200/70 dark:bg-white/10 text-neutral-900 dark:text-white' : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          onClick={() => setView('list')}
          aria-label="List view"
          className={`p-2 transition-colors ${view === 'list' ? 'bg-neutral-200/70 dark:bg-white/10 text-neutral-900 dark:text-white' : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}
        >
          <List className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  const empty = !loading && !searching && displayFolders.length === 0 && displayFiles.length === 0

  return (
    <div
      className="p-6 sm:p-8"
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false) }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files.length > 0) void handleUploadFiles(e.dataTransfer.files)
      }}
    >
      <input
        ref={folderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        className="hidden"
        onChange={(e) => { if (e.target.files) void handleUploadFolderNative(e.target.files); e.target.value = '' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">My Drive</h1>
          <div className="mt-2">
            <Breadcrumbs crumb={crumbs} />
          </div>
        </div>
        {headerActions}
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-96 mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searching ? 'Searching your drive...' : 'Search files and folders'}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-full text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white focus:border-neutral-400 dark:focus:border-white transition-all"
        />
      </div>

      {/* Grid/list content */}
      {loading ? (
        <ListSkeleton />
      ) : searching && searchLoading ? (
        <ListSkeleton />
      ) : searching && !searchLoading ? (
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">Folders</h2>
            {displayFolders.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No folders match your search.</p>
            ) : view === 'grid' ? (
              <FileGrid files={[]} folders={displayFolders} onFileAction={handleFileAction} onFolderAction={handleFolderAction} onCardContextMenu={handleCardContextMenu} />
            ) : (
              <FileList files={[]} folders={displayFolders} onFileAction={handleFileAction} onFolderAction={handleFolderAction} />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">Files</h2>
            {displayFiles.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No files match your search.</p>
            ) : view === 'grid' ? (
              <FileGrid files={displayFiles} folders={[]} onFileAction={handleFileAction} onFolderAction={handleFolderAction} onCardContextMenu={handleCardContextMenu} />
            ) : (
              <FileList files={displayFiles} folders={[]} onFileAction={handleFileAction} onFolderAction={handleFolderAction} />
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">Folders</h2>
            {displayFolders.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No folders here yet.</p>
            ) : view === 'grid' ? (
              <FileGrid files={[]} folders={displayFolders} onFileAction={handleFileAction} onFolderAction={handleFolderAction} onCardContextMenu={handleCardContextMenu} />
            ) : (
              <FileList files={[]} folders={displayFolders} onFileAction={handleFileAction} onFolderAction={handleFolderAction} />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">Files</h2>
            {displayFiles.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No files here yet.</p>
            ) : view === 'grid' ? (
              <FileGrid files={displayFiles} folders={[]} onFileAction={handleFileAction} onFolderAction={handleFolderAction} onCardContextMenu={handleCardContextMenu} />
            ) : (
              <FileList files={displayFiles} folders={[]} onFileAction={handleFileAction} onFolderAction={handleFolderAction} />
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {empty && (
        <EmptyState
          icon={<UploadCloud className="w-9 h-9 text-neutral-400 dark:text-neutral-500" />}
          title="My Drive is empty"
          description="Upload your first file or create a folder to get started."
          actions={
            <>
              <button
                onClick={() => setModal('upload')}
                className="px-4 py-2 rounded-lg bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors"
              >
                Upload File
              </button>
              <button
                onClick={() => setModal('folder')}
                className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                New Folder
              </button>
            </>
          }
        />
      )}

      {/* Dev-only migration reminder */}
      {migrationNeeded && process.env.NODE_ENV === 'development' && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800/50 dark:bg-amber-950/20">
          <p className="font-semibold text-amber-800 dark:text-amber-300">⚠ Database migration required</p>
          <p className="mt-1 text-amber-700 dark:text-amber-400">
            Run <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">database/migrations/001_fix_audit_logs_columns.sql</code> in
            the Supabase SQL editor to add missing columns, then reload this page.
          </p>
        </div>
      )}

      {/* Drag overlay */}
      {dragging && (
        <div className="fixed inset-0 z-[60] bg-neutral-900/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-neutral-900 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl p-16 text-center shadow-2xl">
            <UploadCloud className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <p className="text-lg font-semibold text-neutral-900 dark:text-white">Drop files to upload</p>
            <p className="text-sm text-neutral-500">Folders will keep their structure</p>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && contextItem && contextMenu.kind === 'file' && (
        <ContextMenuPanel
          x={contextMenu.x}
          y={contextMenu.y}
          actions={[
            { label: 'Open', icon: <FileIcon className="w-4 h-4" />, onClick: () => handleFileAction(contextMenu.id, 'open') },
            { label: 'Preview', icon: <Eye className="w-4 h-4" />, onClick: () => handleFileAction(contextMenu.id, 'preview') },
            { label: 'Download', icon: <Download className="w-4 h-4" />, onClick: () => handleFileAction(contextMenu.id, 'download') },
            { label: 'Rename', icon: <Pencil className="w-4 h-4" />, onClick: () => handleFileAction(contextMenu.id, 'rename') },
            { label: 'Move', icon: <MoveRight className="w-4 h-4" />, onClick: () => handleFileAction(contextMenu.id, 'move') },
            { label: 'Share', icon: <Share2 className="w-4 h-4" />, onClick: () => handleFileAction(contextMenu.id, 'share') },
            {
              label: (contextItem as FileRecord).is_starred ? 'Remove from Starred' : 'Add to Starred',
              icon: <Star className={`w-4 h-4 ${(contextItem as FileRecord).is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />,
              onClick: () => handleFileAction(contextMenu.id, 'star'),
            },
            { label: 'Details', icon: <Info className="w-4 h-4" />, onClick: () => handleFileAction(contextMenu.id, 'details') },
            { divider: true, label: '', onClick: () => {} },
            { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleFileAction(contextMenu.id, 'delete'), danger: true },
          ]}
        />
      )}
      {contextMenu && contextItem && contextMenu.kind === 'folder' && (
        <ContextMenuPanel
          x={contextMenu.x}
          y={contextMenu.y}
          actions={[
            { label: 'Open', icon: <FolderIcon className="w-4 h-4" />, onClick: () => handleFolderAction(contextMenu.id, 'open') },
            { label: 'Rename', icon: <Pencil className="w-4 h-4" />, onClick: () => handleFolderAction(contextMenu.id, 'rename') },
            { label: 'Move', icon: <MoveRight className="w-4 h-4" />, onClick: () => handleFolderAction(contextMenu.id, 'move') },
            { label: 'Share', icon: <Share2 className="w-4 h-4" />, onClick: () => handleFolderAction(contextMenu.id, 'share') },
            {
              label: (contextItem as Folder).is_starred ? 'Remove from Starred' : 'Add to Starred',
              icon: <Star className={`w-4 h-4 ${(contextItem as Folder).is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />,
              onClick: () => handleFolderAction(contextMenu.id, 'star'),
            },
            { label: 'Details', icon: <Info className="w-4 h-4" />, onClick: () => handleFolderAction(contextMenu.id, 'details') },
            { divider: true, label: '', onClick: () => {} },
            { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleFolderAction(contextMenu.id, 'delete'), danger: true },
          ]}
        />
      )}

      {/* File picker for uploads (triggered via modal open state) */}
      {modal === 'upload' && <FilePicker onPick={(fileList) => { setModal(null); void handleUploadFiles(fileList) }} onCancel={() => setModal(null)} />}

      {/* Modals */}
      <CreateFolderModal open={modal === 'folder'} onClose={() => setModal(null)} onCreate={onCreateFolder} />

      <RenameModal
        open={renameTarget !== null}
        initialName={renameTarget?.item.name ?? ''}
        title={renameTarget?.kind === 'folder' ? 'Rename folder' : 'Rename file'}
        onClose={() => setRenameTarget(null)}
        onSave={onRenameSave}
      />

      <DetailsModal
        open={detailsTarget !== null}
        onClose={() => setDetailsTarget(null)}
        item={detailsTarget?.item ?? null}
        kind={detailsTarget?.kind ?? 'file'}
      />

      <MoveModal
        open={moveTarget !== null}
        onClose={() => setMoveTarget(null)}
        onMove={onMoveSave}
        itemName={moveTarget?.item.name ?? ''}
      />

      <ShareModal
        open={shareTarget !== null}
        onClose={() => setShareTarget(null)}
        onShare={(email, perm, expires) => handleShare(email, perm, expires)}
        itemName={shareTarget?.item.name ?? ''}
      />

      <PreviewModal
        file={previewTarget}
        onClose={() => setPreviewTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete "${deleteTarget?.item.name ?? ''}"?`}
        message={
          deleteTarget?.kind === 'folder'
            ? 'Files inside this folder may also be affected.'
            : 'This file will be moved to Trash.'
        }
        confirmLabel="Move to Trash"
        danger
        onConfirm={() => void onDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />

      <UploadProgress
        uploads={uploads}
        onDismiss={(id) => setUploads((prev) => prev.filter((u) => u.id !== id))}
      />
    </div>
  )
}

function ContextMenuPanel({ x, y, actions }: {
  x: number
  y: number
  actions: { label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean; divider?: boolean }[]
}) {
  // Keep within viewport
  const style: React.CSSProperties = { left: Math.min(x, window.innerWidth - 240), top: Math.min(y, window.innerHeight - 320) }
  return (
    <div
      className="fixed z-[70] w-56 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl py-1.5 animate-in"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((a, i) => (
        <div key={`${a.label}-${i}`}>
          {a.divider && <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />}
          <button
            onClick={(e) => { e.stopPropagation(); a.onClick() }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
              a.danger
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800'
            }`}
          >
            {a.icon && <span className="w-4 h-4 shrink-0">{a.icon}</span>}
            {a.label}
          </button>
        </div>
      ))}
    </div>
  )
}

function FilePicker({ onPick, onCancel }: { onPick: (files: FileList) => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.click()
  }, [])
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length) onPick(e.target.files)
          else onCancel()
        }}
      />
      {/* Fallback if picker is cancelled by browser (rare) */}
    </>
  )
}

function compareFiles(a: FileRecord, b: FileRecord, key: SortKey, asc: boolean) {
  let r = 0
  if (key === 'name') r = a.name.localeCompare(b.name)
  else if (key === 'modified') r = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
  else if (key === 'size') r = (a.file_size || 0) - (b.file_size || 0)
  else r = (a.file_type ?? '').localeCompare(b.file_type ?? '')
  return asc ? r : -r
}

function compareFolders(a: Folder, b: Folder, key: SortKey, asc: boolean) {
  let r = 0
  if (key === 'name') r = a.name.localeCompare(b.name)
  else if (key === 'modified') r = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
  else r = a.name.localeCompare(b.name)
  return asc ? r : -r
}

// re-export for the sync route page wrapper (single folder param)
export type { DriveProps }