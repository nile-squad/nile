/**
 * Deeply merges properties from `source` into `target` without shallow copying.
 * - Creates a completely new object with all fields from target preserved
 * - For each key in `source`, it will overwrite or merge the value in `target`
 * - If both values are plain objects, they are merged recursively
 * - Arrays and primitive values are replaced directly
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
// Inline implementation to avoid module issues
function deepMerge<T extends object, U extends object>(
  target: T,
  source: U
): T & U {
  const result: any = {};

  // First, deep copy all fields from target (preserving nested objects)
  for (const key in target) {
    const value = (target as any)[key];
    if (Array.isArray(value)) {
      result[key] = [...value];
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = deepMerge(value, {} as any);
    } else {
      result[key] = value;
    }
  }

  // Then merge/overwrite with source values
  for (const key in source) {
    const sourceValue = (source as any)[key];
    const targetValue = result[key];

    // If both are objects, deep merge
    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      // Deep merge nested objects - recursively merge
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      // Replace primitive, array, or new fields
      result[key] = sourceValue;
    }
  }

  return result as T & U;
}

export const mergeTwoObjects = deepMerge;
