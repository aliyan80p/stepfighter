import * as React from 'react'
import { render } from '@react-email/render'
import { EmailAPIError, sendLovableEmail } from '@lovable.dev/email-js'
import { TEMPLATES } from './registry'

// Server-only: reads LOVABLE_API_KEY. Never import from client components.

// Configuration baked in at scaffold time
const SITE_NAME = "StepFighter"
// SENDER_DOMAIN is the verified sender subdomain FQDN (e.g., "notify.example.com").
// It MUST match the subdomain delegated to Lovable's nameservers. NEVER use the root domain.
const SENDER_DOMAIN = "notify.stepfighter.com"
// FROM_DOMAIN is the domain shown in the From: header (e.g., "example.com").
// Can be the root domain when display_from_root is enabled — this is cosmetic only.
const FROM_DOMAIN = "notify.stepfighter.com"

export type SendTemplateEmailResult =
  | { sent: true }
  | { sent: false; reason: 'recipient_suppressed' }

export interface SendTemplateEmailOptions {
  templateData?: Record<string, any>
  /** Dedupes retries of the same logical send; defaults to a random UUID (no dedupe). */
  idempotencyKey?: string
  replyTo?: string
}

/**
 * Renders a registered template and sends it through Lovable's managed email
 * API. Suppression, retries, and rate limits are enforced by Lovable
 * server-side. A suppressed recipient is an expected outcome
 * ({ sent: false }); any other failure throws — EmailAPIError exposes
 * .code and .status for branching.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {}
): Promise<SendTemplateEmailResult> {
  // Standby (Cloudflare/Supabase) opts into Brevo with EMAIL_PROVIDER=brevo.
  // Live Lovable never sets it, so production keeps the managed path untouched.
  const useBrevo = (process.env.EMAIL_PROVIDER ?? '').toLowerCase() === 'brevo'
  const apiKey = process.env.LOVABLE_API_KEY
  if (!useBrevo && !apiKey) {
    throw new Error('LOVABLE_API_KEY is not configured')
  }

  const template = TEMPLATES[templateName]
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`
    )
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to
  if (!recipient) {
    throw new Error('Recipient is required (the template defines no fixed recipient)')
  }

  const templateData = options.templateData ?? {}
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  if (useBrevo) {
    return await sendViaBrevo({ recipient, subject, html, text, templateName, replyTo: options.replyTo })
  }

  try {
    await sendLovableEmail(
      {
        to: recipient,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: 'transactional',
        label: templateName,
        idempotency_key: options.idempotencyKey || crypto.randomUUID(),
        reply_to: options.replyTo,
      },
      { apiKey: apiKey!, sendUrl: process.env.LOVABLE_SEND_URL }
    )
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') {
      return { sent: false, reason: 'recipient_suppressed' }
    }
    throw error
  }

  return { sent: true }
}

/**
 * Standby-only transport: Brevo's transactional API. Same contract and return
 * type as the managed path. The API key is read from the server env and is
 * never logged, returned, or sent to the browser.
 */
async function sendViaBrevo(args: {
  recipient: string
  subject: string
  html: string
  text: string
  templateName: string
  replyTo?: string
}): Promise<SendTemplateEmailResult> {
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    throw new Error('BREVO_API_KEY is not configured')
  }

  let response: Response
  try {
    response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': brevoKey,
      },
      body: JSON.stringify({
        sender: { name: SITE_NAME, email: `noreply@${FROM_DOMAIN}` },
        to: [{ email: args.recipient }],
        subject: args.subject,
        htmlContent: args.html,
        textContent: args.text,
        ...(args.replyTo ? { replyTo: { email: args.replyTo } } : {}),
        tags: [args.templateName],
      }),
    })
  } catch (error) {
    console.error('[brevo] network failure', {
      template: args.templateName,
      message: error instanceof Error ? error.message : String(error),
    })
    throw new Error('Email service unreachable. Please try again.')
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    // Brevo has no dedicated suppression error code; blocked recipients come
    // back as 400 invalid_parameter mentioning the blocked/unsubscribed contact.
    const suppressed =
      response.status === 400 && /blocked|unsubscrib|blacklist/i.test(body)
    console.error('[brevo] send failed', {
      template: args.templateName,
      status: response.status,
      body: body.slice(0, 500),
    })
    if (suppressed) return { sent: false, reason: 'recipient_suppressed' }
    throw new Error(`Email send failed (${response.status}).`)
  }

  return { sent: true }
}
