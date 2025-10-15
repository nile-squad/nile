import { isError } from '../../utils';
import { formatError } from '../../utils/erorr-formatter';
import type { WSErrorResponse, WSResponse } from './types';

export function createSuccessResponse<T>(
  message: string,
  data: T
): WSResponse<T> {
  return {
    status: true,
    message,
    data,
  };
}

export function createErrorResponse(
  message: string,
  error?: any
): WSErrorResponse {
  return {
    status: false,
    message,
    data: {
      error: error ? formatError(error) : undefined,
    },
  };
}

export function handleWSError(error: any): WSErrorResponse {
  // Check if it's already a properly formatted WSErrorResponse
  if (isError(error) && error.status === false && error.message && error.data) {
    return error as WSErrorResponse;
  }

  // Handle JavaScript Error objects
  if (error instanceof Error) {
    return createErrorResponse(error.message, error);
  }

  // Handle other objects with message property
  if (error?.message) {
    return createErrorResponse(error.message, error);
  }

  return createErrorResponse('Internal server error', error);
}
