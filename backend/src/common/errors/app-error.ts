import type { ErrorCode } from '../constants/error-codes';

/**
 * Base error class for all application-level errors.
 * Throw this (or a subclass from domain-errors.ts) in services.
 * AllExceptionsFilter catches it and converts to the API error envelope.
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly httpStatus: number = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
