/**
 * File Encryption Utility
 * Client-side encryption/decryption for secure file sharing
 */

export interface EncryptionConfig {
  algorithm: 'AES-GCM' | 'AES-CBC'
  keyLength: 256 | 128
}

export interface EncryptedData {
  iv: string
  salt: string
  encryptedData: string
  algorithm: string
  keyLength: number
}

const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'AES-GCM',
  keyLength: 256,
}

/**
 * Generate encryption key
 */
export async function generateEncryptionKey(
  password?: string,
  config: EncryptionConfig = DEFAULT_CONFIG
): Promise<CryptoKey> {
  if (password) {
    // Derive key from password
    return deriveKeyFromPassword(password, config)
  }

  // Generate random key
  return crypto.subtle.generateKey(
    {
      name: config.algorithm,
      length: config.keyLength,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  )
}

/**
 * Derive key from password using PBKDF2
 */
export async function deriveKeyFromPassword(
  password: string,
  config: EncryptionConfig = DEFAULT_CONFIG
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)

  // Import password as key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  // Derive actual key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: crypto.getRandomValues(new Uint8Array(16)),
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: config.algorithm,
      length: config.keyLength,
    },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt file data
 */
export async function encryptFile(
  fileData: ArrayBuffer,
  key: CryptoKey,
  config: EncryptionConfig = DEFAULT_CONFIG
): Promise<EncryptedData> {
  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Encrypt
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: config.algorithm,
      iv: iv,
    },
    key,
    fileData
  )

  // Convert to base64 for storage
  return {
    iv: btoa(String.fromCharCode.apply(null, Array.from(iv))),
    salt: btoa(String.fromCharCode.apply(null, Array.from(salt))),
    encryptedData: btoa(
      String.fromCharCode.apply(null, Array.from(new Uint8Array(encryptedBuffer)))
    ),
    algorithm: config.algorithm,
    keyLength: config.keyLength,
  }
}

/**
 * Decrypt file data
 */
export async function decryptFile(
  encrypted: EncryptedData,
  key: CryptoKey
): Promise<ArrayBuffer> {
  // Convert from base64
  const iv = new Uint8Array(
    atob(encrypted.iv)
      .split('')
      .map((c) => c.charCodeAt(0))
  )

  const encryptedData = new Uint8Array(
    atob(encrypted.encryptedData)
      .split('')
      .map((c) => c.charCodeAt(0))
  )

  // Decrypt
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: encrypted.algorithm,
      iv: iv,
    },
    key,
    encryptedData
  )

  return decryptedBuffer
}

/**
 * Export key as string
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key)
  const exportedAsString = String.fromCharCode.apply(null, Array.from(new Uint8Array(exported)))
  return btoa(exportedAsString)
}

/**
 * Import key from string
 */
export async function importKey(
  keyString: string,
  config: EncryptionConfig = DEFAULT_CONFIG
): Promise<CryptoKey> {
  const binaryString = atob(keyString)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return crypto.subtle.importKey(
    'raw',
    bytes,
    config.algorithm,
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Generate random encryption key string
 */
export function generateKeyString(): string {
  const array = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Validate key string format
 */
export function isValidKeyString(key: string): boolean {
  // Check if it's valid hex string (64 chars for 256-bit key)
  return /^[0-9a-f]{64}$/i.test(key)
}

/**
 * Hash data for integrity check
 */
export async function hashData(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Encrypt and hash (integrity check)
 */
export async function encryptWithHash(
  fileData: ArrayBuffer,
  key: CryptoKey,
  config: EncryptionConfig = DEFAULT_CONFIG
): Promise<EncryptedData & { hash: string }> {
  const encrypted = await encryptFile(fileData, key, config)
  const hash = await hashData(fileData)

  return {
    ...encrypted,
    hash,
  }
}

/**
 * Decrypt and verify hash
 */
export async function decryptWithHashCheck(
  encrypted: EncryptedData & { hash: string },
  key: CryptoKey
): Promise<ArrayBuffer> {
  const decrypted = await decryptFile(encrypted, key)
  const hash = await hashData(decrypted)

  if (hash !== encrypted.hash) {
    throw new Error('File integrity check failed - data may be corrupted')
  }

  return decrypted
}
