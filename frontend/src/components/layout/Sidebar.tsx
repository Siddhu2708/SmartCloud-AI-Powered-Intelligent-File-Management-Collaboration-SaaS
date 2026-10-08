'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Cloud,
  Folder,
  Users,
  Clock,
  Star,
  Trash2,
  LogOut,
  X,
  Loader2,
  Package,
} from 'lucide-react'
import { useState } from 'react'
import { NewMenu } from '@/components/drive/NewMenu'
import { useToast } from '@/components/shared/Toast'
import { StorageBar } from './StorageBar'

interface SidebarProps {
  open: boolean
  onClose: () => void
  userName: string
  userEmail: string
  initials: string
}

const NAV = [
  { href: '/drive', label: 'My Drive', icon: Folder },
  { href: '/shared', label: 'Shared with me', icon: Users },
  { href: '/recent', label: 'Recent', icon: Clock },
  { href: '/starred', label: 'Starred', icon: Star },
  { href: '/trash', label: 'Trash', icon: Trash2 },
]

export function Sidebar({ open, onClose, userName, userEmail, initials }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { error: showError } = useToast()
  const [loggingOut, setLoggingOut] = useState(false)
  const [selectedChunk, setSelectedChunk] = useState(512)
  const [encryptionEnabled, setEncryptionEnabled] = useState(false)

  const CHUNK_SIZES = [
    { size: 256, name: '256 KB', benefit: 'Mobile' },
    { size: 512, name: '512 KB', benefit: 'Recommended' },
    { size: 1024, name: '1 MB', benefit: 'Desktop' },
    { size: 5120, name: '5 MB', benefit: 'Large files' },
  ]

  const navItems = (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      <div className="px-2 pb-4">
        <NewMenu
          onNewFolder={() => router.push('/drive?action=new-folder')}
          onUploadFile={() => router.push('/drive?action=upload-file')}
          onUploadFolder={() => router.push('/drive?action=upload-folder')}
        />
      </div>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              active
                ? 'bg-neutral-200/70 dark:bg-white/5 text-neutral-900 dark:text-white font-medium'
                : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span>{label}</span>
          </Link>
        )
      })}

      {/* AI Section Separator */}
      <div className="my-4 px-2">
        <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
          Settings
        </div>
      </div>

      {/* File Chunking */}
      <div className="px-2 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
            <Package className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold text-neutral-900 dark:text-white">File Chunking</span>
        </div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900/30 rounded p-2">
          {CHUNK_SIZES.find(c => c.size === selectedChunk)?.name}
        </div>
      </div>

      {/* Encryption */}
      <div className="px-2 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 shrink-0">
              🔒
            </div>
            <span className="text-xs font-semibold text-neutral-900 dark:text-white">Encryption</span>
          </div>
          <button
            onClick={() => setEncryptionEnabled(!encryptionEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
              encryptionEnabled ? 'bg-green-600 dark:bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                encryptionEnabled ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {encryptionEnabled ? '🔒 Protected' : '🔓 Disabled'}
        </p>
      </div>
    </nav>
  )

  const footer = (
    <div className="border-t border-neutral-200 dark:border-neutral-900">
      <StorageBar />
      <div className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-white/10 border border-neutral-300 dark:border-white/10 flex items-center justify-center text-sm font-bold text-neutral-800 dark:text-white shrink-0">
          {initials}
        </div>
        <div className="overflow-hidden flex-1">
          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{userName}</p>
          <p className="text-xs text-neutral-500 truncate">{userEmail}</p>
        </div>
        <button
          onClick={async () => {
            setLoggingOut(true)
            try {
              const { supabase } = await import('@/lib/supabase')
              const { error } = await supabase.auth.signOut()

              if (error) {
                throw error
              }

              router.replace('/login?loggedOut=1')
            } catch (err) {
              console.error('Logout failed', err)
              showError('Unable to sign out. Please try again.')
              setLoggingOut(false)
            }
          }}
          disabled={loggingOut}
          aria-label="Logout"
          className="text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-neutral-200 dark:border-neutral-900 bg-neutral-50 dark:bg-black">
        <div className="p-5 flex items-center space-x-2.5 border-b border-neutral-200 dark:border-neutral-900">
          <Cloud className="w-7 h-7 text-neutral-900 dark:text-white" />
          <span className="text-lg font-bold tracking-wide text-neutral-900 dark:text-white">SmartCloud</span>
        </div>
        {navItems}
        {footer}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800">
            <div className="p-5 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-900">
              <div className="flex items-center space-x-2.5">
                <Cloud className="w-7 h-7 text-neutral-900 dark:text-white" />
                <span className="text-lg font-bold tracking-wide text-neutral-900 dark:text-white">SmartCloud</span>
              </div>
              <button onClick={onClose} aria-label="Close menu" className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {navItems}
            {footer}
          </aside>
        </div>
      )}
    </>
  )
}
