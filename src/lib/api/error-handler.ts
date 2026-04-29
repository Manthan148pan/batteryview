/**
 * Centralized API error handling
 * Provides consistent error responses across all endpoints
 */

import { NextRequest, NextResponse } from 'next/server';

export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  BAD_REQUEST = 'BAD_REQUEST',
}

interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, any>;
  };
}

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Create a standardized error response
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  statusCode: number,
  details?: Record<string, any>
): NextResponse<ApiErrorResponse> {
  console.error(`[API Error] ${code}: ${message}`, details);

  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details && { details }),
      },
    },
    { status: statusCode }
  );
}

/**
 * Create a standardized success response
 */
export function apiSuccess<T>(
  data: T,
  statusCode: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status: statusCode }
  );
}

/**
 * Handle validation errors
 */
export function validationError(
  errors: Record<string, string[]>
): NextResponse<ApiErrorResponse> {
  return apiError(
    ApiErrorCode.VALIDATION_ERROR,
    'Validation failed',
    400,
    { errors }
  );
}

/**
 * Handle unauthorized errors
 */
export function unauthorizedError(
  message: string = 'Unauthorized'
): NextResponse<ApiErrorResponse> {
  return apiError(ApiErrorCode.UNAUTHORIZED, message, 401);
}

/**
 * Handle forbidden errors
 */
export function forbiddenError(
  message: string = 'Forbidden'
): NextResponse<ApiErrorResponse> {
  return apiError(ApiErrorCode.FORBIDDEN, message, 403);
}

/**
 * Handle not found errors
 */
export function notFoundError(
  message: string = 'Resource not found'
): NextResponse<ApiErrorResponse> {
  return apiError(ApiErrorCode.NOT_FOUND, message, 404);
}

/**
 * Handle conflict errors (duplicate resources, etc)
 */
export function conflictError(
  message: string = 'Resource conflict'
): NextResponse<ApiErrorResponse> {
  return apiError(ApiErrorCode.CONFLICT, message, 409);
}

/**
 * Handle rate limit errors
 */
export function rateLimitError(): NextResponse<ApiErrorResponse> {
  return apiError(
    ApiErrorCode.RATE_LIMITED,
    'Too many requests, please try again later',
    429
  );
}

/**
 * Handle internal server errors
 */
export function internalError(
  message: string = 'Internal server error',
  details?: Record<string, any>
): NextResponse<ApiErrorResponse> {
  return apiError(ApiErrorCode.INTERNAL_ERROR, message, 500, details);
}

/**
 * Wrapper to catch and handle unexpected errors
 */
export async function withErrorHandling(
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<(req: NextRequest) => Promise<NextResponse>> {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (error) {
      console.error('[API Unhandled Error]', error);
      return internalError(
        'An unexpected error occurred',
        error instanceof Error ? { message: error.message } : {}
      );
    }
  };
}
