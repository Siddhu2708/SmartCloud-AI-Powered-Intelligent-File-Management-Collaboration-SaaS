'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStorageUsage, getUserSubscription } from '@/lib/storage'
import { formatBytes } from '@/lib/utils'

interface StorageBarProps {
  /** When true, renders a compact inline version (no padding wrapper) */
  compact?: boolean
}

export function StorageBar({ compact = false }: StorageBarProps) {
  const [usedBytes, setUsedBytes] = useState(0)
  const [limitBytes, setLimitBytes] = useState(15 * 1024 * 1024 * 1024) // 15 GB default

  useEffect(() => {
    let active = true
    Promise.all([getStorageUsage(), getUserSubscription()])
      .then(([usage, sub]) => {
        if (!active) return
        setUsedBytes(usage.usedBytes)
        if (sub?.storage_limit_bytes) setLimitBytes(sub.storage_limit_bytes)
      })
      .catch(() => {/* non-fatal */})
    return () => { active = false }
  }, [])

  const pct = Math.min(100, Math.round((usedBytes / limitBytes) * 100))
  const isWarning = pct >= 80
  const isDanger  = pct >= 95

  const barColor = isDanger
    ? 'bg-red-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-neutral-900 dark:bg-white'

  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-neutral-500">
          <span>{formatBytes(usedBytes)} used</span>
          <span className="text-neutral-400">{formatBytes(limitBytes)}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {isWarning && (
          <p className={`text-[10px] ${isDanger ? 'text-red-500' : 'text-amber-500'}`}>
            {isDanger ? 'Storage almost full!' : 'Storage running low'}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>Storage</span>
        <Link href="/subscription" className="hover:text-neutral-900 dark:hover:text-white transition-colors">
          Manage
        </Link>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-neutral-500">
        <span className="font-medium text-neutral-900 dark:text-white">{formatBytes(usedBytes)}</span>
        {' '}of {formatBytes(limitBytes)} used
      </p>
    </div>
  )
}
