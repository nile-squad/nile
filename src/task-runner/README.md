# Task Runner Module

A comprehensive task scheduling and execution system for the Nile package, built following established conventions.

## Features

- **Event-based and schedule-based tasks** - Support for both cron-style schedules and event-driven execution
- **Human-friendly presets** - Built-in presets like `@midnight`, `@daily`, `@hourly`, etc.
- **One-off scheduling** - Execute tasks after a delay or at a specific time
- **Timezone support** - Full timezone normalization and conversion using date-fns
- **Retry policies** - Configurable retry mechanisms with exponential or fixed backoff
- **Rate limiting** - Control execution frequency for high-volume tasks
- **Runtime controls** - Pause, resume, and delete tasks at runtime
- **Pub/Sub system** - Event publishing and subscription with wildcard support
- **SQLite persistence** - Task state and execution history stored in SQLite
- **Comprehensive logging** - Full audit trail using the existing Nile logging system

## Usage

```typescript
import { useTaskRunner } from '@nile-squad/nile/task-runner';

// Initialize task runner
const taskRunner = useTaskRunner({
  dbPath: './tasks.db',
  timezone: 'UTC'
});

// Create a scheduled task
await taskRunner.createTask({
  id: 'daily-cleanup',
  type: 'schedule',
  preset: '@midnight',
  handler: async () => {
    console.log('Running daily cleanup...');
  },
  retryPolicy: {
    maxAttempts: 3,
    delay: '1m',
    backoff: 'exponential'
  }
});

// Create an event-based task
await taskRunner.createTask({
  id: 'user-welcome',
  type: 'event',
  onEvent: 'user:registered',
  handler: async () => {
    console.log('Sending welcome email...');
  },
  rateLimit: {
    interval: '1m',
    limit: 5
  }
});

// Publish an event
await taskRunner.publishEvent('user:registered', { userId: '123' });

// Runtime controls
await taskRunner.pauseTask('daily-cleanup');
await taskRunner.resumeTask('daily-cleanup');
await taskRunner.deleteTask('daily-cleanup');

// Get statistics
const stats = taskRunner.getStats();
console.log(stats);

// Cleanup
taskRunner.shutdown();
```

## Architecture

The task runner follows Nile's facade pattern and functional design principles:

- **useTaskRunner**: Main facade function returning an object with all operations
- **SQLite storage**: Persistent task storage with proper indexing
- **Pub/Sub system**: Event handling with wildcard pattern matching
- **Time utilities**: Duration parsing and timezone handling with date-fns
- **Error handling**: Consistent error reporting using Nile's logging system

## Database Schema

Tasks are stored in SQLite with the following structure:

- `tasks` table: Task definitions, state, and metadata
- `task_executions` table: Execution history and audit trail
- Proper indexes for performance
- Foreign key constraints for data integrity

## Testing

Comprehensive test suite covering:

- Core functionality (create, pause, resume, delete)
- Event publishing and subscription
- Time utilities and duration parsing
- Storage operations
- Pub/Sub pattern matching
- Error handling scenarios

All tests follow Vitest patterns used throughout the Nile package.

## Integration

The task runner is exported from the main Nile package:

```typescript
import { taskRunner } from '@nile-squad/nile';
// or
import { useTaskRunner } from '@nile-squad/nile/task-runner';
```