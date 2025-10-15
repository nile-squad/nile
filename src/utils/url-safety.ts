/**
 * Sanitizes a string for use in URLs
 * - Trims whitespace
 * - Replaces spaces with hyphens
 * - Removes special characters except alphanumeric and hyphens
 * - Preserves casing
 * - Removes leading/trailing hyphens
 */
export const sanitizeForUrlSafety = (s: string) => {
  return s
    .trim()
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/[^a-zA-Z0-9-]/g, '-') // remove special characters except hyphens, preserve casing
    .replace(/-+/g, '-') // replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // remove hyphens from start and end
};
