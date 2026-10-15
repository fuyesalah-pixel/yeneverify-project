import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error';
import { ERROR_CODES, ErrorCode } from '../constants/error-codes';
import { errorResponse } from '../types/api-response.type';

/**
 * Global catch-all exception filter.
 * Converts every thrown error to the standard API error envelope:
 *   { success: false, error: { code, message, details }, meta: { requestId } }
 *
 * Priority:
 *   1. AppError (domain errors) → mapped directly
 *   2. HttpException (NestJS built-ins) → mapped by status
 *   3. PrismaClientKnownRequestError → mapped by Prisma error code
 *   4. Everything else → INTERNAL_ERROR (stack hidden in prod)
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { id?: string }>();
    const response = ctx.getResponse<Response>();
    const requestId = request.id ?? 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ERROR_CODES.INTERNAL_ERROR;
    let message = 'An unexpected error occurred.';
    let details: Record<string, unknown> | undefined;

    // ── 1. AppError ───────────────────────────────────────────────────
    if (exception instanceof AppError) {
      status = exception.httpStatus;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    }

    // ── 2. NestJS HttpException ────────────────────────────────────────
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'string' ? body : ((body as { message?: string }).message ?? message);
      code = httpStatusToCode(status);
      if (
        typeof body === 'object' &&
        'message' in body &&
        Array.isArray((body as { message: unknown }).message)
      ) {
        details = { fields: (body as { message: unknown[] }).message };
      }
    }

    // ── 3. Prisma known errors ─────────────────────────────────────────
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = mapPrismaError(exception);
      status = mapped.status;
      code = mapped.code;
      message = mapped.message;
    }

    // ── 4. Unknown ─────────────────────────────────────────────────────
    else {
      this.logger.error({ err: exception, requestId }, 'Unhandled exception — please investigate');
      // Never leak internal details in production
    }

    response.status(status).json(errorResponse(code, message, requestId, details));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function httpStatusToCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ERROR_CODES.VALIDATION_FAILED;
    case 401:
      return ERROR_CODES.UNAUTHORIZED;
    case 403:
      return ERROR_CODES.FORBIDDEN;
    case 404:
      return ERROR_CODES.NOT_FOUND;
    case 409:
      return ERROR_CODES.CONFLICT;
    case 429:
      return ERROR_CODES.RATE_LIMITED;
    case 503:
      return ERROR_CODES.SERVICE_UNAVAILABLE;
    default:
      return ERROR_CODES.INTERNAL_ERROR;
  }
}

function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
  status: number;
  code: ErrorCode;
  message: string;
} {
  switch (err.code) {
    case 'P2002': // Unique constraint
      return {
        status: 409,
        code: ERROR_CODES.CONFLICT,
        message: 'A record with this value already exists.',
      };
    case 'P2025': // Record not found
      return {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: 'The requested record was not found.',
      };
    case 'P2003': // FK constraint
      return {
        status: 400,
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Related record not found.',
      };
    default:
      return {
        status: 500,
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'A database error occurred.',
      };
  }
}
