/**
 * Deeply merges properties from `source` into `target`.
 * - For each key in `source`, it will overwrite the value in `target`.
 * - If both values are plain objects, they are merged recursively.
 * - Arrays and primitive values are replaced directly.
 *
 * @template T - The type of the original object.
 * @template U - The type of the object to merge from.
 * @param {T} target - The base object (old/original values).
 * @param {U} source - The object containing new/updated values (patch).
 * @returns {T & U} A new object with merged values.
 *
 * @example
 * const original = { a: 1, b: { x: 2, y: 3 } };
 * const updates = { b: { y: 10 } };
 * const result = mergeTwoObjects(original, updates);
 * // result: { a: 1, b: { x: 2, y: 10 } }
 */
export const mergeTwoObjects = <T extends object, U extends object>(
  target: T,
  source: U
): T & U => {
  const result = { ...target } as any;

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key as unknown as keyof T];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = mergeTwoObjects(targetValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
};
