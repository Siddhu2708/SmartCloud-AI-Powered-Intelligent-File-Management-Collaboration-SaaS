'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { HardDrive } from 'lucide-react'
import { getStorageUsage, getUserSubscription } from '@/lib/storage'
import { formatBytes } from '@/lib/utils'
import { Skeleton } from '@/components/shared/Loading'

export function StorageOverview() {
  const [usedBytes, setUsedBytes] = useState<number | null>(null)
  const [limitBytes, setLimitBytes] = useState(15 * 1024 * 1024 * 1024)

  useEffect(() => {
    Promise.all([getStorageUsage(), getUserSubscription()])
      .then(([usage, sub]) => {
        setUsedBytes(usage.usedBytes)
        if (sub?.storage_limit_bytes) setLimitBytes(sub.storage_limit_bytes)
      })
      .catch(() => setUsedBytes(0))
  }, [])

  const pct = usedBytes === null ? 0 : Math.min(100, Math.round((usedBytes / limitBytes) * 100))
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-neutral-900 dark:bg-white'

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-neutral-400" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Storage</h3>
        </div>
        <Link href="/subscription" className="text-xs text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
          Manage
        </Link>
      </div>

      {usedBytes === null ? (
        <Skeleton className="mb-3 h-2.5 w-full" />
      ) : (
        <>
          <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>
              <span className="font-semibold text-neutral-900 dark:text-white">{formatBytes(usedBytes)}</span>
              {' '}used
            </span>
            <span>{formatBytes(limitBytes)} total</span>
          </div>
          {pct >= 80 && (
            <Link
              href="/subscription"
              className="mt-3 flex w-full items-center justify-center rounded-lg bg-neutral-900 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              Upgrade for more space
            </Link>
          )}
        </>
      )}
    </div>
  )
}
