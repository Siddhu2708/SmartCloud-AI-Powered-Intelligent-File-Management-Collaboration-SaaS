'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, FolderPlus, UploadCloud, FolderUp } from 'lucide-react'

interface NewMenuProps {
  onNewFolder: () => void
  onUploadFile: () => void
  onUploadFolder: () => void
  variant?: 'primary' | 'neutral'
  label?: string
}

export function NewMenu({ onNewFolder, onUploadFile, onUploadFolder, variant = 'primary', label = 'New' }: NewMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const base =
    variant === 'primary'
      ? 'bg-white text-black hover:bg-neutral-200 border border-transparent'
      : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-800'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm ${base}`}
      >
        <Plus className={`w-4 h-4 ${open ? 'rotate-45' : ''} transition-transform`} />
        {label}
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-40 w-56 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden py-1.5 animate-in">
          <button
            onClick={() => { setOpen(false); onNewFolder() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-neutral-500" />
            New Folder
          </button>
          <button
            onClick={() => { setOpen(false); onUploadFile() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <UploadCloud className="w-4 h-4 text-neutral-500" />
            Upload File
          </button>
          <button
            onClick={() => { setOpen(false); onUploadFolder() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <FolderUp className="w-4 h-4 text-neutral-500" />
            Upload Folder
          </button>
        </div>
      )}
    </div>
  )
}
