'use client'

import {
  FileText,
  FileSpreadsheet,
  File,
  Presentation,
  Image,
  Video,
  Music,
  Archive,
  FileCode,
  Folder,
  FolderOpen,
} from 'lucide-react'
import { getCategory } from '@/lib/utils'

export function FileIcon({ name, className = 'w-5 h-5' }: { name: string; className?: string }) {
  const cat = getCategory(name)
  switch (cat) {
    case 'pdf': return <FileText className={`${className} text-red-500`} />
    case 'word': return <FileText className={`${className} text-blue-500`} />
    case 'excel': return <FileSpreadsheet className={`${className} text-green-600`} />
    case 'powerpoint': return <Presentation className={`${className} text-orange-500`} />
    case 'image': return <Image className={`${className} text-purple-500`} />
    case 'video': return <Video className={`${className} text-pink-500`} />
    case 'audio': return <Music className={`${className} text-cyan-500`} />
    case 'archive': return <Archive className={`${className} text-amber-600`} />
    case 'code': return <FileCode className={`${className} text-indigo-500`} />
    case 'text': return <FileText className={`${className} text-neutral-500`} />
    default: return <File className={`${className} text-neutral-400 dark:text-neutral-500`} />
  }
}

export { Folder, FolderOpen }
