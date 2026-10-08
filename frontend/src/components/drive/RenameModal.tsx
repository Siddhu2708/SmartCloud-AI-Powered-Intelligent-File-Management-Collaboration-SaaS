'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'

interface RenameModalProps {
  open: boolean
  initialName: string
  title?: string
  onClose: () => void
  onSave: (name: string) => Promise<void>
}

export function RenameModal({ open, initialName, title = 'Rename', onClose, onSave }: RenameModalProps) {
  const [name, setName] = useState(initialName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep local state in sync when the target changes
  const [lastOpen, setLastOpen] = useState(open)
  if (open && !lastOpen) {
    setLastOpen(true)
    setName(initialName)
    setError(null)
  } else if (!open && lastOpen) {
    setLastOpen(false)
  }

  const submit = async () => {
    if (!name.trim()) {
      setError('Name cannot be empty.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await onSave(name.trim())
      onClose()
    } catch {
      setError('Could not rename. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        className="w-full px-3 py-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white focus:border-neutral-400 dark:focus:border-white"
      />
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Save
        </button>
      </div>
    </Modal>
  )
}
