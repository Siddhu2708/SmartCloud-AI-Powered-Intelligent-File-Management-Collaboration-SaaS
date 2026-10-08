'use client'

import { CheckCircle2, XCircle, Loader2, X } from 'lucide-react'

export interface UploadItem {
  id: string
  name: string
  percent: number
  status: 'uploading' | 'complete' | 'error'
  error?: string
}

interface UploadProgressProps {
  uploads: UploadItem[]
  onDismiss: (id: string) => void
}

export function UploadProgress({ uploads, onDismiss }: UploadProgressProps) {
  if (uploads.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] space-y-2">
      {uploads.map((u) => (
        <div
          key={u.id}
          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg p-4"
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{u.name}</p>
            {u.status === 'complete' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            ) : u.status === 'error' ? (
              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
            ) : (
              <Loader2 className="w-5 h-5 text-neutral-400 animate-spin shrink-0" />
            )}
          </div>
          <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                u.status === 'error' ? 'bg-red-500' : u.status === 'complete' ? 'bg-green-500' : 'bg-neutral-900 dark:bg-white'
              }`}
              style={{ width: `${u.percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-neutral-500">
              {u.status === 'complete'
                ? 'Upload complete'
                : u.status === 'error'
                ? u.error ?? 'Upload failed. Please try again.'
                : `Uploading... ${u.percent}%`}
            </p>
            {(u.status === 'complete' || u.status === 'error') && (
              <button onClick={() => onDismiss(u.id)} aria-label="Dismiss" className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
