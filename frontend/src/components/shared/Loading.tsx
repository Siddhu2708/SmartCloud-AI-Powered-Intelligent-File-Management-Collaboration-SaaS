'use client'

import { Loader2 } from 'lucide-react'

export function Loading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-neutral-500 dark:text-neutral-400">
      <Loader2 className="w-6 h-6 animate-spin text-neutral-400 dark:text-neutral-600" />
      {label && <p className="mt-3 text-sm">{label}</p>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800 ${className}`} />
  )
}

export function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}
