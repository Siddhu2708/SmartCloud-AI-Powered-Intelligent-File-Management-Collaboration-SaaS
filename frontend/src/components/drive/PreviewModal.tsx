'use client'

import { useEffect, useState } from 'react'
import { Download, X, Loader2, AlertCircle, FileText, Maximize2, Minimize2 } from 'lucide-react'
import { getSignedPreviewUrl, downloadFile } from '@/lib/storage'
import { getCategory } from '@/lib/utils'
import type { FileRecord } from '@/lib/types'

interface PreviewModalProps {
  file: FileRecord | null
  onClose: () => void
}

type PreviewState =
  | { status: 'loading' }
  | { status: 'ready'; url: string; kind: 'pdf' | 'image' | 'text' }
  | { status: 'unsupported' }
  | { status: 'error'; message: string }

export function PreviewModal({ file, onClose }: PreviewModalProps) {
  const [preview, setPreview] = useState<PreviewState>({ status: 'loading' })
  const [expanded, setExpanded] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Generate a fresh signed URL every time a new file is passed in
  useEffect(() => {
    if (!file) return
    let cancelled = false

    setPreview({ status: 'loading' })
    setExpanded(false)

    const cat = getCategory(file.name)
    if (!['pdf', 'image', 'text'].includes(cat)) {
      setPreview({ status: 'unsupported' })
      return
    }

    getSignedPreviewUrl(file)
      .then((url) => {
        if (cancelled) return
        if (!url) {
          setPreview({ status: 'unsupported' })
          return
        }
        const kind =
          cat === 'pdf' ? 'pdf'
          : cat === 'image' ? 'image'
          : 'text'
        setPreview({ status: 'ready', url, kind })
      })
      .catch(() => {
        if (!cancelled) {
          setPreview({ status: 'error', message: 'Could not load preview. The file may still be uploading.' })
        }
      })

    return () => { cancelled = true }
  }, [file?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    if (!file) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [file, onClose])

  if (!file) return null

  const handleDownload = async () => {
    setDownloading(true)
    try { await downloadFile(file) } catch { /* non-fatal */ } finally { setDownloading(false) }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* Panel — stop propagation so clicks inside don't close */}
      <div
        className={`relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 transition-all duration-200
          ${expanded ? 'h-[96vh] w-[96vw]' : 'h-[85vh] w-full max-w-4xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <FileText className="h-4 w-4 shrink-0 text-neutral-400" />
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900 dark:text-white">
            {file.name}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              title="Download"
              className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? 'Restore' : 'Expand'}
              className="hidden rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white sm:block"
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="relative min-h-0 flex-1 overflow-hidden bg-neutral-50 dark:bg-neutral-950">
          {preview.status === 'loading' && (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-neutral-400">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Loading preview…</p>
              </div>
            </div>
          )}

          {preview.status === 'error' && (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <AlertCircle className="h-10 w-10 text-neutral-300 dark:text-neutral-600" />
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Preview unavailable</p>
                <p className="max-w-xs text-xs text-neutral-500">{preview.message}</p>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="mt-2 flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
              </div>
            </div>
          )}

          {preview.status === 'unsupported' && (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <FileText className="h-10 w-10 text-neutral-300 dark:text-neutral-600" />
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Preview unavailable</p>
                <p className="text-xs text-neutral-500">
                  This file type can&apos;t be previewed in the browser.
                </p>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="mt-2 flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
              </div>
            </div>
          )}

          {preview.status === 'ready' && preview.kind === 'pdf' && (
            /*
             * iframe with the signed URL.  The browser's built-in PDF viewer
             * handles zoom, page nav, and text selection — no extra library
             * needed.  The # params suppress the default toolbar on Chrome.
             */
            <iframe
              src={`${preview.url}#toolbar=1&view=FitH`}
              title={file.name}
              className="h-full w-full border-0"
              aria-label={`PDF preview of ${file.name}`}
            />
          )}

          {preview.status === 'ready' && preview.kind === 'image' && (
            <div className="flex h-full items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.url}
                alt={file.name}
                className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
                onError={() => setPreview({ status: 'error', message: 'Image could not be loaded.' })}
              />
            </div>
          )}

          {preview.status === 'ready' && preview.kind === 'text' && (
            <TextPreview url={preview.url} onError={() =>
              setPreview({ status: 'error', message: 'Text file could not be loaded.' })}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Plain-text fetcher (separate component to keep the loading state clean) ──

function TextPreview({ url, onError }: { url: string; onError: () => void }) {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(url)
      .then((r) => r.text())
      .then((t) => { if (!cancelled) setText(t) })
      .catch(() => { if (!cancelled) onError() })
    return () => { cancelled = true }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps

  if (text === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <pre className="h-full overflow-auto p-6 font-mono text-xs leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-words">
      {text}
    </pre>
  )
}
