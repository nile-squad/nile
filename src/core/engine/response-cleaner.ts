import type { SafeResult } from '../../utils/safe-try';

/**
 * Cleans SafeResult by removing internal framework fields (isOk, isError)
 * and returning only public fields (status, message, data).
 *
 * Used by all interface layers before sending responses to clients.
 * This ensures that internal framework discriminators are never exposed.
 *
 * @param result - The SafeResult to clean
 * @returns Clean response with only public fields
 */
export function cleanResponse<T>(result: SafeResult<T>) {
  return {
    status: result.status,
    message: result.message,
    data: result.data,
  };
}
