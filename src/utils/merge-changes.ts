/**
 * Merges changes from incoming into existing using a deep merge strategy.
 * Preserves all fields from existing and applies only the changes from incoming.
 * For nested objects, recursively merges instead of replacing.
 *
 * @template T - The type of the base object.
 * @template U - The type of the object to merge from.
 * @param {T} existing - The base object (existing data from database).
 * @param {U} incoming - The object containing changes to apply (incoming update data).
 * @returns {{ diff: any[], result: T & U }} An object containing the diff operations and the merged result.
 *
 * @example
 * const existing = { a: 1, b: { x: 2, y: 3 } };
 * const incoming = { b: { y: 10 } };
 * const { diff, result } = mergeChanges(existing, incoming);
 * // result: { a: 1, b: { x: 2, y: 10 } }
 */
export function mergeChanges<T extends object, U extends object>(
  existing: T,
  incoming: U
): { diff: any[]; result: T & U } {
  const diff: any[] = [];

  // Deep clone existing to avoid mutations
  const result = JSON.parse(JSON.stringify(existing)) as any;

  // Recursively merge incoming into result
  function mergeObjects(
    target: any,
    source: any,
    path: (string | number)[] = []
  ): void {
    for (const key in source) {
      const targetValue = target[key];
      const sourceValue = source[key];

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // Both are objects, recursively merge
        mergeObjects(targetValue, sourceValue, [...path, key]);
      } else if (sourceValue !== undefined && targetValue !== sourceValue) {
        // Primitives, arrays, or new fields - only update if source has a value
        diff.push({
          op: target[key] === undefined ? 'add' : 'replace',
          path: [...path, key],
          value: sourceValue,
        });
        target[key] = sourceValue;
      }
    }
  }

  // Merge incoming into result
  mergeObjects(result, incoming);

  return {
    diff,
    result: result as T & U,
  };
}
