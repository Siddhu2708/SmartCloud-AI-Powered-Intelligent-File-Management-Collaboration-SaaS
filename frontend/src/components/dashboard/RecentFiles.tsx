'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchRecentFiles } from '@/lib/storage'
import type { FileRecord } from '@/lib/types'
import { formatBytes, formatRelativeTime } from '@/lib/utils'
import { FileIcon } from '@/components/shared/FileIcon'
import { ListSkeleton } from '@/components/shared/Loading'
import { EmptyState } from '@/components/shared/EmptyState'

export function RecentFiles({ userId }: { userId: string }) {
  const [files, setFiles] = useState<FileRecord[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchRecentFiles(userId, 8)
      .then(setFiles)
      .catch(() => setError(true))
  }, [userId])

  if (error) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400 py-8 text-center">
        Could not load recent files.
      </div>
    )
  }

  if (files === null) return <ListSkeleton />

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest">Recent Files</h3>
        <Link href="/recent" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">
          View all
        </Link>
      </div>
      {files.length === 0 ? (
        <EmptyState title="No recent files" description="Files you upload will appear here." />
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
            >
              <FileIcon name={file.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{file.name}</p>
                <p className="text-xs text-neutral-500">
                  {file.file_type ?? ''} • {formatBytes(file.file_size)} • {formatRelativeTime(file.updated_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
