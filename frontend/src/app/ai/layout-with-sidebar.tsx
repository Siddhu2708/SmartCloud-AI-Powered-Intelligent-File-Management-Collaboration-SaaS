'use client'

import { useState } from 'react'
import { AIFileSettings } from '@/components/AIFileSettings'

interface AILayoutWithSidebarProps {
  children: React.ReactNode
}

export function AILayoutWithSidebar({ children }: AILayoutWithSidebarProps) {
  const [chunkSize, setChunkSize] = useState(256)
  const [encryptionEnabled, setEncryptionEnabled] = useState(false)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] gap-4 bg-neutral-50 p-4 dark:bg-neutral-950">
      {/* Left Sidebar - File Settings */}
      <aside className="w-80 shrink-0 overflow-y-auto">
        <AIFileSettings
          onChunkSizeChange={setChunkSize}
          onEncryptionToggle={setEncryptionEnabled}
        />
        
        {/* Debug info (optional) */}
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900">
          <p className="font-medium text-neutral-600 dark:text-neutral-400">Current Settings</p>
          <p className="mt-2 text-neutral-500 dark:text-neutral-400">
            Chunk: <span className="font-mono">{chunkSize} KB</span>
          </p>
          <p className="text-neutral-500 dark:text-neutral-400">
            Encryption: <span className="font-mono">{encryptionEnabled ? 'On' : 'Off'}</span>
          </p>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        {children}
      </main>
    </div>
  )
}
