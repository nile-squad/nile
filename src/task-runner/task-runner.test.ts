import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createTaskRunner } from './task-runner';
import { createTaskStorage } from './storage';
import { parseDuration, convertAfterToAt, validateTimezone } from './time-utils';
import { getPreset, isValidPreset } from './presets';
import { createPubSub } from './pubsub';

describe('TaskRunner - Core Functionality', () => {
  let taskRunner: ReturnType<typeof createTaskRunner>;

  beforeEach(() => {
    taskRunner = createTaskRunner({ dbPath: ':memory:' });
  });

  afterEach(() => {
    taskRunner.shutdown();
  });

  it('should create a schedule task with preset', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-midnight',
      type: 'schedule',
      preset: '@midnight',
      handler: async () => {
        console.log('Midnight cleanup');
      }
    });

    expect(taskId).toBe('test-midnight');
    
    const task = taskRunner.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.type).toBe('schedule');
    expect(task?.preset).toBe('@midnight');
    expect(task?.status).toBe('pending');
  });

  it('should create an event-based task', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-event',
      type: 'event',
      onEvent: 'user:logged_in',
      handler: async () => {
        console.log('User logged in handler');
      }
    });

    expect(taskId).toBe('test-event');
    
    const task = taskRunner.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.type).toBe('event');
    expect(task?.onEvent).toBe('user:logged_in');
  });

  it('should create a one-off task with after delay', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-after',
      type: 'schedule',
      after: '5m',
      handler: async () => {
        console.log('Delayed task');
      }
    });

    const task = taskRunner.getTask(taskId);
    expect(task?.nextRunAt).toBeDefined();
  });

  it('should pause and resume tasks', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-pause',
      type: 'schedule',
      preset: '@hourly',
      handler: async () => {
        console.log('Hourly task');
      }
    });

    await taskRunner.pauseTask(taskId);
    let task = taskRunner.getTask(taskId);
    expect(task?.status).toBe('paused');
    expect(task?.isPaused).toBe(true);

    await taskRunner.resumeTask(taskId);
    task = taskRunner.getTask(taskId);
    expect(task?.status).toBe('pending');
    expect(task?.isPaused).toBe(false);
  });

  it('should delete tasks', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-delete',
      type: 'schedule',
      preset: '@daily',
      handler: async () => {
        console.log('Daily task');
      }
    });

    expect(taskRunner.getTask(taskId)).toBeDefined();
    
    await taskRunner.deleteTask(taskId);
    expect(taskRunner.getTask(taskId)).toBeUndefined();
  });

  it('should handle task validation errors', () => {
    expect(() => taskRunner.createTask({
      id: 'invalid-task',
      type: 'schedule',
      handler: async () => {}
    })).toThrow('Schedule tasks require one of: preset, cron, at, or after');

    expect(() => taskRunner.createTask({
      id: 'invalid-event',
      type: 'event',
      handler: async () => {}
    })).toThrow('Event tasks require onEvent to be specified');
  });

  it('should get task introspection methods', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-introspection',
      type: 'schedule',
      preset: '@daily',
      handler: async () => {
        console.log('Daily task for introspection');
      }
    });

    // Test introspection methods
    const nextRun = taskRunner.getNextRunTime(taskId);
    const prevRun = taskRunner.getPreviousRunTime(taskId);
    
    expect(nextRun).toBeDefined();
    expect(nextRun).toBeInstanceOf(Date);
    // Previous run might be null for new tasks
    expect(prevRun === null || prevRun instanceof Date).toBe(true);
  });

  it('should get task statistics', () => {
    const stats = taskRunner.getStats();
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('pending');
    expect(stats).toHaveProperty('running');
    expect(stats).toHaveProperty('paused');
    expect(typeof stats.total).toBe('number');
  });
});

describe('TaskRunner - PubSub System', () => {
  let taskRunner: ReturnType<typeof createTaskRunner>;

  beforeEach(() => {
    taskRunner = createTaskRunner({ dbPath: ':memory:' });
  });

  afterEach(() => {
    taskRunner.shutdown();
  });

  it('should publish and handle events', async () => {
    let eventReceived = false;
    let eventData: any = null;

    const unsubscribe = taskRunner.subscribeToEvent('test:event', (event, data) => {
      eventReceived = true;
      eventData = data;
    });

    await taskRunner.publishEvent('test:event', { userId: '123' });

    expect(eventReceived).toBe(true);
    expect(eventData).toEqual({ userId: '123' });

    unsubscribe();
  });
});

describe('Time Utils', () => {
  it('should parse duration strings correctly', () => {
    expect(parseDuration('5m')).toBe(5 * 60 * 1000);
    expect(parseDuration('1h')).toBe(60 * 60 * 1000);
    expect(parseDuration('30s')).toBe(30 * 1000);
    expect(parseDuration('2d')).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it('should convert after to at timestamp', () => {
    const result = convertAfterToAt('30s');
    
    expect(typeof result).toBe('string');
    const resultTime = new Date(result).getTime();
    const now = Date.now();
    
    // Should be in the future (allow for execution time)
    expect(resultTime).toBeGreaterThanOrEqual(now);
    // Should be within a reasonable range
    expect(resultTime).toBeLessThan(now + 60 * 1000);
  });

  it('should throw error for invalid duration format', () => {
    expect(() => parseDuration('invalid')).toThrow('Invalid duration format');
    expect(() => parseDuration('5x')).toThrow('Invalid duration format');
  });

  it('should validate IANA timezones correctly', () => {
    expect(validateTimezone('America/New_York')).toBe(true);
    expect(validateTimezone('Europe/London')).toBe(true);
    expect(validateTimezone('UTC')).toBe(true);
    expect(validateTimezone('Invalid/Timezone')).toBe(false);
    expect(validateTimezone('NotATimezone')).toBe(false);
  });
});

describe('Presets', () => {
  it('should validate preset names', () => {
    expect(isValidPreset('@midnight')).toBe(true);
    expect(isValidPreset('@daily')).toBe(true);
    expect(isValidPreset('@hourly')).toBe(true);
    expect(isValidPreset('@invalid')).toBe(false);
  });

  it('should get preset definitions', () => {
    const midnight = getPreset('@midnight');
    expect(midnight).toBeDefined();
    expect(midnight?.cron).toBe('0 0 * * *');
    expect(midnight?.description).toContain('midnight');
  });
});

describe('Storage', () => {
  let storage: ReturnType<typeof createTaskStorage>;

  beforeEach(() => {
    storage = createTaskStorage(':memory:');
  });

  afterEach(() => {
    storage.close();
  });

  it('should insert and retrieve tasks', () => {
    const task = {
      id: 'test-storage',
      type: 'schedule' as const,
      status: 'pending' as const,
      attempts: 0,
      maxAttempts: 3,
      rateCount: 0,
      isPaused: false,
      createdAt: new Date().toISOString()
    };

    storage.tasks.insert(task);
    const retrieved = storage.tasks.getById('test-storage');
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('test-storage');
    expect(retrieved?.type).toBe('schedule');
  });

  it('should filter tasks by status', () => {
    const task1 = {
      id: 'pending-task',
      type: 'schedule' as const,
      status: 'pending' as const,
      attempts: 0,
      maxAttempts: 1,
      rateCount: 0,
      isPaused: false,
      createdAt: new Date().toISOString()
    };

    const task2 = {
      id: 'paused-task',
      type: 'schedule' as const,
      status: 'paused' as const,
      attempts: 0,
      maxAttempts: 1,
      rateCount: 0,
      isPaused: true,
      createdAt: new Date().toISOString()
    };

    storage.tasks.insert(task1);
    storage.tasks.insert(task2);

    const pendingTasks = storage.tasks.getByStatus('pending');
    const pausedTasks = storage.tasks.getByStatus('paused');

    expect(pendingTasks).toHaveLength(1);
    expect(pausedTasks).toHaveLength(1);
    expect(pendingTasks[0].id).toBe('pending-task');
    expect(pausedTasks[0].id).toBe('paused-task');
  });
});

describe('PubSub', () => {
  let pubsub: ReturnType<typeof createPubSub>;

  beforeEach(() => {
    pubsub = createPubSub();
  });

  it('should subscribe and publish to exact topics', async () => {
    let received = false;
    
    pubsub.subscribe('test:topic', () => {
      received = true;
    });

    await pubsub.publish('test:topic');
    expect(received).toBe(true);
  });

  it('should support wildcard subscriptions', async () => {
    let receivedEvents: string[] = [];
    
    pubsub.subscribe('user:*', (event) => {
      receivedEvents.push(event);
    });

    await pubsub.publish('user:login');
    await pubsub.publish('user:logout');
    await pubsub.publish('admin:login'); // Should not match

    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(receivedEvents).toEqual(['user:login', 'user:logout']);
  });

  it('should unsubscribe correctly', async () => {
    let callCount = 0;
    
    const callback = () => {
      callCount++;
    };

    pubsub.subscribe('test:topic', callback);
    await pubsub.publish('test:topic');
    expect(callCount).toBe(1);

    pubsub.unsubscribe('test:topic', callback);
    await pubsub.publish('test:topic');
    expect(callCount).toBe(1); // Should not increment
  });

  it('should return correct subscriber counts', () => {
    const callback = () => {};
    
    expect(pubsub.getSubscriberCount()).toBe(0);
    
    pubsub.subscribe('topic1', callback);
    expect(pubsub.getSubscriberCount()).toBe(1);
    expect(pubsub.getSubscriberCount('topic1')).toBe(1);
    
    pubsub.subscribe('topic2', callback);
    expect(pubsub.getSubscriberCount()).toBe(2);
    
    pubsub.unsubscribe('topic1', callback);
    expect(pubsub.getSubscriberCount()).toBe(1);
  });
});

describe('TaskRunner - Timezone Support', () => {
  let taskRunner: ReturnType<typeof createTaskRunner>;

  beforeEach(() => {
    taskRunner = createTaskRunner({ dbPath: ':memory:', timezone: 'America/New_York' });
  });

  afterEach(() => {
    taskRunner.shutdown();
  });

  it('should handle datetime strings with IANA timezone', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-iana-timezone',
      type: 'schedule',
      at: '2024-12-25T09:00:00',
      timezone: 'America/New_York',
      handler: async () => {
        console.log('Christmas task in EST');
      }
    });

    const task = taskRunner.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.at).toBe('2024-12-25T09:00:00');
    expect(task?.timezone).toBe('America/New_York');
    expect(task?.nextRunAt).toBeDefined();
  });

  it('should use default timezone when none specified', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-default-timezone',
      type: 'schedule',
      at: '2024-12-25T09:00:00',
      handler: async () => {
        console.log('Christmas task with default timezone');
      }
    });

    const task = taskRunner.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.timezone).toBe('America/New_York'); // The default from taskRunner config
  });

  it('should throw error for invalid timezone', async () => {
    expect(() => taskRunner.createTask({
      id: 'test-invalid-timezone',
      type: 'schedule',
      at: '2024-12-25T09:00:00',
      timezone: 'Invalid/Timezone',
      handler: async () => {
        console.log('This should fail');
      }
    })).toThrow('Invalid timezone: Invalid/Timezone');
  });

  it('should use specified timezone for presets', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-preset-timezone',
      type: 'schedule',
      preset: '@daily',
      timezone: 'Europe/London',
      handler: async () => {
        console.log('Daily task in London time');
      }
    });

    const task = taskRunner.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.preset).toBe('@daily');
    expect(task?.timezone).toBe('Europe/London');
    expect(task?.cron).toBe('0 0 * * *'); // Standard @daily cron
  });

  it('should use default timezone for presets when none specified', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-preset-default',
      type: 'schedule',
      preset: '@daily',
      handler: async () => {
        console.log('Daily task with default timezone');
      }
    });

    const task = taskRunner.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.preset).toBe('@daily');
    expect(task?.timezone).toBe('America/New_York'); // Default from config
    expect(task?.cron).toBe('0 0 * * *'); // Standard @daily cron
  });

  it('should store name field when provided', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-named-task',
      name: 'My Important Task',
      type: 'schedule',
      preset: '@daily',
      handler: async () => {
        console.log('Named task');
      }
    });

    const task = taskRunner.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.name).toBe('My Important Task');
  });

  it('should handle boolean defaults correctly', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-defaults',
      type: 'schedule',
      preset: '@daily',
      handler: async () => {
        console.log('Default task');
      }
    });

    const task = taskRunner.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.isPaused).toBe(false);
    expect(task?.status).toBe('pending');
    expect(task?.maxAttempts).toBe(1);
  });

  it('should handle explicit pause state', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-paused',
      type: 'schedule',
      preset: '@daily',
      isPaused: true,
      handler: async () => {
        console.log('Paused task');
      }
    });

    const task = taskRunner.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.isPaused).toBe(true);
    expect(task?.status).toBe('paused');
  });

  it('should handle retry policy with maxRetryDuration', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-retry-duration',
      type: 'schedule',
      preset: '@daily',
      retryPolicy: {
        maxAttempts: 5,
        delay: '1s',
        backoff: 'exponential',
        maxRetryDuration: '10m'
      },
      handler: async () => {
        throw new Error('Test error');
      }
    });

    const task = taskRunner.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.maxAttempts).toBe(5);
  });

  it('should handle rate limiting with different strategies', async () => {
    const taskId = await taskRunner.createTask({
      id: 'test-rate-limit',
      type: 'event',
      onEvent: 'test:event',
      rateLimit: {
        interval: '1m',
        limit: 5,
        strategy: 'sliding'
      },
      handler: async () => {
        console.log('Rate limited task');
      }
    });

    const task = taskRunner.getTask(taskId);
    expect(task).toBeDefined();
  });
});