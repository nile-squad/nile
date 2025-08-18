/**
 * Returns an object containing only the properties (including nested) whose values are different or newly added in obj2 compared to obj1.
 * Uses deep-object-diff under the hood to compute changes.
 *
 * @template T - The type of the base object.
 * @template U - The type of the object to compare to.
 * @param {T} obj1 - The base object to compare from.
 * @param {U} obj2 - The object to compare to.
 * @returns {Partial<T & U>} An object containing only the changed or new properties from obj2, preserving nesting.
 *
 * @example
 * // returns { b: { y: 3 }, d: 6 }
 * getChanges({ a: 1, b: { x: 1, y: 2 } }, { a: 1, b: { x: 1, y: 3 }, d: 6 });
 */
import { diff } from 'deep-object-diff';

export const getChanges = <T extends object, U extends object>(
  obj1: T,
  obj2: U
): Partial<T & U> => {
  const result = diff(obj1, obj2);
  Object.keys(result).forEach((key) => {
    // If the value is an empty object, or undefined, remove it from the result
    const target = result[key as keyof typeof result];
    const isEmptyObject =
      typeof target === 'object' && !Object.keys(target).length;
    if (target === undefined || isEmptyObject) {
      delete result[key as keyof typeof result];
    }
  });
  return result as Partial<T & U>;
};
