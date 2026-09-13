/**
 * True only on the Lovable-hosted test site (*.lovable.app / *.lovable.dev).
 *
 * That environment cannot deliver the branded sign-in code email, so the
 * second step would lock testers out. The real site (stepfighter.com and any
 * other custom domain) is unaffected and still enforces it.
 */
export function isLovablePreviewHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h.endsWith('.lovable.app') || h.endsWith('.lovable.dev') || h === 'localhost'
}
