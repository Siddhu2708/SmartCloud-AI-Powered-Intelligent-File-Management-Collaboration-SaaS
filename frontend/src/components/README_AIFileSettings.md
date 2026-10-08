# AI File Settings Component

## Overview

The `AIFileSettings` component provides UI controls for file chunking and encryption in the left panel of the AI section.

## Features

### File Chunking
- Configurable chunk sizes: 64KB, 128KB, 256KB (default), 512KB, 1MB, 2MB, 5MB
- Shows current selection with best-use description
- Dropdown to change settings
- Info box explaining chunking benefits

### Encryption
- Enable/Disable toggle for file encryption
- Status display (🔒 Enabled / 🔓 Disabled)
- Privacy-first messaging
- Color-coded status

## Usage

### Basic Import & Use

```tsx
'use client'

import { AIFileSettings } from '@/components/AIFileSettings'
import { useState } from 'react'

export function MyAIPage() {
  const [chunkSize, setChunkSize] = useState(256)
  const [encryptionEnabled, setEncryptionEnabled] = useState(false)

  return (
    <div className="flex gap-4">
      <aside className="w-80">
        <AIFileSettings
          onChunkSizeChange={setChunkSize}
          onEncryptionToggle={setEncryptionEnabled}
        />
      </aside>
      
      <main className="flex-1">
        {/* Your chat/main content */}
      </main>
    </div>
  )
}
```

### With Chunked Upload

```tsx
'use client'

import { AIFileSettings } from '@/components/AIFileSettings'
import { useChunkedUpload } from '@/hooks/useChunkedUpload'
import { useEncryption } from '@/hooks/useEncryption'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'

export function MyAIPage() {
  const [chunkSize, setChunkSize] = useState(256)
  const [encryptionEnabled, setEncryptionEnabled] = useState(false)
  const [token, setToken] = useState<string>('')

  // Get JWT token
  useState(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || '')
    })
  }, [])

  const { uploadFile, progress } = useChunkedUpload(token)
  const { encryptFile, generateEncryptionKey } = useEncryption(token)

  const handleFileSelect = async (file: File) => {
    try {
      // Optionally encrypt
      let fileToUpload = file
      let encryptionKey: string | null = null

      if (encryptionEnabled) {
        const encrypted = await encryptFile(file)
        encryptionKey = encrypted.key
        console.log('Encryption key:', encryptionKey)
      }

      // Upload with chunks
      const fileId = crypto.randomUUID()
      await uploadFile(fileToUpload, fileId, {
        chunkSizeKB: chunkSize,
        encrypt: encryptionEnabled,
        onProgress: (p) => console.log(`Progress: ${p}%`),
      })

      console.log('Upload complete!')
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }

  return (
    <div className="flex gap-4">
      <aside className="w-80">
        <AIFileSettings
          onChunkSizeChange={setChunkSize}
          onEncryptionToggle={setEncryptionEnabled}
        />
      </aside>

      <main className="flex-1">
        <input
          type="file"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />
        <p>Upload progress: {progress}%</p>
      </main>
    </div>
  )
}
```

## Props

```tsx
interface AIFileSettingsProps {
  onChunkSizeChange?: (sizeKB: number) => void
  onEncryptionToggle?: (enabled: boolean) => void
}
```

### Callbacks

- `onChunkSizeChange(sizeKB)` — Called when user selects new chunk size
  - Values: 64, 128, 256, 512, 1024, 2048, 5120

- `onEncryptionToggle(enabled)` — Called when encryption is toggled
  - Values: true (enabled) or false (disabled)

## Styling

The component uses Tailwind CSS with full dark mode support. Customize by modifying the className in the component.

## Related Hooks

### useChunkedUpload

```tsx
const {
  uploading,          // boolean - upload in progress
  progress,           // number - 0-100
  uploadSession,      // UploadSession | null
  uploadFile,         // (file, fileId, options) => Promise
  initializeUpload,   // (fileId, fileName, size, options) => Promise
  uploadChunk,        // (sessionId, index, chunk) => Promise
  getProgress,        // (sessionId) => Promise
  cancelUpload,       // (sessionId) => Promise
} = useChunkedUpload(token)
```

### useEncryption

```tsx
const {
  encrypting,              // boolean - encryption in progress
  decrypting,              // boolean - decryption in progress
  error,                   // string | null
  encryptFile,             // (file) => Promise<EncryptionResult>
  decryptFile,             // (file, key) => Promise<DecryptionResult>
  generateEncryptionKey,   // () => string
} = useEncryption(token)
```

## API Endpoints

### Upload

- `POST /upload/init-chunked` — Initialize chunked upload
- `POST /upload/chunk` — Upload single chunk
- `GET /upload/progress/{sessionId}` — Get progress
- `POST /upload/complete/{sessionId}` — Complete upload
- `POST /upload/cancel/{sessionId}` — Cancel upload

### Encryption

- `POST /upload/encrypt` — Encrypt file
- `POST /upload/decrypt` — Decrypt file

All endpoints require `Authorization: Bearer <token>` header.

## Example: Complete Integration

See `frontend/src/app/ai/page.tsx` for full example with chat + file settings.
