'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Cloud,
  LayoutDashboard,
  HardDrive,
  Users,
  Clock,
  Star,
  Trash2,
  Sparkles,
  Search,
  Wand2,
  CreditCard,
  Settings,
  ChevronDown,
  X,
  LogOut,
  Loader2,
  BarChart3,
  Menu,
  Plus,
  FolderPlus,
  UploadCloud,
  FolderUp,
  Bell,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { StorageBar } from './StorageBar'
import { TopBar } from './TopBar'

// ─── Navigation structure ────────────────────────────────────────────────────

const AUTH_PATHS = ['/', '/login', '/register', '/forgot-password']

const NAV_MAIN = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/drive',     label: 'My Drive',   icon: HardDrive },
  { href: '/shared',   label: 'Shared',     icon: Users },
  { href: '/recent',   label: 'Recent',     icon: Clock },
  { href: '/starred',  label: 'Starred',    icon: Star },
  { href: '/trash',    label: 'Trash',      icon: Trash2 },
] as const

const NAV_AI = [
  { href: '/ai',          label: 'AI Assistant',   icon: Sparkles },
  { href: '/ai/search',   label: 'Smart Search',   icon: Search },
  { href: '/ai/organize', label: 'Smart Organize', icon: Wand2 },
] as const

const NAV_FOOTER = [
  { href: '/analytics',    label: 'Analytics',    icon: BarChart3 },
  { href: '/subscription', label: 'Subscription', icon: CreditCard },
  { href: '/settings',     label: 'Settings',     icon: Settings },
] as const

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserInfo {
  name: string
  email: string
  initials: string
}

// ─── NavItem ─────────────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  )
}

// ─── NewButton ───────────────────────────────────────────────────────────────

function NewButton({ onClose }: { onClose?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const go = (action: string) => {
    setOpen(false)
    onClose?.()
    router.push(`/drive?action=${action}`)
  }

  return (
    <div ref={ref} className="relative px-3 pb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
      >
        <Plus className="h-4 w-4" />
        New
        <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900 animate-in">
          <button
            type="button"
            onClick={() => go('new-folder')}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <FolderPlus className="h-4 w-4 text-amber-500" />
            New Folder
          </button>
          <button
            type="button"
            onClick={() => go('upload-file')}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <UploadCloud className="h-4 w-4 text-blue-500" />
            Upload File
          </button>
          <button
            type="button"
            onClick={() => go('upload-folder')}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <FolderUp className="h-4 w-4 text-indigo-500" />
            Upload Folder
          </button>
        </div>
      )}
    </div>
  )
}

// ─── UserFooter ──────────────────────────────────────────────────────────────

function UserFooter({ user }: { user: UserInfo | null }) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.replace('/login?loggedOut=1')
    } catch {
      setLoggingOut(false)
    }
  }

  if (!user) return null

  return (
    <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex items-center gap-2 rounded-lg p-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-bold text-white dark:bg-white dark:text-black">
          {user.initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-white">{user.name}</p>
          <p className="truncate text-[11px] text-neutral-500">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          aria-label="Sign out"
          className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-red-400"
        >
          {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

// ─── SidebarContent ──────────────────────────────────────────────────────────

function SidebarContent({
  pathname,
  user,
  onClose,
}: {
  pathname: string
  user: UserInfo | null
  onClose?: () => void
}) {
  const isActive = (href: string) =>
    href === '/drive'
      ? pathname === '/drive' || pathname.startsWith('/drive/')
      : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-neutral-200 px-4 py-4 dark:border-neutral-800">
        <Link href="/dashboard">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-black">
            <Cloud className="h-4 w-4" />
          </div>
        </Link>
        <Link href="/dashboard" className="text-[15px] font-bold tracking-tight text-neutral-900 dark:text-white hover:opacity-80 transition-opacity">
          SmartCloud
        </Link>
      </div>

      {/* Scrollable body */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        {/* New button */}
        <NewButton onClose={onClose} />

        {/* Main nav */}
        <div className="mt-2 space-y-0.5">
          {NAV_MAIN.map(({ href, label, icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={isActive(href)}
              onClick={onClose}
            />
          ))}
        </div>

        {/* AI section */}
        <div className="mt-3">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            AI
          </p>
          <div className="space-y-0.5">
            {NAV_AI.map(({ href, label, icon }) => (
              <NavItem
                key={label}
                href={href}
                label={label}
                icon={icon}
                active={isActive(href)}
                onClick={onClose}
              />
            ))}
          </div>
        </div>

        {/* Storage */}
        <div className="mt-3">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            Storage
          </p>
          <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/50">
            <StorageBar compact />
          </div>
        </div>

        {/* Footer nav */}
        <div className="mt-3 space-y-0.5 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          {NAV_FOOTER.map(({ href, label, icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={isActive(href)}
              onClick={onClose}
            />
          ))}
        </div>
      </div>

      {/* User footer */}
      <UserFooter user={user} />
    </div>
  )
}

// ─── AppShell ────────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<UserInfo | null>(null)

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Load user info once
  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !active) return
      const email = user.email ?? ''
      const name =
        (user.user_metadata?.full_name as string | undefined) ??
        email.split('@')[0] ??
        'User'
      const initials = name
        .split(' ')
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
      setUser({ name, email, initials })
    })
    return () => { active = false }
  }, [])

  // Auth pages — no chrome
  if (
    AUTH_PATHS.some((p) => pathname === p) ||
    pathname.startsWith('/auth/')
  ) {
    return <>{children}</>
  }

  // Derive page title from path
  const allNav = [...NAV_MAIN, ...NAV_AI, ...NAV_FOOTER] as readonly { href: string; label: string }[]
  const activeNav = allNav.find((n) =>
    n.href === '/drive'
      ? pathname === '/drive' || pathname.startsWith('/drive/')
      : pathname === n.href || pathname.startsWith(`${n.href}/`)
  )
  const pageTitle = activeNav?.label ?? 'SmartCloud'

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-100 dark:bg-neutral-950">
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden w-60 shrink-0 border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/30 md:flex md:flex-col">
        <SidebarContent pathname={pathname} user={user} />
      </aside>

      {/* ── Mobile overlay ──────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="absolute inset-y-0 left-0 w-64 border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <div className="absolute right-3 top-3 z-10">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent
              pathname={pathname}
              user={user}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* ── Main content area ───────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          title={pageTitle}
          onMenuClick={() => setMobileOpen((v) => !v)}
          user={user}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
