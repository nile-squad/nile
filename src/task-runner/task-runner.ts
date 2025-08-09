import { Cron } from 'croner';
import { formatISO } from 'date-fns';
import { nanoid } from 'nanoid';
import { createLog } from '../logging';
import { getPreset, isValidPreset } from './presets';
import { createPubSub } from './pubsub';
import { createTaskStorage } from './storage';
import {
  convertAfterToAt,
  parseAtWithTimezone,
  parseDuration,
  validateTimezone,
} from './time-utils';
import type {
  PubSubCallback,
  TaskConfig,
  TaskExecution,
  TaskRecord,
  TaskRunnerConfig,
  TaskStatus,
} from './types';

/**
 * Creates a comprehensive task runner for scheduling and event-driven tasks.
 * Supports cron expressions, preset schedules, one-time tasks, event triggers,
 * retry policies, rate limiting, and more.
 *
 * @param config - Configuration options for the task runner
 * @param config.dbPath - Path to SQLite database file (defaults to in-memory)
 * @param config.timezone - Default timezone for tasks (defaults to 'UTC')
 * @returns Task runner instance with methods for task management
 *
 * @example
 * ```typescript
 * const taskRunner = useTaskRunner({
 *   dbPath: './tasks.db',
 *   timezone: 'America/New_York'
 * });
 *
 * // Create a scheduled task
 * taskRunner.createTask({
 *   id: 'daily-cleanup',
 *   type: 'schedule',
 *   preset: '@daily',
 *   handler: async () => {
 *     console.log('Running daily cleanup...');
 *   }
 * });
 *
 * // Create an event-driven task
 * taskRunner.createTask({
 *   id: 'user-welcome',
 *   type: 'event',
 *   onEvent: 'user:registered',
 *   handler: async () => {
 *     console.log('Sending welcome email...');
 *   }
 * });
 * ```
 */
export function useTaskRunner({
  dbPath = ':memory:',
  timezone = 'UTC',
}: TaskRunnerConfig = {}) {
  const storage = createTaskStorage(dbPath);
  const pubsub = createPubSub();
  const scheduledJobs = new Map<string, Cron>();
  const timeouts = new Map<string, NodeJS.Timeout>();
  const runningTasks = new Set<string>();

  const logEvent = (
    message: string,
    data?: any,
    type: 'info' | 'warn' | 'error' = 'info'
  ) => {
    createLog({
      appName: 'task-runner',
      atFunction: 'useTaskRunner',
      message,
      data,
      type,
    });
  };

  const validateTaskConfig = (config: TaskConfig) => {
    if (!config.id) {
      throw new Error('Task ID is required');
    }

    if (!config.handler || typeof config.handler !== 'function') {
      throw new Error('Task handler is required and must be a function');
    }

    if (
      config.type === 'schedule' &&
      !config.preset &&
      !config.cron &&
      !config.at &&
      !config.after
    ) {
      throw new Error(
        'Schedule tasks require one of: preset, cron, at, or after'
      );
    }

    if (config.type === 'event' && !config.onEvent) {
      throw new Error('Event tasks require onEvent to be specified');
    }

    // Validate timezone if provided
    if (config.timezone && !validateTimezone(config.timezone)) {
      throw new Error(`Invalid timezone: ${config.timezone}`);
    }

    const existing = storage.tasks.getById(config.id);
    if (existing) {
      throw new Error(`Task with ID ${config.id} already exists`);
    }
  };

  const calculateScheduleParameters = (config: TaskConfig) => {
    let cronExpression: string | undefined;
    let atTime: string | undefined;
    let nextRunAt: string | undefined;
    let effectiveTimezone: string | undefined;

    if (config.type === 'schedule') {
      // Use provided timezone or default
      effectiveTimezone = config.timezone || timezone;

      if (config.preset) {
        if (!isValidPreset(config.preset)) {
          throw new Error(`Invalid preset: ${config.preset}`);
        }
        const preset = getPreset(config.preset);
        cronExpression = preset?.cron;
      } else if (config.cron) {
        cronExpression = config.cron;
      } else if (config.after) {
        // After is relative to "now" - convert to absolute timestamp
        atTime = convertAfterToAt(config.after);
        nextRunAt = atTime;
      } else if (config.at) {
        // Parse absolute time with timezone info
        const parsed = parseAtWithTimezone(
          config.at,
          config.timezone || timezone
        );
        atTime = config.at;
        nextRunAt = parsed.utcTimestamp;
        effectiveTimezone = parsed.timezone;
      }
    }

    return { cronExpression, atTime, nextRunAt, effectiveTimezone };
  };

  const createTask = (config: TaskConfig): string => {
    // Apply sensible defaults
    const taskConfig: TaskConfig = {
      isPaused: false,
      retryPolicy: { maxAttempts: 1 },
      ...config,
    };

    validateTaskConfig(taskConfig);
    const { cronExpression, atTime, nextRunAt, effectiveTimezone } =
      calculateScheduleParameters(taskConfig);

    const taskRecord: TaskRecord = {
      id: taskConfig.id,
      name: taskConfig.name,
      type: taskConfig.type,
      preset: taskConfig.preset,
      cron: cronExpression,
      at: atTime,
      timezone: effectiveTimezone,
      nextRunAt,
      lastRunAt: undefined,
      attempts: 0,
      maxAttempts: taskConfig.retryPolicy?.maxAttempts || 1,
      rateCount: 0,
      rateWindow: undefined,
      status: taskConfig.isPaused === true ? 'paused' : 'pending',
      isPaused: taskConfig.isPaused === true,
      metadata: taskConfig.metadata
        ? JSON.stringify(taskConfig.metadata)
        : undefined,
      createdAt: formatISO(new Date()),
      onEvent: taskConfig.onEvent,
    };

    storage.tasks.insert(taskRecord);

    if (taskConfig.type === 'schedule' && !taskConfig.isPaused) {
      scheduleTask(taskConfig.id, taskConfig);
    } else if (taskConfig.type === 'event') {
      subscribeTaskToEvent(taskConfig.id, taskConfig);
    }

    logEvent(`Task created: ${taskConfig.id}`, { type: taskConfig.type });
    return taskConfig.id;
  };

  const scheduleTask = (taskId: string, config: TaskConfig) => {
    const task = storage.tasks.getById(taskId);
    if (!task) {
      return;
    }

    if (task.cron) {
      // Use Croner with timezone support
      const cronOptions: any = {
        timezone: task.timezone || timezone,
        name: taskId,
      };

      const job = new Cron(task.cron, cronOptions, async () => {
        await executeTask(taskId, config);
      });

      scheduledJobs.set(taskId, job);
    } else if (config.at || config.after) {
      const targetTime = config.after
        ? convertAfterToAt(config.after)
        : task.nextRunAt || config.at;

      if (!targetTime) {
        throw new Error('Invalid target time for scheduled task');
      }
      const delay = new Date(targetTime).getTime() - Date.now();

      if (delay > 0) {
        const timeout = setTimeout(async () => {
          await executeTask(taskId, config);
          timeouts.delete(taskId);
        }, delay);

        timeouts.set(taskId, timeout);
      }
    }
  };

  const subscribeTaskToEvent = (taskId: string, config: TaskConfig) => {
    if (!config.onEvent) {
      return;
    }

    pubsub.subscribe(config.onEvent, async (event: string, data?: any) => {
      await executeTask(taskId, config, { event, data });
    });
  };

  const executeTask = async (
    taskId: string,
    config: TaskConfig,
    eventData?: any
  ) => {
    const task = storage.tasks.getById(taskId);
    if (!task || task.isPaused || runningTasks.has(taskId)) {
      return;
    }

    if (shouldRateLimit(taskId, config)) {
      logEvent(`Task rate limited: ${taskId}`);
      return;
    }

    const executionId = nanoid();
    const execution: TaskExecution = {
      id: executionId,
      taskId,
      status: 'running',
      startedAt: formatISO(new Date()),
      attempt: task.attempts + 1,
    };

    try {
      runningTasks.add(taskId);
      storage.executions.insert(execution);
      storage.tasks.update(taskId, {
        status: 'running',
        attempts: task.attempts + 1,
      });

      logEvent(`Task started: ${taskId}`, { attempt: execution.attempt });

      // Pass event context for event-driven tasks, otherwise call with no parameters
      if (eventData && eventData.event) {
        await config.handler(eventData.event, eventData.data);
      } else {
        await config.handler();
      }

      const completedAt = formatISO(new Date());
      storage.executions.update(executionId, {
        status: 'success',
        completedAt,
      });

      storage.tasks.update(taskId, {
        status: 'pending',
        lastRunAt: completedAt,
        attempts: 0,
      });

      logEvent(`Task completed: ${taskId}`);

      if (config.type === 'schedule' && (config.at || config.after)) {
        await deleteTask(taskId);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const completedAt = formatISO(new Date());

      storage.executions.update(executionId, {
        status: 'failed',
        completedAt,
        error: errorMessage,
      });

      logEvent(
        `Task failed: ${taskId}`,
        { error: errorMessage, attempt: execution.attempt },
        'error'
      );

      if (task.attempts < task.maxAttempts) {
        scheduleRetry(taskId, config, task.attempts + 1);
      } else {
        storage.tasks.update(taskId, { status: 'pending' });
        logEvent(
          `Task exhausted retries: ${taskId}`,
          { maxAttempts: task.maxAttempts },
          'error'
        );
      }
    } finally {
      runningTasks.delete(taskId);
    }
  };

  const scheduleRetry = (
    taskId: string,
    config: TaskConfig,
    attempt: number
  ) => {
    if (!config.retryPolicy) {
      return;
    }

    const delay = config.retryPolicy.delay
      ? parseDuration(config.retryPolicy.delay)
      : 0;
    const actualDelay =
      config.retryPolicy.backoff === 'exponential'
        ? delay * 2 ** (attempt - 1)
        : delay;

    // Check if we're within maxRetryDuration
    if (config.retryPolicy.maxRetryDuration) {
      const task = storage.tasks.getById(taskId);
      if (task) {
        const taskStartTime = new Date(task.createdAt).getTime();
        const maxRetryMs = parseDuration(config.retryPolicy.maxRetryDuration);
        const elapsedTime = Date.now() - taskStartTime;

        if (elapsedTime + actualDelay > maxRetryMs) {
          logEvent(
            `Task retry window exceeded: ${taskId}`,
            { maxRetryDuration: config.retryPolicy.maxRetryDuration },
            'warn'
          );
          storage.tasks.update(taskId, { status: 'pending' });
          return;
        }
      }
    }

    setTimeout(async () => {
      await executeTask(taskId, config);
    }, actualDelay);

    logEvent(`Task retry scheduled: ${taskId}`, {
      attempt,
      delay: actualDelay,
    });
  };

  const shouldRateLimit = (taskId: string, config: TaskConfig): boolean => {
    if (!config.rateLimit) {
      return false;
    }

    const task = storage.tasks.getById(taskId);
    if (!task) {
      return false;
    }

    const now = new Date();
    const windowMs = parseDuration(config.rateLimit.interval);
    const strategy = config.rateLimit.strategy || 'fixed';

    if (strategy === 'sliding') {
      // For sliding window, we need to track individual execution times
      const executions = storage.executions.getByTaskId(taskId);
      const windowStart = now.getTime() - windowMs;
      const recentExecutions = executions.filter(
        (exec) => new Date(exec.startedAt).getTime() > windowStart
      );

      if (recentExecutions.length >= config.rateLimit.limit) {
        return true;
      }
    } else {
      // Fixed window strategy (existing logic)
      const windowStart = task.rateWindow ? new Date(task.rateWindow) : now;

      if (now.getTime() - windowStart.getTime() >= windowMs) {
        storage.tasks.update(taskId, {
          rateCount: 1,
          rateWindow: formatISO(now),
        });
        return false;
      }

      if (task.rateCount >= config.rateLimit.limit) {
        return true;
      }

      storage.tasks.update(taskId, {
        rateCount: task.rateCount + 1,
      });
    }

    return false;
  };

  const pauseTask = (taskId: string): boolean => {
    const task = storage.tasks.getById(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    storage.tasks.update(taskId, { isPaused: true, status: 'paused' });

    const job = scheduledJobs.get(taskId);
    if (job) {
      job.pause();
    }

    const timeout = timeouts.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      timeouts.delete(taskId);
    }

    logEvent(`Task paused: ${taskId}`);
    return true;
  };

  const resumeTask = (taskId: string): boolean => {
    const task = storage.tasks.getById(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    storage.tasks.update(taskId, { isPaused: false, status: 'pending' });

    const job = scheduledJobs.get(taskId);
    if (job) {
      job.resume();
    } else {
      // If no job exists, reschedule the task
      const config = {
        id: task.id,
        type: task.type,
        preset: task.preset,
        cron: task.cron,
        at: task.at,
        timezone: task.timezone,
        handler: () => {
          // Handler will be restored from the original config during scheduling
        },
      } as TaskConfig;

      if (task.type === 'schedule') {
        scheduleTask(taskId, config);
      }
    }

    logEvent(`Task resumed: ${taskId}`);
    return true;
  };

  const deleteTask = (taskId: string): boolean => {
    const task = storage.tasks.getById(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const job = scheduledJobs.get(taskId);
    if (job) {
      job.stop();
      scheduledJobs.delete(taskId);
    }

    const timeout = timeouts.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      timeouts.delete(taskId);
    }

    storage.tasks.delete(taskId);
    logEvent(`Task deleted: ${taskId}`);
    return true;
  };

  const getTask = (taskId: string): TaskRecord | undefined => {
    return storage.tasks.getById(taskId);
  };

  const getAllTasks = (): TaskRecord[] => {
    return storage.tasks.getAll();
  };

  const getTasksByStatus = (status: TaskStatus): TaskRecord[] => {
    return storage.tasks.getByStatus(status);
  };

  const getTaskExecutions = (taskId: string): TaskExecution[] => {
    return storage.executions.getByTaskId(taskId);
  };

  const getNextRunTime = (taskId: string): Date | null => {
    const job = scheduledJobs.get(taskId);
    if (job) {
      return job.nextRun();
    }

    const task = storage.tasks.getById(taskId);
    if (task?.nextRunAt) {
      return new Date(task.nextRunAt);
    }

    return null;
  };

  const getPreviousRunTime = (taskId: string): Date | null => {
    const job = scheduledJobs.get(taskId);
    if (job) {
      return job.previousRun();
    }

    const task = storage.tasks.getById(taskId);
    if (task?.lastRunAt) {
      return new Date(task.lastRunAt);
    }

    return null;
  };

  const publishEvent = async (event: string, data?: any): Promise<void> => {
    await pubsub.publish(event, data);
    logEvent(`Event published: ${event}`, { data });
  };

  const subscribeToEvent = (event: string, callback: PubSubCallback) => {
    return pubsub.subscribe(event, callback);
  };

  const unsubscribeFromEvent = (event: string, callback: PubSubCallback) => {
    pubsub.unsubscribe(event, callback);
  };

  const getStats = () => {
    const allTasks = storage.tasks.getAll();
    return {
      total: allTasks.length,
      pending: allTasks.filter((t) => t.status === 'pending').length,
      running: allTasks.filter((t) => t.status === 'running').length,
      paused: allTasks.filter((t) => t.status === 'paused').length,
      scheduledJobs: scheduledJobs.size,
      timeouts: timeouts.size,
      subscribers: pubsub.getSubscriberCount(),
    };
  };

  const shutdown = () => {
    for (const job of scheduledJobs.values()) {
      job.stop();
    }
    scheduledJobs.clear();

    for (const timeout of timeouts.values()) {
      clearTimeout(timeout);
    }
    timeouts.clear();

    storage.close();
    logEvent('Task runner shutdown');
  };

  logEvent('Task runner initialized');

  return {
    createTask,
    pauseTask,
    resumeTask,
    deleteTask,
    getTask,
    getAllTasks,
    getTasksByStatus,
    getTaskExecutions,
    getNextRunTime,
    getPreviousRunTime,
    publishEvent,
    subscribeToEvent,
    unsubscribeFromEvent,
    getStats,
    shutdown,
  };
}
