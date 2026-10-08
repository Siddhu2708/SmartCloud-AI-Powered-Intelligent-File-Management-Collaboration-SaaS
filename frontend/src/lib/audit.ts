import { supabase } from './supabase'
import { getUserId } from './storage'

interface AuditInput {
  action: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
}

/**
 * Write one audit log row.
 *
 * Designed to NEVER throw or reject — audit failures must not break the
 * primary user flow. If the live schema is missing optional columns (e.g.
 * during a fresh deployment before migrations run) we fall back to writing
 * only the guaranteed columns (user_id, action, created_at).
 */
export async function logAudit({
  action,
  resourceType,
  resourceId,
  metadata,
}: AuditInput): Promise<void> {
  try {
    const userId = (await getUserId()) ?? ''
    if (!userId) return

    // Full insert — works once migration 001 has been applied.
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      resource_type: resourceType ?? null,
      resource_id: resourceId ?? null,
      metadata: metadata ?? null,
    })

    if (error) {
      // PGRST204 = column doesn't exist in schema cache yet.
      // Fall back to minimal insert (user_id + action only) so the UI
      // never breaks while waiting for the migration to be applied.
      if (error.code === 'PGRST204') {
        console.warn(
          '[audit] Schema cache missing column — falling back to minimal insert.',
          error.message,
        )
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action,
        })
      } else {
        // Log other errors for debugging but still swallow them
        console.warn('[audit] Insert failed:', error.message)
      }
    }
  } catch (err) {
    // Swallow all errors — audit must never break the primary flow
    console.warn('[audit] Unexpected error:', err)
  }
}
