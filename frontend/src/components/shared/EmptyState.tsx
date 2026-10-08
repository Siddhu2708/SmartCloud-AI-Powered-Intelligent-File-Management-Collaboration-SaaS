'use client'

import { Cloud } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  actions?: React.ReactNode
}

export function EmptyState({ icon, title, description, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center mb-5">
        {icon ?? <Cloud className="w-9 h-9 text-neutral-400 dark:text-neutral-500" />}
      </div>
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">{description}</p>
      )}
      {actions && <div className="mt-6 flex items-center gap-3 flex-wrap justify-center">{actions}</div>}
    </div>
  )
}
