import type { FileRecord } from './types'

export type FileCategory = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'video' | 'audio' | 'archive' | 'text' | 'code' | 'unknown'

const EXT_CATEGORY: Record<string, FileCategory> = {
  pdf: 'pdf',
  doc: 'word', docx: 'word', docm: 'word', dotx: 'word', dotm: 'word',
  xls: 'excel', xlsx: 'excel', csv: 'excel', xlsm: 'excel', xlsb: 'excel',
  ppt: 'powerpoint', pptx: 'powerpoint', pps: 'powerpoint', ppsx: 'powerpoint', pptm: 'powerpoint',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', ico: 'image', avif: 'image', tiff: 'image',
  mp4: 'video', mkv: 'video', mov: 'video', avi: 'video', webm: 'video', m4v: 'video', mpg: 'video', mpeg: 'video', wmv: 'video', flv: 'video', '3gp': 'video',
  mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', wma: 'audio', opus: 'audio',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive', bz2: 'archive', xz: 'archive', iso: 'archive', 'tar.gz': 'archive',
  txt: 'text', md: 'text', rtf: 'text', log: 'text',
  js: 'code', ts: 'code', tsx: 'code', jsx: 'code', py: 'code', java: 'code', c: 'code', cpp: 'code', cs: 'code', go: 'code', rs: 'code', rb: 'code', php: 'code', html: 'code', css: 'code', json: 'code', xml: 'code', sql: 'code', sh: 'code', yaml: 'code', yml: 'code',
}

export function getExtension(name: string): string {
  if (!name) return ''
  const base = name.toLowerCase()
  if (base.endsWith('.tar.gz')) return 'tar.gz'
  const idx = base.lastIndexOf('.')
  if (idx <= 0) return ''
  return base.slice(idx + 1)
}

export function getCategory(name: string): FileCategory {
  const ext = getExtension(name)
  return EXT_CATEGORY[ext] ?? 'unknown'
}

export function getMimeType(name: string): string {
  const ext = getExtension(name)
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    csv: 'text/csv', txt: 'text/plain', md: 'text/markdown', rtf: 'application/rtf', json: 'application/json',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
    mp4: 'video/mp4', mkv: 'video/x-matroska', mov: 'video/quicktime', avi: 'video/x-msvideo', webm: 'video/webm',
    mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac',
    zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed', tar: 'application/x-tar', gz: 'application/gzip',
    js: 'text/javascript', ts: 'text/typescript', py: 'text/x-python', html: 'text/html', css: 'text/css', xml: 'application/xml', sql: 'application/sql', sh: 'application/x-sh',
  }
  return map[ext] ?? 'application/octet-stream'
}

export function getDisplayType(name: string): string {
  const ext = getExtension(name)
  if (!ext) return 'Unknown'
  return ext.toUpperCase()
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '--'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const v = value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)
  return `${v} ${units[unit]}`
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatRelativeTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(iso)
}

export function isImageFile(file: FileRecord): boolean {
  return getCategory(file.name) === 'image'
}

export function fileKey(file: { id: string }): string {
  return file.id
}
