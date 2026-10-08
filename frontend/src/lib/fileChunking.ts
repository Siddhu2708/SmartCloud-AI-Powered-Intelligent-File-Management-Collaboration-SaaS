/**
 * File Chunking Utility
 * Splits large files into manageable chunks for upload
 */

export interface ChunkConfig {
  sizeKB: number
  onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void
}

export interface ChunkResult {
  chunkIndex: number
  data: ArrayBuffer
  size: number
  hash: string
}

/**
 * Split file into chunks
 */
export async function chunkFile(
  file: File,
  config: ChunkConfig
): Promise<ChunkResult[]> {
  const chunkSize = config.sizeKB * 1024
  const chunks: ChunkResult[] = []
  let offset = 0

  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size)
    const chunk = file.slice(offset, end)
    const arrayBuffer = await chunk.arrayBuffer()

    // Calculate hash for chunk
    const hash = await calculateHash(arrayBuffer)

    chunks.push({
      chunkIndex: chunks.length,
      data: arrayBuffer,
      size: arrayBuffer.byteLength,
      hash,
    })

    offset = end

    // Report progress
    if (config.onProgress) {
      config.onProgress({
        loaded: offset,
        total: file.size,
        percentage: Math.round((offset / file.size) * 100),
      })
    }
  }

  return chunks
}

/**
 * Calculate SHA-256 hash of data
 */
export async function calculateHash(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Get optimal chunk size based on network
 */
export function getOptimalChunkSize(): number {
  // Check connection type if available
  const connection = (navigator as any).connection

  if (connection) {
    const effectiveType = connection.effectiveType
    switch (effectiveType) {
      case '4g':
        return 5120 // 5MB for fast networks
      case '3g':
        return 512 // 512KB for 3G
      case '2g':
        return 256 // 256KB for 2G
      case 'slow-2g':
        return 256 // 256KB for very slow
      default:
        return 1024 // 1MB default
    }
  }

  // Fallback to 1MB
  return 1024
}

/**
 * Validate chunk integrity
 */
export async function validateChunk(
  chunk: ChunkResult,
  expectedHash: string
): Promise<boolean> {
  const actualHash = await calculateHash(chunk.data)
  return actualHash === expectedHash
}

/**
 * Combine chunks back into a blob
 */
export function combineChunks(chunks: ArrayBuffer[]): Blob {
  return new Blob(chunks, { type: 'application/octet-stream' })
}

/**
 * Format chunk size for display
 */
export function formatChunkSize(sizeKB: number): string {
  if (sizeKB < 1024) {
    return `${sizeKB} KB`
  }
  return `${(sizeKB / 1024).toFixed(1)} MB`
}

/**
 * Estimate upload time
 */
export function estimateUploadTime(
  fileSizeBytes: number,
  speedMBps: number
): number {
  const fileSizeMB = fileSizeBytes / (1024 * 1024)
  return (fileSizeMB / speedMBps) * 1000 // Return in ms
}
