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
