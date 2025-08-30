import { createLogger } from '../logging';
import { isError, safeError, type SafeResult } from './safe-try';

type checkOptions = {
  target: string;
  message: string;
  atFunction: string;
};

const logger = createLogger('nile-utils');

export const checkIfEmptyOrErrors = (
  result: SafeResult<any>,
  options: checkOptions
) => {
  const target = options.target || 'Unknown';
  const message = options.message || 'Operation failed!';
  const atFunction = options.atFunction;
  const notFoundMessage = `${target} not found!`;

  if (isError(result)) {
    const error_id = logger.error({
      message,
      data: result,
      atFunction,
    });
    return safeError(message, error_id);
  }

  if (!result.data) {
    const error_id = logger.error({
      message: notFoundMessage,
      data: result,
      atFunction,
    });
    return safeError(notFoundMessage, error_id);
  }
  return null;
};
