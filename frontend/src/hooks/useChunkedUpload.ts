'use client'

import { useState, useCallback } from 'react'

interface ChunkedUploadOptions {
  chunkSizeKB?: number
  encrypt?: boolean
  onProgress?: (progress: number) => void
  onError?: (error: string) => void
}

interface UploadSession {
  uploadSessionId: string
  fileId: string
  totalChunks: number
  chunkSizeKB: number
  fileSizeBytes: number
  status: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export function useChunkedUpload(token: string) {
  const [uploading, setUploading] = useState(false)
  const [uploadSession, setUploadSession] = useState<UploadSession | null>(null)
  const [progress, setProgress] = useState(0)

  const initializeUpload = useCallback(
    async (
      fileId: string,
      fileName: string,
      fileSizeBytes: number,
      options: ChunkedUploadOptions = {}
    ) => {
      try {
        const chunkSizeKB = options.chunkSizeKB ?? 256

        const response = await fetch(`${API_BASE}/upload/init-chunked`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            file_id: fileId,
            file_name: fileName,
            file_size_bytes: fileSizeBytes,
            chunk_size_kb: chunkSizeKB,
            encrypt: options.encrypt ?? false,
          }),
        })

        if (!response.ok) throw new Error('Failed to initialize upload')

        const session: UploadSession = await response.json()
        setUploadSession(session)
        return session
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload initialization failed'
        options.onError?.(message)
        throw error
      }
    },
    [token]
  )

  const uploadChunk = useCallback(
    async (uploadSessionId: string, chunkIndex: number, chunk: Blob) => {
      try {
        const formData = new FormData()
        formData.append('file', chunk)

        const response = await fetch(
          `${API_BASE}/upload/chunk?upload_session_id=${uploadSessionId}&chunk_index=${chunkIndex}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        )

        if (!response.ok) throw new Error('Chunk upload failed')

        return await response.json()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Chunk upload failed'
        throw new Error(message)
      }
    },
    [token]
  )

  const uploadFile = useCallback(
    async (
      file: File,
      fileId: string,
      options: ChunkedUploadOptions = {}
    ) => {
      setUploading(true)
      setProgress(0)

      try {
        // Initialize upload
        const session = await initializeUpload(
          fileId,
          file.name,
          file.size,
          options
        )

        // Calculate chunks
        const chunkSizeBytes = (options.chunkSizeKB ?? 256) * 1024
        const chunks: Blob[] = []

        for (let i = 0; i < file.size; i += chunkSizeBytes) {
          const end = Math.min(i + chunkSizeBytes, file.size)
          chunks.push(file.slice(i, end))
        }

        // Upload each chunk
        for (let i = 0; i < chunks.length; i++) {
          await uploadChunk(session.uploadSessionId, i, chunks[i])

          // Update progress
          const newProgress = Math.round(((i + 1) / chunks.length) * 100)
          setProgress(newProgress)
          options.onProgress?.(newProgress)
        }

        // Complete upload
        const completeResponse = await fetch(
          `${API_BASE}/upload/complete/${session.uploadSessionId}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (!completeResponse.ok) throw new Error('Failed to complete upload')

        setProgress(100)
        return { success: true, session }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed'
        options.onError?.(message)
        setProgress(0)
        throw error
      } finally {
        setUploading(false)
      }
    },
    [initializeUpload, uploadChunk]
  )

  const getProgress = useCallback(
    async (uploadSessionId: string) => {
      try {
        const response = await fetch(
          `${API_BASE}/upload/progress/${uploadSessionId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (!response.ok) throw new Error('Failed to get progress')

        return await response.json()
      } catch (error) {
        throw error
      }
    },
    [token]
  )

  const cancelUpload = useCallback(
    async (uploadSessionId: string) => {
      try {
        const response = await fetch(
          `${API_BASE}/upload/cancel/${uploadSessionId}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (!response.ok) throw new Error('Failed to cancel upload')

        setProgress(0)
        setUploadSession(null)
        return await response.json()
      } catch (error) {
        throw error
      }
    },
    [token]
  )

  return {
    uploading,
    progress,
    uploadSession,
    uploadFile,
    initializeUpload,
    uploadChunk,
    getProgress,
    cancelUpload,
  }
}
