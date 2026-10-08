'use client'

import Link from 'next/link'
import { ChevronRight, HardDrive } from 'lucide-react'
import type { Folder } from '@/lib/types'

interface BreadcrumbsProps {
  crumb: Folder[]
  currentName?: string
}

export function Breadcrumbs({ crumb, currentName }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 min-w-0">
      <Link
        href="/drive"
        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-neutral-200/60 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white transition-colors truncate"
      >
        <HardDrive className="w-4 h-4 shrink-0" />
        <span>My Drive</span>
      </Link>
      {crumb.map((folder) => (
        <span key={folder.id} className="flex items-center gap-1.5 min-w-0">
          <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 shrink-0" />
          <Link
            href={`/drive/${folder.id}`}
            className="px-2 py-1 rounded-md hover:bg-neutral-200/60 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white transition-colors truncate"
          >
            {folder.name}
          </Link>
        </span>
      ))}
      {currentName && (
        <span className="flex items-center gap-1.5 min-w-0">
          <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 shrink-0" />
          <span className="px-2 py-1 text-neutral-900 dark:text-white font-medium truncate">{currentName}</span>
        </span>
      )}
    </nav>
  )
}
