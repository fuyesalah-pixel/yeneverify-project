// Standard API response envelopes — from MASTER_CONTEXT.md §8

export interface ResponseMeta {
  requestId: string;
  page?: number;
  pageSize?: number;
  total?: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ResponseMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: Pick<ResponseMeta, 'requestId'>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Helper to build a success response object (used in interceptor) */
export function successResponse<T>(data: T, meta: ResponseMeta): ApiSuccess<T> {
  return { success: true, data, meta };
}

/** Helper to build an error response object (used in filter) */
export function errorResponse(
  code: string,
  message: string,
  requestId: string,
  details?: Record<string, unknown>,
): ApiError {
  return {
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
    meta: { requestId },
  };
}
