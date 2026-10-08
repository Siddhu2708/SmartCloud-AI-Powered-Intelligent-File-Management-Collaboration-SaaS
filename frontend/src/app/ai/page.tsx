'use client'

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Source {
  title: string
  score?: number
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  sources?: Source[]
  loading?: boolean
  error?: boolean
}

// ── Source reference chip ─────────────────────────────────────────────────────

function SourceChip({ source }: { source: Source }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
      <FileText className="h-3 w-3 shrink-0" />
      {source.title}
    </span>
  )
}

// ── Chat bubble ───────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          {message.text}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-900 dark:bg-white">
          <Sparkles className="h-3.5 w-3.5 text-white dark:text-black" />
        </div>
      )}
      <div className={`max-w-[80%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
              : 'border border-neutral-200 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
          }`}
        >
          {message.loading ? (
            <span className="flex items-center gap-2 text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking through your files…
            </span>
          ) : (
            message.text
          )}
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 w-full mb-0.5">
              Sources
            </span>
            {message.sources.map((s, i) => (
              <SourceChip key={i} source={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Suggestion chips ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Summarize my most recent documents',
  'What files are related to cloud computing?',
  'Find anything about machine learning',
  'List all PDFs I uploaded this month',
]

// ── Main AI component ─────────────────────────────────────────────────────────

function AIChat() {
  const searchParams = useSearchParams()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null)
  const [userFiles, setUserFiles] = useState<FileRecord[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)

  const [userId, setUserId] = useState<string | null>(null)

  // Load user's file list for context and get user ID
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !active) return
        if (active) setUserId(user.id)
        const files = await fetchFiles(null).catch(() => [] as FileRecord[])
        if (active) setUserFiles(files)
      } catch {
        // leave files as empty — non-fatal for the AI page
      } finally {
        if (active) setLoadingFiles(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  // Check if AI backend is available
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
  }, [messages])

  // Auto-submit if query came from URL param
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && q.trim() && messages.length === 0) {
      setQuery(q)
      // Small delay to allow component to mount
      setTimeout(() => void sendMessage(q), 100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendMessage = async (text?: string) => {
    const trimmed = (text ?? query).trim()
    if (!trimmed || loading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmed,
    }
    const loadingMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: '',
      loading: true,
    }

    setMessages((prev) => [...prev, userMsg, loadingMsg])
    setQuery('')
    setLoading(true)

    // Log the AI query
    void logAuditAI(trimmed)

    try {
      if (!backendAvailable) {
        throw new Error('backend-unavailable')
      }

      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          owner_id: userId, // Pass user ID for semantic search
          // Pass user's accessible file names for context (fallback if no vector search)
          context_files: userFiles.slice(0, 20).map((f) => ({
            name: f.name,
            type: f.file_type,
            size: f.file_size,
          })),
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) throw new Error('ai-error')

      const data = await res.json()
      const answer = data.answer ?? data.message ?? 'No answer returned.'
      const sources: Source[] = (data.sources ?? []).map(
        (s: { title?: string; name?: string; score?: number }) => ({
          title: s.title ?? s.name ?? 'Unknown',
          score: s.score,
        })
      )

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, text: answer, sources, loading: false }
            : m
        )
      )
    } catch (err) {
      const isUnavailable =
        err instanceof Error &&
        (err.message === 'backend-unavailable' || err.name === 'TimeoutError')

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? {
                ...m,
                text: isUnavailable
                  ? `The AI service is not currently running. Start the backend server at ${API_BASE} to enable AI responses.\n\nYour files are still accessible in My Drive.`
                  : 'Something went wrong with the AI service. Please try again.',
                loading: false,
                error: true,
              }
            : m
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const retry = () => {
    setBackendAvailable(null)
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) })
        setBackendAvailable(res.ok)
      } catch {
        setBackendAvailable(false)
      }
    }
    void check()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 dark:bg-white">
              <Sparkles className="h-4 w-4 text-white dark:text-black" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-neutral-900 dark:text-white">SmartCloud AI</h1>
              <p className="text-[11px] text-neutral-500">
                {loadingFiles ? 'Loading your files…' : `${userFiles.length} files in context`}
              </p>
            </div>
          </div>

          {backendAvailable === false && (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                AI offline
              </span>
              <button
                type="button"
                onClick={retry}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                aria-label="Retry connection"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {backendAvailable === true && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              AI online
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
              <Sparkles className="h-8 w-8 text-neutral-400" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Ask about your files
            </h2>
            <p className="mt-2 max-w-sm text-sm text-neutral-500">
              SmartCloud AI can answer questions about your documents, summarize content,
              and help you find information across your files.
            </p>
            {backendAvailable === false && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                <strong>AI backend offline.</strong> Start the backend server to enable AI responses.
                Your files are still fully accessible.
              </div>
            )}
            {/* Suggestion chips */}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setQuery(s); void sendMessage(s) }}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900 sm:p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-950">
            <textarea
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your files... (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent text-sm text-neutral-900 placeholder-neutral-400 outline-none dark:text-white dark:placeholder-neutral-600"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${el.scrollHeight}px`
              }}
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={loading || !query.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              aria-label="Send message"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-neutral-400">
            AI responses are based on your authorized files only. Your data stays private.
          </p>
        </div>
      </div>
    </div>
  )
}

// Wrap in Suspense because of useSearchParams
export default function AIPage() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <Suspense fallback={
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      }>
        <AIChat />
      </Suspense>
    </div>
  )
}
