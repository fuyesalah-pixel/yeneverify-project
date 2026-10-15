export interface SafeErrorBody {
  success: false;
  error: {
    code: 'INTERNAL_ERROR';
    message: string;
  };
  meta?: { requestId: string };
}

/**
 * Convert an arbitrary thrown value into the public error envelope.
 * Raw exception messages, database errors, provider responses, and stacks
 * are intentionally discarded rather than merely redacted.
 */
export function toSafeError(error: unknown, requestId?: string): SafeErrorBody {
  // Explicitly discard the value. Reading or logging it here would create a
  // second path by which a secret could leave the process.
  void error;

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Our team has been notified.',
    },
    ...(requestId ? { meta: { requestId } } : {}),
  };
}
