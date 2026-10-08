import { DriveView } from '@/components/drive/DriveView'

export default async function DrivePage({ params }: { params: Promise<{ folderId?: string[] }> }) {
  const resolved = await params
  const folderId = resolved.folderId?.[0] ?? null

  return <DriveView folderId={folderId} />
}
