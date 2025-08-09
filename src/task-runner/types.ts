export type DurationString = string;
export type ISODate = string;

export interface RetryPolicy {
  maxAttempts: number;
  delay?: DurationString;
  backoff?: 'exponential' | 'fixed';
  maxRetryDuration?: DurationString;
}

export interface RateLimit {
  interval: DurationString;
  limit: number;
  strategy?: 'sliding' | 'fixed';
}

export interface Preset {
  name: string;
  description: string;
  cron: string;
}

export interface TaskConfig {
  id: string;
  name?: string;
  type: 'schedule' | 'event';

  // Schedule options
  preset?: string; // e.g. "@midnight", "@hourly", "@weekly"
  cron?: string; // custom cron expression
  at?: string; // ISO timestamp: "2024-12-25T09:00:00"
  after?: DurationString; // e.g. "5m", "1d" (relative to now)
  timezone?: string; // IANA timezone name: "America/New_York", "Europe/London"

  // Event trigger
  onEvent?: string; // e.g. "user:logged_in"

  // Handler function - supports both scheduled and event-driven signatures
  handler: ((event?: string, data?: any) => Promise<void> | void) | (() => Promise<void> | void);

  // Retry and rate limiting
  retryPolicy?: RetryPolicy;
  rateLimit?: RateLimit;

  // Runtime control
  isPaused?: boolean;
  metadata?: Record<string, any>;
}

export interface TaskRecord {
  id: string;
  name?: string;
  type: 'event' | 'schedule';
  preset?: string;
  cron?: string;
  at?: string; // Store original datetime string
  timezone?: string; // IANA timezone name
  nextRunAt?: string; // UTC timestamp for scheduling
  lastRunAt?: string;
  attempts: number;
  maxAttempts: number;
  rateCount: number;
  rateWindow?: string;
  status: 'pending' | 'running' | 'paused';
  isPaused: boolean;
  metadata?: string;
  createdAt: string;
  onEvent?: string;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  status: 'success' | 'failed' | 'running';
  startedAt: string;
  completedAt?: string;
  error?: string;
  attempt: number;
}

export type TaskStatus = 'pending' | 'running' | 'paused';

export type PubSubCallback = (
  event: string,
  data?: any
) => void | Promise<void>;

export interface TaskRunnerConfig {
  dbPath?: string;
  timezone?: string; // Default timezone for tasks, defaults to 'UTC'
}
