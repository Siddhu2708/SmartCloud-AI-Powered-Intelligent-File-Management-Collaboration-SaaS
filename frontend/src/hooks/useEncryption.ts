'use client'

import { useState, useCallback } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface EncryptionResult {
  fileName: string
  encrypted: boolean
  key: string
  sizeBytes: number
}

interface DecryptionResult {
  fileName: string
  decrypted: boolean
  sizeBytes: number
}

export function useEncryption(token: string) {
  const [encrypting, setEncrypting] = useState(false)
  const [decrypting, setDecrypting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const encryptFile = useCallback(
    async (file: File): Promise<EncryptionResult> => {
      setEncrypting(true)
      setError(null)

      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(`${API_BASE}/upload/encrypt`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Encryption failed')
        }

        const result: EncryptionResult = await response.json()
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Encryption error'
        setError(message)
        throw err
      } finally {
        setEncrypting(false)
      }
    },
    [token]
  )

  const decryptFile = useCallback(
    async (file: File, encryptionKey: string): Promise<DecryptionResult> => {
      setDecrypting(true)
      setError(null)

      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(
          `${API_BASE}/upload/decrypt?key=${encodeURIComponent(encryptionKey)}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        )

        if (!response.ok) {
          throw new Error('Decryption failed')
        }

        const result: DecryptionResult = await response.json()
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Decryption error'
        setError(message)
        throw err
      } finally {
        setDecrypting(false)
      }
    },
    [token]
  )

  const generateEncryptionKey = useCallback(() => {
    // Generate a random key (base64 encoded)
    const array = new Uint8Array(32) // 32 bytes = 256 bits
    crypto.getRandomValues(array)
    return Buffer.from(array).toString('base64')
  }, [])

  return {
    encrypting,
    decrypting,
    error,
    encryptFile,
    decryptFile,
    generateEncryptionKey,
  }
}
