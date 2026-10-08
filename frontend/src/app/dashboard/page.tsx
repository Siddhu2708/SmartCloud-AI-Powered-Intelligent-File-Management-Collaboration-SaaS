'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  HardDrive,
  UploadCloud,
  Sparkles,
  Users,
  Clock,
  Star,
  TrendingUp,
  Folder,
  ArrowRight,
  Loader2,
  Wand2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  getStorageUsage,
  getUserSubscription,
  fetchRecentFiles,
  fetchAuditLogs,
  fetchFolders,
  fetchFiles,
} from '@/lib/storage'
import { formatBytes, formatRelativeTime } from '@/lib/utils'
import { FileIcon } from '@/components/shared/FileIcon'
import { Skeleton } from '@/components/shared/Loading'
import type { FileRecord } from '@/lib/types'
import type { AuditLog, UserSubscription } from '@/lib/storage'

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
  color = 'text-neutral-700 dark:text-neutral-200',
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  href?: string
  color?: string
}) {
  const inner = (
    <div className="group flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="mt-0.5 text-lg font-bold text-neutral-900 dark:text-white">{value}</p>
        {sub && <p className="text-[11px] text-neutral-400">{sub}</p>}
      </div>
      {href && (
        <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500 dark:text-neutral-600" />
      )}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

// ── Quick action ─────────────────────────────────────────────────────────────

function QuickAction({
  icon: Icon,
  label,
  description,
  href,
  color,
}: {
  icon: React.ElementType
  label: string
  description: string
  href: string
  color: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900 dark:text-white">{label}</p>
        <p className="text-xs text-neutral-500">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 dark:text-neutral-600" />
    </Link>
  )
}

// ── Action label helper ───────────────────────────────────────────────────────

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    FILE_UPLOADED: 'Uploaded file',
    FILE_DOWNLOADED: 'Downloaded file',
    FILE_DELETED: 'Moved to trash',
    FILE_RENAMED: 'Renamed file',
    FILE_MOVED: 'Moved file',
    FILE_SHARED: 'Shared file',
    FOLDER_CREATED: 'Created folder',
    FOLDER_DELETED: 'Deleted folder',
    FOLDER_RENAMED: 'Renamed folder',
    FOLDER_MOVED: 'Moved folder',
    FILE_RESTORED: 'Restored file',
    SHARE_CREATED: 'Shared item',
    AI_QUERY: 'AI query',
  }
  return map[action] ?? action.replace(/_/g, ' ').toLowerCase()
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)

  const [recentFiles, setRecentFiles] = useState<FileRecord[]>([])
  const [activityLog, setActivityLog] = useState<AuditLog[]>([])
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [storageUsed, setStorageUsed] = useState(0)
  const [folderCount, setFolderCount] = useState(0)
  const [fileCount, setFileCount] = useState(0)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.replace('/login'); return }

        const name =
          (user.user_metadata?.full_name as string | undefined) ??
          user.email?.split('@')[0] ??
          'User'

        if (!active) return
        setUserName(name)
        setUserId(user.id)

        const [recent, logs, sub, storage, folders, files] = await Promise.all([
          fetchRecentFiles(user.id, 8).catch(() => [] as FileRecord[]),
          fetchAuditLogs(10).catch(() => [] as AuditLog[]),
          getUserSubscription().catch(() => null),
          getStorageUsage().catch(() => ({ usedBytes: 0 })),
          fetchFolders(null).catch(() => []),
          fetchFiles(null).catch(() => [] as FileRecord[]),
        ])

        if (!active) return
        setRecentFiles(recent)
        setActivityLog(logs)
        setSubscription(sub)
        setStorageUsed(storage.usedBytes)
        setFolderCount(folders.length)
        setFileCount(files.length)
      } catch {
        // Supabase unreachable or auth error — redirect to login so user can retry
        if (active) router.replace('/login')
      } finally {
        // Always clear loading — never leave the spinner stuck
        if (active) setLoading(false)
      }
    }

    void run()
    return () => { active = false }
  }, [router])

  if (!userId && loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <Loader2 className="h-7 w-7 animate-spin text-neutral-400" />
      </div>
    )
  }

  const firstName = userName.split(' ')[0]
  const storageLimit = subscription?.storage_limit_bytes ?? 15 * 1024 * 1024 * 1024
  const storagePct = Math.min(100, Math.round((storageUsed / storageLimit) * 100))

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-sm text-neutral-500">
          Here&rsquo;s an overview of your SmartCloud workspace.
        </p>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Storage used"
          value={formatBytes(storageUsed)}
          sub={`of ${formatBytes(storageLimit)}`}
          icon={HardDrive}
          href="/subscription"
          color="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Files"
          value={loading ? '—' : fileCount}
          sub="in root"
          icon={UploadCloud}
          href="/drive"
          color="text-green-600 dark:text-green-400"
        />
        <StatCard
          label="Folders"
          value={loading ? '—' : folderCount}
          sub="in root"
          icon={Folder}
          href="/drive"
          color="text-amber-500"
        />
        <StatCard
          label="Plan"
          value={subscription?.plan ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1) : 'Free'}
          sub={`${subscription?.ai_requests_used ?? 0} AI queries`}
          icon={TrendingUp}
          href="/subscription"
          color="text-violet-600 dark:text-violet-400"
        />
      </div>

      {/* ── Storage bar ── */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-900 dark:text-white">Storage usage</p>
          <span className={`text-xs font-medium ${storagePct >= 90 ? 'text-red-500' : 'text-neutral-500'}`}>
            {storagePct}%
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div
            className={`h-full rounded-full transition-all duration-700 ${storagePct >= 90 ? 'bg-red-500' : storagePct >= 80 ? 'bg-amber-500' : 'bg-neutral-900 dark:bg-white'}`}
            style={{ width: `${storagePct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
          <span>{formatBytes(storageUsed)} used</span>
          <Link href="/subscription" className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
            Upgrade plan →
          </Link>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick actions + File Management */}
        <div className="space-y-6 lg:col-span-1">
          {/* Quick Actions */}
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Quick actions
            </h2>
            <div className="space-y-2">
              <QuickAction
                icon={HardDrive}
                label="Open My Drive"
                description="Browse folders and files"
                href="/drive"
                color="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
              />
              <QuickAction
                icon={UploadCloud}
                label="Upload a file"
                description="Add files to your workspace"
                href="/drive?action=upload-file"
                color="bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400"
              />
              <QuickAction
                icon={Sparkles}
                label="Ask AI"
                description="Chat with SmartCloud AI"
                href="/ai"
                color="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
              />
              <QuickAction
                icon={Wand2}
                label="Smart Organize"
                description="AI-powered file organization"
                href="/ai/organize"
                color="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
              />
              <QuickAction
                icon={Users}
                label="Shared with me"
                description="Files others shared with you"
                href="/shared"
                color="bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              />
            </div>
          </div>
        </div>

          {/* Recent files */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Recent files
            </h2>
            <Link
              href="/recent"
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            >
              <Clock className="h-3.5 w-3.5" />
              View all
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : recentFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-12 text-center dark:border-neutral-800">
              <UploadCloud className="mx-auto mb-3 h-8 w-8 text-neutral-300 dark:text-neutral-600" />
              <p className="text-sm font-medium text-neutral-900 dark:text-white">No files yet</p>
              <p className="mt-1 text-xs text-neutral-500">Upload your first file to get started.</p>
              <Link
                href="/drive?action=upload-file"
                className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                Upload file
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              {recentFiles.map((file, i) => (
                <div
                  key={file.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${
                    i < recentFiles.length - 1 ? 'border-b border-neutral-100 dark:border-neutral-800' : ''
                  }`}
                >
                  <FileIcon name={file.name} className="h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {file.file_type ?? 'Unknown'} • {formatBytes(file.file_size)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-neutral-400">
                    {formatRelativeTime(file.updated_at)}
                  </span>
                  {file.is_starred && (
                    <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Recent activity */}
          {activityLog.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  Recent activity
                </h2>
                <Link
                  href="/analytics"
                  className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                >
                  View all
                </Link>
              </div>
              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                {activityLog.slice(0, 5).map((log, i) => (
                  <div
                    key={log.id}
                    className={`flex items-center gap-3 px-4 py-2.5 ${
                      i < 4 ? 'border-b border-neutral-100 dark:border-neutral-800' : ''
                    }`}
                  >
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    <p className="flex-1 text-sm text-neutral-700 dark:text-neutral-300 capitalize">
                      {actionLabel(log.action)}
                      {log.metadata?.name ? ` — ${String(log.metadata.name)}` : ''}
                    </p>
                    <span className="shrink-0 text-[11px] text-neutral-400">
                      {formatRelativeTime(log.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
