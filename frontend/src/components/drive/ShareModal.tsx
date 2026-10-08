'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'

interface ShareModalProps {
  open: boolean
  onClose: () => void
  onShare: (email: string, permission: 'viewer' | 'editor', expiresAt: string | null) => Promise<void>
  itemName: string
}

export function ShareModal({ open, onClose, onShare, itemName }: ShareModalProps) {
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<'viewer' | 'editor'>('viewer')
  const [expiresDays, setExpiresDays] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setEmail('')
      setPermission('viewer')
      setExpiresDays('')
      setError(null)
    }
  }, [open])

  const submit = async () => {
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    let expiresAt: string | null = null
    if (expiresDays && Number(expiresDays) > 0) {
      expiresAt = new Date(Date.now() + Number(expiresDays) * 24 * 60 * 60 * 1000).toISOString()
    }
    setLoading(true)
    setError(null)
    try {
      await onShare(email.trim(), permission, expiresAt)
      onClose()
    } catch {
      setError('Could not share. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Share">
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5 truncate">{itemName}</p>

      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Email</label>
      <input
        autoFocus
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="person@example.com"
        className="w-full px-3 py-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white focus:border-neutral-400 dark:focus:border-white"
      />

      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mt-4 mb-2">Permission</label>
      <div className="flex gap-2">
        {(['viewer', 'editor'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPermission(p)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
              permission === p
                ? 'bg-white text-black border-white'
                : 'bg-neutral-100 dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mt-4 mb-2">
        Expire after (days) <span className="text-neutral-400 font-normal">— optional</span>
      </label>
      <input
        type="number"
        min={1}
        value={expiresDays}
        onChange={(e) => setExpiresDays(e.target.value)}
        placeholder="Never"
        className="w-full px-3 py-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white focus:border-neutral-400 dark:focus:border-white"
      />

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

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
          Share
        </button>
      </div>
    </Modal>
  )
}