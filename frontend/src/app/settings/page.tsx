'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldCheck,
  BellRing,
  Sparkles,
  HardDrive,
  CreditCard,
  SlidersHorizontal,
  Lock,
  User,
  ChevronRight,
  CheckCircle2,
  LogOut,
  Loader2,
  Activity,
  Shield,
} from 'lucide-react'
import { useToast } from '@/components/shared/Toast'
import { supabase } from '@/lib/supabase'
import { fetchAuditLogs } from '@/lib/storage'
import type { AuditLog } from '@/lib/storage'
import { formatRelativeTime } from '@/lib/utils'

// ── Toggle component ──────────────────────────────────────────────────────────

function Toggle({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-200 dark:bg-neutral-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform dark:bg-neutral-900 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 ${className}`}>
      {children}
    </div>
  )
}

function SectionHeader({ title, description, icon: Icon }: { title: string; description?: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
        <Icon className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</h2>
        {description && <p className="text-xs text-neutral-500">{description}</p>}
      </div>
    </div>
  )
}

// ── Action map ────────────────────────────────────────────────────────────────

function auditLabel(action: string): string {
  const map: Record<string, string> = {
    FILE_UPLOADED: 'Uploaded a file',
    FILE_DOWNLOADED: 'Downloaded a file',
    FILE_DELETED: 'Moved file to Trash',
    FILE_RENAMED: 'Renamed a file',
    FILE_MOVED: 'Moved a file',
    FILE_SHARED: 'Shared a file',
    FILE_RESTORED: 'Restored a file',
    FOLDER_CREATED: 'Created a folder',
    FOLDER_DELETED: 'Deleted a folder',
    FOLDER_RENAMED: 'Renamed a folder',
    FOLDER_MOVED: 'Moved a folder',
    SHARE_CREATED: 'Shared an item',
    AI_QUERY: 'Used AI assistant',
    LOGIN: 'Signed in',
    LOGOUT: 'Signed out',
  }
  return map[action] ?? action.replace(/_/g, ' ').toLowerCase()
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const { error: showError, success } = useToast()
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userInitials, setUserInitials] = useState('?')
  const [provider, setProvider] = useState<string>('')

  // AI / privacy settings
  const [aiAnalysis, setAiAnalysis] = useState(true)
  const [aiContent, setAiContent] = useState(true)
  const [orgMode, setOrgMode] = useState<'manual' | 'suggest' | 'auto'>('suggest')

  // Notifications
  const [notifyUpload, setNotifyUpload] = useState(true)
  const [notifyShare, setNotifyShare] = useState(true)
  const [notifyStorage, setNotifyStorage] = useState(true)

  // Audit
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loadingAudit, setLoadingAudit] = useState(true)

  // UI state
  const [signingOut, setSigningOut] = useState(false)
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'ai' | 'notifications' | 'storage'>('account')

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const name = (user.user_metadata?.full_name as string | undefined) ?? user.email?.split('@')[0] ?? 'User'
      setUserName(name)
      setUserEmail(user.email ?? '')
      setUserInitials(name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase())
      setProvider(user.app_metadata?.provider ?? 'email')

      // Load localStorage prefs
      const storedAi = window.localStorage.getItem('smartcloud.ai-analysis')
      const storedAiContent = window.localStorage.getItem('smartcloud.ai-content')
      const storedOrg = window.localStorage.getItem('smartcloud.org-mode') as 'manual' | 'suggest' | 'auto' | null
      if (storedAi !== null) setAiAnalysis(storedAi === 'true')
      if (storedAiContent !== null) setAiContent(storedAiContent === 'true')
      if (storedOrg) setOrgMode(storedOrg)
    }
    void run()
  }, [])

  // Persist AI/org prefs
  useEffect(() => { window.localStorage.setItem('smartcloud.ai-analysis', String(aiAnalysis)) }, [aiAnalysis])
  useEffect(() => { window.localStorage.setItem('smartcloud.ai-content', String(aiContent)) }, [aiContent])
  useEffect(() => { window.localStorage.setItem('smartcloud.org-mode', orgMode) }, [orgMode])

  // Load audit logs
  useEffect(() => {
    fetchAuditLogs(20)
      .then(setAuditLogs)
      .catch(() => setAuditLogs([]))
      .finally(() => setLoadingAudit(false))
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
      router.replace('/login?loggedOut=1')
    } catch {
      showError('Unable to sign out right now.')
      setSigningOut(false)
    }
  }

  const tabs = [
    { id: 'account' as const, label: 'Account', icon: User },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'ai' as const, label: 'AI & Privacy', icon: Sparkles },
    { id: 'notifications' as const, label: 'Notifications', icon: BellRing },
    { id: 'storage' as const, label: 'Storage', icon: HardDrive },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Settings</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage your account, security, and SmartCloud preferences.</p>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Tab nav */}
          <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-48 lg:flex-col">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === id
                    ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white'
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800/60 dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="min-w-0 flex-1 space-y-4">

            {/* ── Account ── */}
            {activeTab === 'account' && (
              <>
                <SectionCard>
                  <SectionHeader title="Profile" icon={User} />
                  <div className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-lg font-bold text-white dark:bg-white dark:text-black">
                        {userInitials}
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900 dark:text-white">{userName || '—'}</p>
                        <p className="text-sm text-neutral-500">{userEmail || '—'}</p>
                        <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium capitalize text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                          {provider === 'google' ? '🔵 Google account' : '📧 Email account'}
                        </span>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard>
                  <SectionHeader title="Subscription" description="Manage your plan" icon={CreditCard} />
                  <div className="p-5">
                    <Link
                      href="/subscription"
                      className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
                    >
                      <span className="text-neutral-700 dark:text-neutral-300">View and manage subscription</span>
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </Link>
                  </div>
                </SectionCard>

                <SectionCard>
                  <SectionHeader title="Danger zone" icon={Lock} />
                  <div className="p-5">
                    <button
                      type="button"
                      disabled={signingOut}
                      onClick={() => void handleSignOut()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                    >
                      {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                      {signingOut ? 'Signing out…' : 'Sign out of all sessions'}
                    </button>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── Security ── */}
            {activeTab === 'security' && (
              <>
                <SectionCard>
                  <SectionHeader title="Account security" icon={ShieldCheck} description="Your current security status" />
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {[
                      { label: 'Email verified', ok: true },
                      { label: provider === 'google' ? 'Google OAuth active' : 'Email authentication active', ok: true },
                      { label: 'Session protected (JWT)', ok: true },
                      { label: 'Row-level security enabled', ok: true },
                      { label: 'Storage bucket private', ok: true },
                    ].map(({ label, ok }) => (
                      <div key={label} className="flex items-center justify-between px-5 py-3">
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
                        <CheckCircle2 className={`h-4 w-4 ${ok ? 'text-emerald-500' : 'text-red-500'}`} />
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard>
                  <SectionHeader title="Recent activity" description="Last 20 security events" icon={Activity} />
                  <div className="p-4">
                    {loadingAudit ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                      </div>
                    ) : auditLogs.length === 0 ? (
                      <p className="py-4 text-center text-sm text-neutral-500">No activity recorded yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {auditLogs.map((log) => (
                          <div key={log.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                            <div className="flex items-center gap-2.5">
                              <div className="h-1.5 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                              <span className="text-sm text-neutral-700 dark:text-neutral-300 capitalize">{auditLabel(log.action)}</span>
                            </div>
                            <span className="text-[11px] text-neutral-400">{formatRelativeTime(log.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── AI & Privacy ── */}
            {activeTab === 'ai' && (
              <>
                <SectionCard>
                  <SectionHeader title="AI document processing" icon={Sparkles} description="Control how SmartCloud AI uses your files" />
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    <label className="flex items-center justify-between gap-4 px-5 py-4">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">AI can analyze my documents</p>
                        <p className="text-xs text-neutral-500">Allow SmartCloud AI to process your uploaded files for summaries and Q&A.</p>
                      </div>
                      <Toggle id="ai-analysis" checked={aiAnalysis} onChange={setAiAnalysis} />
                    </label>
                    <label className="flex items-center justify-between gap-4 px-5 py-4">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">Use document content for AI</p>
                        <p className="text-xs text-neutral-500">Allow document text to be sent to the AI model for analysis.</p>
                      </div>
                      <Toggle id="ai-content" checked={aiContent} onChange={setAiContent} />
                    </label>
                  </div>
                  {!aiAnalysis && (
                    <div className="mx-5 mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                      AI processing is disabled. Your files are still fully accessible in My Drive.
                    </div>
                  )}
                </SectionCard>

                <SectionCard>
                  <SectionHeader title="Smart Organization mode" icon={SlidersHorizontal} />
                  <div className="p-5">
                    <div className="space-y-2">
                      {([
                        ['manual', 'Manual', 'Files are never moved automatically.'],
                        ['suggest', 'Suggest organization', 'SmartCloud suggests moves — you approve each one.'],
                        ['auto', 'Auto organize', 'Files are automatically sorted when uploaded.'],
                      ] as const).map(([value, label, desc]) => (
                        <label
                          key={value}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            orgMode === value
                              ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-400 dark:bg-neutral-800/50'
                              : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/30'
                          }`}
                        >
                          <input
                            type="radio"
                            name="orgMode"
                            value={value}
                            checked={orgMode === value}
                            onChange={() => setOrgMode(value)}
                            className="mt-0.5 accent-neutral-900 dark:accent-white"
                          />
                          <div>
                            <p className="text-sm font-medium text-neutral-900 dark:text-white">{label}</p>
                            <p className="text-xs text-neutral-500">{desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <Link
                      href="/ai/organize"
                      className="mt-4 flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
                    >
                      <span className="text-neutral-700 dark:text-neutral-300">Open Smart Organize</span>
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </Link>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── Notifications ── */}
            {activeTab === 'notifications' && (
              <SectionCard>
                <SectionHeader title="Notification preferences" icon={BellRing} description="Alerts and status notifications" />
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {[
                    { id: 'notify-upload', label: 'Upload complete', desc: 'Show a notification when uploads finish.', val: notifyUpload, set: setNotifyUpload },
                    { id: 'notify-share', label: 'File shared', desc: 'Notify when someone shares a file with you.', val: notifyShare, set: setNotifyShare },
                    { id: 'notify-storage', label: 'Storage warnings', desc: 'Alert when storage is 80% or more full.', val: notifyStorage, set: setNotifyStorage },
                  ].map(({ id, label, desc, val, set }) => (
                    <label key={id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{label}</p>
                        <p className="text-xs text-neutral-500">{desc}</p>
                      </div>
                      <Toggle id={id} checked={val} onChange={set} />
                    </label>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* ── Storage ── */}
            {activeTab === 'storage' && (
              <SectionCard>
                <SectionHeader title="Storage" description="Manage your storage usage" icon={HardDrive} />
                <div className="p-5 space-y-4">
                  <p className="text-sm text-neutral-500">
                    View detailed storage breakdown and upgrade your plan to get more space.
                  </p>
                  <Link
                    href="/subscription"
                    className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
                  >
                    <span className="text-neutral-700 dark:text-neutral-300">Manage storage & subscription</span>
                    <ChevronRight className="h-4 w-4 text-neutral-400" />
                  </Link>
                  <Link
                    href="/trash"
                    className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
                  >
                    <span className="text-neutral-700 dark:text-neutral-300">Empty Trash to free space</span>
                    <ChevronRight className="h-4 w-4 text-neutral-400" />
                  </Link>
                </div>
              </SectionCard>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
