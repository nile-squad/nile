import { isBefore, parseISO } from 'date-fns';
import type { DurationString } from './types';

const DURATION_REGEX = /^(\d+)\s*(ms|s|m|h|d)$/i;
const TIMEZONE_OFFSET_REGEX = /[+-]\d{2}:\d{2}$/;

/**
 * Parses a duration string and returns the equivalent milliseconds.
 * @param duration - Duration string (e.g., "5m", "1h", "30s")
 * @example
 * parseDuration('5m') // 300000 (5 minutes in ms)
 * parseDuration('1h') // 3600000 (1 hour in ms)
 * parseDuration('30s') // 30000 (30 seconds in ms)
 * ```
 */
export const parseDuration = (duration: DurationString): number => {
  const match = duration.trim().match(DURATION_REGEX);

  if (!match) {
    throw new Error(
      `Invalid duration format: ${duration}. Expected format: "5m", "1h", "30s", etc.`
    );
  }

  const value = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const unitMultipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * unitMultipliers[unit as keyof typeof unitMultipliers];
};

/**
 * Adds a duration to a date and returns a new date.
 * @param date - The base date to add duration to
 * @param duration - Duration string to add (e.g., "5m", "1h", "2d")
 * @returns New date with the duration added
 * @example
 * ```typescript
 * const now = new Date();
 * const future = addDuration(now, '1h'); // 1 hour from now
 * ```
 */
export const addDuration = (date: Date, duration: DurationString): Date => {
  const ms = parseDuration(duration);
  return new Date(date.getTime() + ms);
};

/**
 * Converts a relative duration to an absolute ISO timestamp.
 * @param after - Duration string relative to now (e.g., "5m", "1h")
 * @returns ISO timestamp string representing the future time
 * @example
 * ```typescript
 * const futureTime = convertAfterToAt('30m'); // ISO string 30 minutes from now
 * ```
 */
export const convertAfterToAt = (after: DurationString): string => {
  const now = new Date();
  const futureDate = addDuration(now, after);
  return futureDate.toISOString();
};

/**
 * Checks if a given timestamp represents a time that has already passed or is now.
 * @param timestamp - ISO timestamp string to check
 * @returns True if the time has passed or is now, false if it's in the future
 * @example
 * ```typescript
 * const pastTime = '2023-01-01T00:00:00Z';
 * isTimeToRun(pastTime); // true (assuming current date is after 2023-01-01)
 * ```
 */
export const isTimeToRun = (timestamp: string): boolean => {
  const targetTime = parseISO(timestamp);
  const now = new Date();
  return isBefore(targetTime, now) || targetTime.getTime() === now.getTime();
};

export const validateTimezone = (timezone: string): boolean => {
  try {
    // Test if timezone is valid by creating a date with Intl.DateTimeFormat
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

export const parseAtWithTimezone = (
  atString: string,
  timezone?: string
): {
  utcTimestamp: string;
  timezone: string;
} => {
  // If timezone is provided, validate it
  if (timezone && !validateTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  // Parse the date string - always treat as UTC to avoid local timezone conversion
  let date: Date;
  try {
    // If the string doesn't have 'Z' or timezone info, add 'Z' to treat as UTC
    const isoString =
      atString.includes('Z') || TIMEZONE_OFFSET_REGEX.test(atString)
        ? atString
        : `${atString}Z`;
    date = parseISO(isoString);
  } catch {
    throw new Error(`Invalid date format: ${atString}`);
  }

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${atString}`);
  }

  // If no timezone provided, treat as UTC
  const effectiveTimezone = timezone || 'UTC';

  // For UTC, just return the parsed timestamp
  if (effectiveTimezone === 'UTC') {
    return {
      utcTimestamp: date.toISOString(),
      timezone: effectiveTimezone,
    };
  }

  // For other timezones, we need to handle them with Croner
  // For now, we'll return the UTC timestamp and let Croner handle timezone conversion
  return {
    utcTimestamp: date.toISOString(),
    timezone: effectiveTimezone,
  };
};
