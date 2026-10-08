'use client'

import { Loader2 } from 'lucide-react'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{message}</p>
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 ${
            danger
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-white text-black hover:bg-neutral-200'
          }`}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
