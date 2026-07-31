import { redactPII } from "./redact";

/**
 * Converts an internal failure into a client-safe error.
 *
 * Raw backend errors carry table names, column names, constraint identifiers,
 * and sometimes fragments of the offending row. None of that may reach the
 * browser: the client gets a generic sentence plus a correlation id, while the
 * redacted detail goes to the server log under the same id.
 */
export function internalError(detail: unknown, publicMessage = "Something went wrong. Please try again."): Error {
  const correlationId = crypto.randomUUID();
  console.error(`[${correlationId}]`, redactPII(detail));
  return new Error(`${publicMessage} (ref: ${correlationId})`);
}
