'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3,
  Activity,
  FolderOpen,
  Share2,
  BrainCircuit,
  HardDrive,
} from 'lucide-react'
import { getStorageUsage, fetchAuditLogs, getUserSubscription } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import { formatBytes, formatRelativeTime } from '@/lib/utils'
import { Skeleton } from '@/components/shared/Loading'
import type { AuditLog, UserSubscription } from '@/lib/storage'

// ── Action label ──────────────────────────────────────────────────────────────

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    FILE_UPLOADED: 'Uploaded a file',
    FILE_DOWNLOADED: 'Downloaded a file',
    FILE_DELETED: 'Moved to trash',
    FILE_RENAMED: 'Renamed a file',
    FILE_MOVED: 'Moved a file',
    FILE_SHARED: 'Shared a file',
    FILE_RESTORED: 'Restored a file',
    FOLDER_CREATED: 'Created a folder',
    FOLDER_DELETED: 'Deleted a folder',
    FOLDER_RENAMED: 'Renamed a folder',
    FOLDER_MOVED: 'Moved a folder',
    SHARE_CREATED: 'Shared an item',
    AI_QUERY: 'AI assistant query',
  }
  return map[action] ?? action.replace(/_/g, ' ').toLowerCase()
}

// ── Activity chart (real data, last 30 days grouped by day) ─────────────────

function ActivityChart({ logs }: { logs: AuditLog[] }) {
  // Build last-14-days buckets
  const now = Date.now()
  const DAY_MS = 86_400_000
  const buckets: { label: string; count: number }[] = []

  for (let i = 13; i >= 0; i--) {
    const day = new Date(now - i * DAY_MS)
    const label = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    buckets.push({ label, count: 0 })
  }

  for (const log of logs) {
    const logDay = new Date(log.created_at)
    const diffDays = Math.floor((now - logDay.getTime()) / DAY_MS)
    if (diffDays >= 0 && diffDays < 14) {
      buckets[13 - diffDays].count++
    }
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1)

  return (
    <div className="flex h-40 items-end gap-1.5">
      {buckets.map(({ label, count }) => {
        const pct = Math.round((count / maxCount) * 100)
        return (
          <div key={label} className="group relative flex flex-1 flex-col items-center gap-1">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 hidden rounded-md bg-neutral-900 px-2 py-1 text-[10px] text-white group-hover:block dark:bg-white dark:text-black whitespace-nowrap">
              {count} event{count !== 1 ? 's' : ''}
            </div>
            <div
              className="w-full min-h-[2px] rounded-t-sm bg-neutral-900 dark:bg-white transition-all"
              style={{ height: `${Math.max(pct, 2)}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, sub }: {
  label: string
  value: string | number
  icon: React.ElementType
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-neutral-500">{label}</span>
        <Icon className="h-4 w-4 text-neutral-400" />
      </div>
      <p className="text-2xl font-bold text-neutral-900 dark:text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [storageUsed, setStorageUsed] = useState(0)
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const [auditData, storageData, sub] = await Promise.all([
          fetchAuditLogs(200).catch(() => [] as AuditLog[]),
          getStorageUsage().catch(() => ({ usedBytes: 0 })),
          getUserSubscription().catch(() => null),
        ])
        if (!active) return
        setLogs(auditData)
        setStorageUsed(storageData.usedBytes)
        setSubscription(sub)
      } catch {
        // leave data as empty defaults — loading will clear below
      } finally {
        if (active) setLoading(false)
      }
    }
    void run()
    return () => { active = false }
  }, [])

  const uploadCount = logs.filter((l) => l.action === 'FILE_UPLOADED').length
  const downloadCount = logs.filter((l) => l.action === 'FILE_DOWNLOADED').length
  const shareCount = logs.filter((l) => l.action.includes('SHARE') || l.action === 'FILE_SHARED').length
  const aiCount = logs.filter((l) => l.action === 'AI_QUERY').length
  const storageLimit = subscription?.storage_limit_bytes ?? 15 * 1024 * 1024 * 1024

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
          <BarChart3 className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-neutral-500">Your activity, storage health, and AI usage.</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
            <StatCard label="Storage used" value={formatBytes(storageUsed)} icon={HardDrive} sub={`of ${formatBytes(storageLimit)}`} />
            <StatCard label="Files uploaded" value={uploadCount} icon={FolderOpen} sub="all time" />
            <StatCard label="Files shared" value={shareCount} icon={Share2} sub="all time" />
            <StatCard label="AI queries" value={aiCount} icon={BrainCircuit} sub="all time" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            {/* Activity chart */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Activity — last 14 days</h2>
                <span className="text-xs text-neutral-400">{logs.length} total events</span>
              </div>
              {logs.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-neutral-400">
                  No activity recorded yet.
                </div>
              ) : (
                <ActivityChart logs={logs} />
              )}
            </div>

            {/* Action breakdown */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-white">Action breakdown</h2>
              <div className="space-y-2.5">
                {[
                  { label: 'Uploads', count: uploadCount, color: 'bg-blue-500' },
                  { label: 'Downloads', count: downloadCount, color: 'bg-emerald-500' },
                  { label: 'Shares', count: shareCount, color: 'bg-violet-500' },
                  { label: 'AI queries', count: aiCount, color: 'bg-amber-500' },
                ].map(({ label, count, color }) => {
                  const total = uploadCount + downloadCount + shareCount + aiCount
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
                        <span className="font-medium text-neutral-900 dark:text-white">{count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Recent activity list */}
          <div className="mt-6 rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-neutral-800">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Recent activity</h2>
              <span className="text-xs text-neutral-400">Last {Math.min(logs.length, 20)} events</span>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {logs.slice(0, 20).length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-neutral-400">No activity yet.</p>
              ) : (
                logs.slice(0, 20).map((log) => (
                  <div key={log.id} className="flex items-center gap-3 px-5 py-2.5">
                    <Activity className="h-3.5 w-3.5 shrink-0 text-neutral-300 dark:text-neutral-600" />
                    <p className="flex-1 text-sm text-neutral-700 dark:text-neutral-300 capitalize">
                      {actionLabel(log.action)}
                      {log.metadata?.name ? ` — ${String(log.metadata.name)}` : ''}
                    </p>
                    <span className="shrink-0 text-[11px] text-neutral-400">
                      {formatRelativeTime(log.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
