import type { Preset } from './types';

/**
 * Default scheduling presets for common time intervals.
 * These provide convenient aliases for commonly used cron expressions.
 */
export const defaultPresets: Preset[] = [
  {
    name: '@midnight',
    description: 'Every day at midnight (00:00)',
    cron: '0 0 * * *',
  },
  {
    name: '@daily',
    description: 'Every day at midnight (00:00)',
    cron: '0 0 * * *',
  },
  {
    name: '@hourly',
    description: 'Every hour at minute 0',
    cron: '0 * * * *',
  },
  {
    name: '@weekly',
    description: 'Every Sunday at midnight',
    cron: '0 0 * * 0',
  },
  {
    name: '@monthly',
    description: 'First day of every month at midnight',
    cron: '0 0 1 * *',
  },
  {
    name: '@yearly',
    description: 'January 1st at midnight',
    cron: '0 0 1 1 *',
  },
];

/**
 * Retrieves a preset configuration by name.
 * @param name - The preset name (e.g., '@daily', '@hourly', '@weekly')
 * @returns The preset configuration if found, undefined otherwise
 * @example
 * ```typescript
 * const dailyPreset = getPreset('@daily');
 * console.log(dailyPreset?.cron); // '0 0 * * *'
 * ```
 */
export function getPreset(name: string): Preset | undefined {
  return defaultPresets.find((preset) => preset.name === name);
}

/**
 * Checks if a preset name is valid and exists in the default presets.
 * @param name - The preset name to validate
 * @returns True if the preset exists, false otherwise
 * @example
 * ```typescript
 * if (isValidPreset('@daily')) {
 *   // Preset exists and can be used
 * }
 * ```
 */
export function isValidPreset(name: string): boolean {
  return defaultPresets.some((preset) => preset.name === name);
}
