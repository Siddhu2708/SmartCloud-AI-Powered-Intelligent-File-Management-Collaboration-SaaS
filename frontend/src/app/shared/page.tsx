'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  Folder as FolderIcon,
  FileText,
  ShieldCheck,
  Clock,
  Download,
  ExternalLink,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/Loading'
import { useToast } from '@/components/shared/Toast'
import { fetchSharedWithMe, downloadFile } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import type { SharedItem } from '@/lib/storage'
import { formatRelativeTime } from '@/lib/utils'

export default function SharedPage() {
  const router = useRouter()
  const { error: toastError } = useToast()
  const [items, setItems] = useState<SharedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const shared = await fetchSharedWithMe(user.id)
      if (active) setItems(shared)
    }
    run()
      .catch(() => { if (true) setItems([]) })
      .finally(() => setLoading(false))
    return () => { active = false }
  }, [])

  const openItem = async (item: SharedItem) => {
    if (item.folder) {
      router.push(`/drive/${item.folder.id}`)
    } else if (item.file) {
      try {
        await downloadFile(item.file)
      } catch {
        toastError('Could not open this file.')
      }
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-neutral-100 p-2 dark:bg-neutral-800">
          <Users className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Shared with me</h1>
          <p className="text-sm text-neutral-500">Items other people have shared with you.</p>
        </div>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Users className="h-9 w-9 text-neutral-400 dark:text-neutral-500" />}
          title="Nothing shared with you"
          description="Files and folders shared with you will appear here."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const name = item.file?.name ?? item.folder?.name ?? 'Shared item'
            const isFile = Boolean(item.file)
            const Icon = isFile ? FileText : FolderIcon
            const owner = item.owner_name ?? item.owner_email ?? 'Someone'
            const isExpired = item.share.expires_at
              ? new Date(item.share.expires_at) < new Date()
              : false

            return (
              <div
                key={item.share.id}
                className={`rounded-xl border bg-white p-4 transition-all dark:bg-neutral-900 ${
                  isExpired
                    ? 'border-red-200 opacity-60 dark:border-red-900/50'
                    : 'border-neutral-200 hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:hover:border-neutral-700'
                }`}
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                    <Icon className={`h-5 w-5 ${!isFile ? 'text-amber-500' : 'text-neutral-600 dark:text-neutral-300'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{name}</p>
                    <p className="text-xs text-neutral-500">{isFile ? 'File' : 'Folder'} · shared by {owner}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.share.permission === 'editor' ? 'Can edit' : 'Can view'}</span>
                  </div>
                  {item.share.expires_at ? (
                    <div className={`flex items-center gap-1.5 ${isExpired ? 'text-red-500' : ''}`}>
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>{isExpired ? 'Expired' : `Expires ${formatRelativeTime(item.share.expires_at)}`}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>No expiration</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  {!isExpired && (
                    <>
                      {isFile && (
                        <button
                          type="button"
                          onClick={() => void openItem(item)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void openItem(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </button>
                    </>
                  )}
                  {isExpired && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
                      Access expired
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
