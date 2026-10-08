'use client'

import { useState } from 'react'
import { Package, ChevronRight, Zap } from 'lucide-react'

interface ChunkInfo {
  size: number
  name: string
  benefit: string
}

const CHUNK_SIZES: ChunkInfo[] = [
  {
    size: 256,
    name: '256 KB',
    benefit: 'Best for mobile networks',
  },
  {
    size: 512,
    name: '512 KB',
    benefit: 'Recommended for most users',
  },
  {
    size: 1024,
    name: '1 MB',
    benefit: 'Fast desktop uploads',
  },
  {
    size: 5120,
    name: '5 MB',
    benefit: 'Large file handling',
  },
]

export function FileChunkingSection() {
  const [selectedChunk, setSelectedChunk] = useState(512)
  const [showDetails, setShowDetails] = useState(false)

  const currentChunk = CHUNK_SIZES.find((c) => c.size === selectedChunk)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
          <Package className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
          File Chunking
        </h3>
      </div>

      {/* Current chunk display */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
        <p className="text-xs text-neutral-500">Current chunk size</p>
        <p className="mt-1 text-sm font-bold text-neutral-900 dark:text-white">
          {currentChunk?.name}
        </p>
        <p className="text-[11px] text-neutral-400">{currentChunk?.benefit}</p>

        {/* Toggle details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <Zap className="h-3 w-3" />
          {showDetails ? 'Hide options' : 'Show all options'}
        </button>
      </div>

      {/* Chunk options */}
      {showDetails && (
        <div className="space-y-2">
          {CHUNK_SIZES.map((chunk) => (
            <button
              key={chunk.size}
              onClick={() => setSelectedChunk(chunk.size)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-all ${
                selectedChunk === chunk.size
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40'
                  : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-neutral-900 dark:text-white">
                    {chunk.name}
                  </p>
                  <p className="text-[11px] text-neutral-500">{chunk.benefit}</p>
                </div>
                {selectedChunk === chunk.size && (
                  <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="rounded-lg bg-blue-50 p-2.5 text-[11px] text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
        <p className="font-medium">💡 Why chunking?</p>
        <p className="mt-1">
          Splits large files into manageable pieces for reliable uploads, resumable transfers, and better performance.
        </p>
      </div>
    </div>
  )
}
