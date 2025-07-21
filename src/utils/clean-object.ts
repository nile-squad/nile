/**
 * Cleans an object by removing or nullifying empty values.
 *
 * Empty values: null, undefined, empty string, empty object ({}), optionally empty arrays.
 *
 * @param obj - The object to clean
 * @param mode - 'remove' to remove empty values, 'nullify' to convert them to null
 * @returns A new cleaned object
 */
export const cleanObject = (
  obj: Record<string, unknown>,
  mode: 'remove' | 'nullify' = 'remove'
): Record<string, unknown> => {
  const isEmptyObject = (o: unknown): boolean =>
    typeof o === 'object' &&
    o !== null &&
    !Array.isArray(o) &&
    Object.keys(o as object).length === 0;

  const isEmpty = (val: unknown): boolean =>
    val === '' || val === null || val === undefined || isEmptyObject(val);

  const processValue = (
    value: unknown,
    _mode: 'remove' | 'nullify'
  ): unknown => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return processObject(value, _mode);
    }
    return isEmpty(value) ? (_mode === 'nullify' ? null : undefined) : value;
  };

  const processObject = (value: object, _mode: 'remove' | 'nullify') => {
    const nested = cleanObject(value as Record<string, unknown>, _mode);
    const hasKeys = Object.keys(nested).length > 0;
    if (_mode === 'remove') {
      return hasKeys ? nested : undefined;
    }

    return hasKeys ? nested : null;
  };

  const cleaned = Object.entries(obj).reduce(
    (acc: Record<string, unknown>, [key, value]) => {
      const processed = processValue(value, mode);
      if (processed !== undefined) {
        acc[key] = processed;
      }
      return acc;
    },
    {}
  );

  return cleaned;
};
