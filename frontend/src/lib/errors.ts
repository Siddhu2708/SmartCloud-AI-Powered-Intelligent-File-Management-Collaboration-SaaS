export function friendlyErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const message = error instanceof Error ? error.message : String(error ?? '')

  if (!message) return fallback

  if (/network|fetch|Failed to fetch|load failed/i.test(message)) {
    return 'Network connection lost. Check your internet connection.'
  }

  if (/jwt|session|auth|unauth|forbidden|permission|rls/i.test(message)) {
    return 'Your session has expired. Please log in again.'
  }

  if (/too large|max.*size|file size|payload too large/i.test(message)) {
    return 'This file is too large to upload.'
  }

  if (/bucket|storage|upload/i.test(message)) {
    return "We couldn't upload this file. Please try again."
  }

  return fallback
}
