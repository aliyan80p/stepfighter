/**
 * Strips personal data from anything we are about to write to a log.
 *
 * Error objects bubbling out of route loaders, SSR, and server functions can
 * carry submitted form values (email addresses), one-time codes, or bearer
 * tokens in their message or stack. Logs are retained by the hosting platform,
 * so nothing identifying may reach them.
 */

const PATTERNS: Array<[RegExp, string]> = [
  // Email addresses
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]"],
  // Bearer tokens / JWTs / opaque Supabase keys
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]"],
  [/\beyJ[A-Za-z0-9._-]{10,}/g, "[REDACTED_TOKEN]"],
  [/\bsb_(publishable|secret)_[A-Za-z0-9_-]+/g, "[REDACTED_KEY]"],
  // Connection strings
  [/\b(postgres(?:ql)?|mongodb(?:\+srv)?):\/\/[^\s"']+/gi, "[REDACTED_DSN]"],
  // Standalone 6-digit one-time codes
  [/\b\d{6}\b/g, "[REDACTED_CODE]"],
  // Anything that looks like an explicit credential assignment
  [/\b(password|passwd|secret|token|api[_-]?key)\b(\s*[:=]\s*)\S+/gi, "$1$2[REDACTED]"],
];

export function redactPII(input: unknown): string {
  let text: string;
  if (input instanceof Error) {
    text = `${input.name}: ${input.message}\n${input.stack ?? ""}`;
  } else if (typeof input === "string") {
    text = input;
  } else {
    try {
      text = JSON.stringify(input);
    } catch {
      text = String(input);
    }
  }
  for (const [pattern, replacement] of PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}
