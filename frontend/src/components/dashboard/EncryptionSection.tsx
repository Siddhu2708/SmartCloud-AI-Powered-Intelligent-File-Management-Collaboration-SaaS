'use client'

import { useState } from 'react'
import { Lock, Eye, EyeOff, Copy, Check } from 'lucide-react'

export function EncryptionSection() {
  const [encryptionEnabled, setEncryptionEnabled] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [encryptionKey, setEncryptionKey] = useState('')

  // Generate a sample encryption key
  const generateKey = () => {
    const key = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 32)
    setEncryptionKey(key)
    setEncryptionEnabled(true)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(encryptionKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <Lock className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
          Encryption
        </h3>
      </div>

      {/* Status */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-500">Encryption status</p>
            <p className={`mt-1 text-sm font-bold ${encryptionEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500'}`}>
              {encryptionEnabled ? '🔒 Enabled' : '🔓 Disabled'}
            </p>
          </div>
          <button
            onClick={() => {
              if (!encryptionEnabled) {
                generateKey()
              } else {
                setEncryptionEnabled(false)
                setEncryptionKey('')
              }
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              encryptionEnabled
                ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/60'
            }`}
          >
            {encryptionEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Encryption key */}
      {encryptionEnabled && encryptionKey && (
        <div className="space-y-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Encryption key</p>
                <p className="mt-1 font-mono text-xs font-bold text-emerald-900 dark:text-emerald-100">
                  {showKey ? encryptionKey : '•'.repeat(32)}
                </p>
              </div>
              <button
                onClick={() => setShowKey(!showKey)}
                className="shrink-0 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Copy button */}
            <button
              onClick={copyToClipboard}
              className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy key
                </>
              )}
            </button>
          </div>

          {/* Sharing info */}
          <div className="rounded-lg bg-emerald-50 p-2.5 text-[11px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <p className="font-medium">🔐 Share securely</p>
            <p className="mt-1">
              Share this key with recipients separately. They'll use it to decrypt shared files.
            </p>
          </div>

          {/* Features */}
          <div className="rounded-lg bg-neutral-50 p-2.5 text-[11px] dark:bg-neutral-900/50">
            <p className="font-medium text-neutral-900 dark:text-white">Features</p>
            <ul className="mt-1.5 space-y-1 text-neutral-600 dark:text-neutral-400">
              <li>✓ End-to-end encryption</li>
              <li>✓ AES-256 security</li>
              <li>✓ Client-side encryption</li>
              <li>✓ Only you control the key</li>
            </ul>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!encryptionEnabled && (
        <div className="rounded-lg bg-emerald-50 p-2.5 text-[11px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <p className="font-medium">🔓 Privacy first</p>
          <p className="mt-1">
            Enable encryption to protect sensitive files. Share with confidence!
          </p>
        </div>
      )}
    </div>
  )
}
