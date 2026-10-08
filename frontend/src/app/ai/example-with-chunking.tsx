'use client'

/**
 * Example: AI Page with File Chunking & Encryption
 * 
 * This is a complete example showing how to integrate the AIFileSettings component
 * with chunked file uploads and encryption.
 */

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Send,
  Sparkles,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchFiles, logAuditAI } from '@/lib/storage'
import type { FileRecord } from '@/lib/types'

// Import the new components and hooks
import { AIFileSettings } from '@/components/AIFileSettings'
import { useChunkedUpload } from '@/hooks/useChunkedUpload'
import { useEncryption } from '@/hooks/useEncryption'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Main AI Chat Component ────────────────────────────────────────────────────

function AIChatWithChunking() {
  // Chat state
  const searchParams = useSearchParams()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [loading, setLoading] = useState(false)
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null)
  const [userFiles, setUserFiles] = useState<FileRecord[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [token, setToken] = useState<string>('')

  // File settings state
  const [chunkSize, setChunkSize] = useState(256)
  const [encryptionEnabled, setEncryptionEnabled] = useState(false)

  // Upload state
  const { uploadFile, progress: uploadProgress } = useChunkedUpload(token)
  const { encryptFile, encrypting } = useEncryption(token)

  // Load user session and files
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (!user || !active) return

        if (active) {
          setUserId(user.id)
          // Get session token
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            setToken(session.access_token)
          }
        }

        const files = await fetchFiles(null).catch(() => [] as FileRecord[])
        if (active) setUserFiles(files)
      } catch {
        // Non-fatal
      } finally {
        if (active) setLoadingFiles(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  // Check AI backend availability
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) })
        setBackendAvailable(res.ok)
      } catch {
        setBackendAvailable(false)
      }
    }
    void check()
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Handle file upload with chunking
  const handleFileUpload = async (file: File) => {
    if (!token) {
      alert('Please log in first')
      return
    }

    try {
      const fileId = crypto.randomUUID()

      // Optional encryption
      if (encryptionEnabled) {
        console.log('Encrypting file before upload...')
        // File will be encrypted by useChunkedUpload
      }

      // Upload with chunking
      const result = await uploadFile(file, fileId, {
        chunkSizeKB: chunkSize,
        encrypt: encryptionEnabled,
        onProgress: (progress) => {
          console.log(`Upload progress: ${progress}%`)
        },
        onError: (error) => {
          console.error('Upload error:', error)
          alert(`Upload failed: ${error}`)
        },
      })

      console.log('Upload successful!', result)
      alert(`File uploaded successfully! Progress: ${uploadProgress}%`)
    } catch (error) {
      console.error('Upload failed:', error)
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files[0]) {
      void handleFileUpload(files[0])
      e.currentTarget.value = '' // Reset input
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] gap-4 bg-neutral-50 p-4 dark:bg-neutral-950">
      {/* Left Sidebar - File Settings */}
      <aside className="w-80 overflow-y-auto space-y-4">
        <AIFileSettings
          onChunkSizeChange={setChunkSize}
          onEncryptionToggle={setEncryptionEnabled}
        />

        {/* File Upload Section */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="font-semibold text-neutral-900 dark:text-white mb-3">
            Upload File
          </h3>

          <div className="space-y-3">
            <input
              type="file"
              onChange={handleFileInputChange}
              disabled={loading || encrypting}
              className="block w-full text-sm text-neutral-600 dark:text-neutral-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-neutral-900 file:text-white
                dark:file:bg-white dark:file:text-black
                hover:file:bg-neutral-700
                disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {(loading || encrypting) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {encrypting ? 'Encrypting...' : 'Uploading...'}
                  </span>
                  <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2 dark:bg-neutral-700 overflow-hidden">
                  <div
                    className="bg-neutral-900 h-full dark:bg-white transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              <p>• Chunk size: {chunkSize} KB</p>
              <p>• Encryption: {encryptionEnabled ? '🔒 On' : '🔓 Off'}</p>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="rounded-lg border border-neutral-200 bg-white p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900">
          <p className="font-medium text-neutral-600 dark:text-neutral-400">Settings</p>
          <p className="mt-2 text-neutral-500 dark:text-neutral-400">
            Chunk: <span className="font-mono">{chunkSize} KB</span>
          </p>
          <p className="text-neutral-500 dark:text-neutral-400">
            Encryption: <span className="font-mono">{encryptionEnabled ? 'On' : 'Off'}</span>
          </p>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 flex flex-col">
        {/* Header */}
        <div className="border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 dark:bg-white">
                <Sparkles className="h-4 w-4 text-white dark:text-black" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-neutral-900 dark:text-white">
                  SmartCloud AI
                </h1>
                <p className="text-[11px] text-neutral-500">
                  {loadingFiles ? 'Loading...' : `${userFiles.length} files ready`}
                </p>
              </div>
            </div>

            {backendAvailable === false && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                AI offline
              </span>
            )}
            {backendAvailable === true && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                AI online
              </span>
            )}
          </div>
        </div>

        {/* Chat Messages Area - Placeholder */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
              <Sparkles className="h-8 w-8 text-neutral-400" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Chat ready
            </h2>
            <p className="mt-2 max-w-sm text-sm text-neutral-500">
              Upload files with chunking and encryption, then ask questions about them.
            </p>
          </div>
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area - Placeholder */}
        <div className="border-t border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900 sm:p-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-950">
              <textarea
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about your files..."
                rows={1}
                className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent text-sm text-neutral-900 placeholder-neutral-400 outline-none dark:text-white dark:placeholder-neutral-600"
              />
              <button
                type="button"
                disabled={loading || !query.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// Wrap in Suspense for useSearchParams
export default function AIPageWithChunking() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      }
    >
      <AIChatWithChunking />
    </Suspense>
  )
}
