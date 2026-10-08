'use client'

import { useState } from 'react'
import { ChevronDown, Lock, Database, Info } from 'lucide-react'

interface ChunkSizeOption {
  label: string
  value: number
  description: string
}

const CHUNK_SIZES: ChunkSizeOption[] = [
  { label: '64 KB', value: 64, description: 'Fastest uploads' },
  { label: '128 KB', value: 128, description: 'Balanced' },
  { label: '256 KB', value: 256, description: 'Best for mobile networks' },
  { label: '512 KB', value: 512, description: 'Good for desktop' },
  { label: '1 MB', value: 1024, description: 'Fast desktop uploads' },
  { label: '2 MB', value: 2048, description: 'Very fast network' },
  { label: '5 MB', value: 5120, description: 'High-speed uploads' },
]

interface AIFileSettingsProps {
  onChunkSizeChange?: (sizeKB: number) => void
  onEncryptionToggle?: (enabled: boolean) => void
}

export function AIFileSettings({
  onChunkSizeChange,
  onEncryptionToggle,
}: AIFileSettingsProps) {
  const [chunkSize, setChunkSize] = useState(256) // Default 256 KB
  const [encryptionEnabled, setEncryptionEnabled] = useState(false)
  const [showChunkOptions, setShowChunkOptions] = useState(false)

  const handleChunkSizeChange = (sizeKB: number) => {
    setChunkSize(sizeKB)
    setShowChunkOptions(false)
    onChunkSizeChange?.(sizeKB)
  }

  const handleEncryptionToggle = () => {
    const newState = !encryptionEnabled
    setEncryptionEnabled(newState)
    onEncryptionToggle?.(newState)
  }

  const currentChunkLabel =
    CHUNK_SIZES.find((c) => c.value === chunkSize)?.label || '256 KB'
  const currentChunkDesc =
    CHUNK_SIZES.find((c) => c.value === chunkSize)?.description || 'Best for mobile networks'

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      {/* File Chunking Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
          <h3 className="font-semibold text-neutral-900 dark:text-white">
            File Chunking
          </h3>
        </div>

        {/* Current Chunk Size Display */}
        <div className="space-y-2">
          <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-950">
            <p className="text-xl font-bold text-neutral-900 dark:text-white">
              {currentChunkLabel}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {currentChunkDesc}
            </p>
          </div>

          {/* Chunk Size Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowChunkOptions(!showChunkOptions)}
              className="w-full flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              <span>Show all options</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  showChunkOptions ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {showChunkOptions && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                {CHUNK_SIZES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleChunkSizeChange(option.value)}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                      chunkSize === option.value
                        ? 'bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-white'
                        : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800/50'
                    } first:rounded-t-lg last:rounded-b-lg`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option.label}</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {option.description}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Why Chunking Info */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex gap-2">
            <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-blue-900 dark:text-blue-300">
                💡 Why chunking?
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                Splits large files into manageable pieces for reliable uploads, resumable
                transfers, and better performance.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-neutral-200 dark:bg-neutral-700" />

      {/* Encryption Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
          <h3 className="font-semibold text-neutral-900 dark:text-white">
            Encryption
          </h3>
        </div>

        {/* Encryption Status Card */}
        <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Encryption status
              </p>
              <p className={`mt-1 text-sm font-semibold ${
                encryptionEnabled
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}>
                {encryptionEnabled ? '🔒 Enabled' : '🔓 Disabled'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleEncryptionToggle}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                encryptionEnabled
                  ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60'
                  : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/60'
              }`}
            >
              {encryptionEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>

        {/* Encryption Info */}
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900/40 dark:bg-green-950/20">
          <div className="flex gap-2">
            <Lock className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-green-900 dark:text-green-300">
                🔐 Privacy first
              </p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                Enable encryption to protect sensitive files. Share with confidence!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
