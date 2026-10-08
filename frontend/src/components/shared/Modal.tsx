'use client'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh] sm:pt-[20vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full ${maxWidth} rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl`}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="px-6 pt-5 pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h3>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
