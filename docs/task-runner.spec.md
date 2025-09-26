# Task Runner Specification

A config-driven, SQLite-backed **task runner** that supports:

- Event-based and schedule-based task triggers
- Human-friendly **presets** (e.g. `@midnight`, `@hourly`, `@weekly`)
- One-off scheduling via delay (`in 5m`, `in 1 day`) or exact time
- **IANA timezone-aware execution** using timezone names (e.g. `America/New_York`)
- Retry policies and rate limiting with multiple strategies
- Full runtime visibility (pending, running, paused)
- Dynamic pausing/resuming/deletion at runtime
- Publish-subscribe system for reacting to events with wildcard support
- Comprehensive logging and monitoring
- Task execution audit trail

---

## 📌 Concepts

### 🔁 Task Types

| Type     | Description                   | Repeats? |
| -------- | ----------------------------- | -------- |
| `preset` | Named cron-based schedule     | ✅        |
| `cron`   | Custom cron expression        | ✅        |
| `after`  | Human delay from "now"        | ❌        |
| `at`     | Specific timestamp with timezone | ❌        |
| `event`  | Custom runtime event triggers | ❌ / ✅    |

### 💡 Usage Examples

- `@midnight` → Clean up user cache every day at midnight (user's timezone)
- `@hourly` → Run health checks every hour
- `@weekly` → Generate weekly reports every Sunday
- `in 30 minutes` → Send OTP reminder once  
- `at: "2025-09-01T15:00:00", timezone: "America/New_York"` → Email report at specific time
- `user:logged_in` → Trigger analytics event  
- `cron: '0 0 * * 1'` → Every Monday at midnight (user's timezone)

---

## 🧩 Task Definition

```ts
interface RetryPolicy {
  maxAttempts: number         // e.g. 3
  delay?: DurationString      // e.g. "30s", default immediate retry
  backoff?: 'exponential' | 'fixed' // default fixed delay between retries
  maxRetryDuration?: DurationString // e.g. "5m", maximum total retry window
}

interface RateLimit {
  interval: DurationString    // e.g. "1m"
  limit: number               // max executions per interval
  strategy?: 'sliding' | 'fixed' // default 'fixed'
}

interface TaskConfig {
  id: string
  name?: string                 // Optional human-readable task name
  type: 'schedule' | 'event'

  // Scheduling options
  preset?: string               // e.g. "@midnight", "@hourly", "@weekly"
  cron?: string                 // custom cron expression
  at?: string                   // ISO timestamp: "2024-12-25T09:00:00"
  after?: DurationString        // e.g. "5m", "1d" (relative to now)
  timezone?: string             // IANA timezone name: "America/New_York", "Europe/London"

  // Event trigger
  onEvent?: string              // e.g. "user:logged_in"

  // Handler function (in-memory)
  // Event handlers receive (event, data) parameters for contextual logic
  // Schedule handlers called with no parameters
  handler: ((event?: string, data?: any) => Promise<void> | void) | (() => Promise<void> | void)

  // Retry and rate limiting
  retryPolicy?: RetryPolicy
  rateLimit?: RateLimit

  // Runtime control
  isPaused?: boolean            // defaults to false
  metadata?: Record<string, any>
}

// Task Runner Configuration
interface TaskRunnerConfig {
  dbPath?: string     // SQLite database path, defaults to ':memory:'
  timezone?: string   // Default timezone for tasks, defaults to 'UTC'
}
```

---

## ⏲ Time Handling & Timezone Support

### IANA Timezone-Aware Approach

The task runner uses **IANA timezone names** for precise, user-local scheduling:

1. **Library consumers provide timezone names**: `"America/New_York"`, `"Europe/London"`, `"Asia/Tokyo"`
2. **Croner handles timezone conversion**: Uses built-in timezone support for accurate scheduling
3. **Defensive validation**: Invalid timezone names throw errors immediately
4. **User-local execution**: Tasks run at the correct local time regardless of server location
5. **Timezone info preserved**: Original timezone stored for reference and introspection

### Supported Input Formats

| Input Type | Example | Behavior |
|------------|---------|----------|
| **Preset with timezone** | `preset: "@daily", timezone: "America/New_York"` | Runs at midnight in New York ✅ |
| **Cron with timezone** | `cron: "0 9 * * 1", timezone: "Europe/London"` | Runs Monday 9 AM London time ✅ |
| **Absolute time with timezone** | `at: "2024-12-25T09:00:00", timezone: "America/New_York"` | Runs at 9 AM EST ✅ |
| **Duration relative** | `after: "5m"` | Relative to current time ✅ |
| **No timezone specified** | Uses default timezone from TaskRunnerConfig | Falls back to UTC if not configured ✅ |

### Database Storage

* **`timezone`** field stores the IANA timezone name for each task
* **`at`** field contains the original timestamp (without timezone info)
* **`nextRunAt`** field contains UTC timestamp for internal scheduling
* **`cron`** field contains the original cron expression
* Croner handles all timezone conversions at runtime

### Example: Creating a timezone-aware task

```ts
// Task runs at 9 AM New York time every Monday
createTask({
  id: "weekly:report",
  type: "schedule",
  cron: "0 9 * * 1",
  timezone: "America/New_York",
  handler: async () => { await generateWeeklyReport() }
})

// Task runs at specific time in user's timezone
createTask({
  id: "campaign:launch", 
  type: "schedule",
  at: "2024-12-25T09:00:00",
  timezone: "America/Los_Angeles",
  handler: () => launchCampaign()
})
```

### Duration Format Support

| Unit | Description | Example |
|------|-------------|---------|
| `ms` | Milliseconds | `"500ms"` |
| `s`  | Seconds     | `"30s"` |
| `m`  | Minutes     | `"5m"` |
| `h`  | Hours       | `"2h"` |
| `d`  | Days        | `"1d"` |

---

## 🔧 Presets

Built-in presets stored centrally in the backend for reusability:

```ts
interface Preset {
  name: string // e.g. "@midnight"
  description: string
  cron: string // cron expression
}
```

### Available Presets

| Preset      | Description                      | Cron Expression |
|-------------|----------------------------------|-----------------|
| `@midnight` | Every day at midnight (00:00)    | `"0 0 * * *"`   |
| `@daily`    | Every day at midnight (00:00)    | `"0 0 * * *"`   |
| `@hourly`   | Every hour at minute 0           | `"0 * * * *"`   |
| `@weekly`   | Every Sunday at midnight         | `"0 0 * * 0"`   |
| `@monthly`  | First day of every month at midnight | `"0 0 1 * *"` |
| `@yearly`   | January 1st at midnight         | `"0 0 1 1 *"`   |

---

## 🗃 Runtime Storage (SQLite)

### Tasks Table

Each task instance is persisted with:

| Field         | Type    | Description                        |
| ------------- | ------- | ---------------------------------- |
| `id`          | TEXT    | Unique identifier                  |
| `name`        | TEXT    | Optional human-readable task name  |
| `type`        | TEXT    | `event` or `schedule`              |
| `preset`      | TEXT    | Preset name (if used)              |
| `cron`        | TEXT    | Cron expression (preset or custom) |
| `at`          | TEXT    | One-off execution timestamp        |
| `timezone`    | TEXT    | IANA timezone name                 |
| `nextRunAt`   | TEXT    | Next execution time (UTC, computed) |
| `lastRunAt`   | TEXT    | Last execution time (UTC)          |
| `attempts`    | INTEGER | Current retry attempt count        |
| `maxAttempts` | INTEGER | Max retry attempts                 |
| `rateCount`   | INTEGER | Executions in current rate window  |
| `rateWindow`  | TEXT    | Start time of current rate window  |
| `status`      | TEXT    | `pending`, `running`, `paused`     |
| `isPaused`    | INTEGER | Boolean (0/1)                      |
| `metadata`    | TEXT    | Extra user data (JSON string)     |
| `createdAt`   | TEXT    | Task creation time                 |
| `onEvent`     | TEXT    | Event name for event-based tasks  |

### Task Executions Table

Audit trail for task runs:

| Field         | Type    | Description                    |
| ------------- | ------- | ------------------------------ |
| `id`          | TEXT    | Unique execution identifier    |
| `taskId`      | TEXT    | Reference to tasks.id          |
| `status`      | TEXT    | `success`, `failed`, `running` |
| `startedAt`   | TEXT    | Execution start time           |
| `completedAt` | TEXT    | Execution completion time      |
| `error`       | TEXT    | Error message (if failed)      |
| `attempt`     | INTEGER | Retry attempt number           |

---

## 🚦 Runtime Features

### ✅ Supported

* ✅ Pausing/resuming tasks at runtime using Croner's `.pause()` and `.resume()`
* ✅ Deleting tasks (stops schedules using `.stop()`, removes from SQLite)
* ✅ Retry on failure with configurable delay, backoff, and maximum retry duration
* ✅ Rate limiting with sliding window and fixed window strategies
* ✅ Audit trail including run history, errors, retries
* ✅ Publish-subscribe system for events with wildcard support
* ✅ Task statistics and monitoring using Croner's `.nextRun()` and `.previousRun()`
* ✅ Graceful shutdown with cleanup
* ✅ Comprehensive logging system
* ✅ Task querying by status
* ✅ Automatic cleanup of one-off tasks after execution
* ✅ IANA timezone-aware scheduling
* ✅ Transactional runtime mutations

### ❌ Not supported (yet)

* Distributed coordination (single-node only)
* UI/dashboard (planned for future)
* Task priority scheduling
* Bulk operations

---

## 📢 Pub/Sub System

```ts
// Subscribe to events
pubsub.subscribe("event:*", callback)
pubsub.subscribe("event:user:logged_in", callback)

// Unsubscribe from events
pubsub.unsubscribe("event:*", callback)

// Publish events
await pubsub.publish("user:logged_in", { userId: "123" })
```

**Features:**
- Wildcard (`*`) support for topic matching
- Asynchronous event handling
- Error handling for failed callbacks
- Automatic subscriber cleanup

---

## 🔌 API Reference

### Core Functions

```ts
// Create task runner instance
const taskRunner = createTaskRunner({
  dbPath: './tasks.db',
  timezone: 'America/New_York' // default timezone for tasks
})

// Task management
taskRunner.createTask(config: TaskConfig): string
taskRunner.pauseTask(taskId: string): boolean
taskRunner.resumeTask(taskId: string): boolean
taskRunner.deleteTask(taskId: string): boolean

// Task querying
taskRunner.getTask(taskId: string): TaskRecord | undefined
taskRunner.getAllTasks(): TaskRecord[]
taskRunner.getTasksByStatus(status: TaskStatus): TaskRecord[]
taskRunner.getTaskExecutions(taskId: string): TaskExecution[]

// Croner introspection
taskRunner.getNextRunTime(taskId: string): Date | null
taskRunner.getPreviousRunTime(taskId: string): Date | null

// Event system
taskRunner.publishEvent(event: string, data?: any): Promise<void>
taskRunner.subscribeToEvent(event: string, callback: PubSubCallback): () => void
taskRunner.unsubscribeFromEvent(event: string, callback: PubSubCallback): void

// Monitoring
taskRunner.getStats(): TaskStats
taskRunner.shutdown(): void
```

### Statistics Interface

```ts
interface TaskStats {
  total: number          // Total number of tasks
  pending: number        // Tasks waiting to run
  running: number        // Currently executing tasks
  paused: number         // Paused tasks
  scheduledJobs: number  // Active Croner jobs
  timeouts: number       // Active setTimeout timers
  subscribers: number    // Total event subscribers
}
```

---

## 🧠 Design Decisions

### Why Croner?

* **IANA timezone support**: Native support for timezone-aware scheduling
* **Rich introspection**: `.nextRun()`, `.previousRun()`, and other inspection methods
* **Pause/resume**: Built-in support for pausing and resuming scheduled tasks
* **Validation**: Built-in cron expression validation
* **Flexibility**: Support for `maxRuns`, immediate execution, and more
* **Modern**: Active development and TypeScript support

### Why setTimeout?

* Used for one-off tasks scheduled via `after` or `at`
* Allows canceling and rescheduling on restart or pause
* Complementary to Croner for different scheduling needs

### Why SQLite?

* Persistent, local storage of tasks, audit logs, retry attempts, and runtime state
* Allows task state recovery after restart
* Lightweight and embedded - no external dependencies
* Transactional support for runtime mutations

### Why Functional API?

* No classes - uses functional composition
* Easier to test and reason about
* Better TypeScript integration

---

## 🧪 Example Configurations

### Schedule-based Tasks

```ts
// Using presets with timezone
createTask({
  id: "cache:cleanup",
  name: "Daily Cache Cleanup",
  type: "schedule",
  preset: "@daily",
  timezone: "America/New_York", // Runs at midnight Eastern time
  handler: async () => { await cleanCache() },
  retryPolicy: {
    maxAttempts: 3,
    delay: "1m",
    backoff: "exponential",
    maxRetryDuration: "10m"
  }
})

// Using custom cron with timezone
createTask({
  id: "weekly:report",
  type: "schedule",
  cron: "0 9 * * 1", // Every Monday at 9 AM
  timezone: "Europe/London", // London time
  handler: async () => { await generateWeeklyReport() }
})

// One-off with delay (relative to now)
createTask({
  id: "reminder:otp",
  type: "schedule",
  after: "5m",
  handler: () => sendOtpReminder()
})

// One-off with specific time and timezone
createTask({
  id: "campaign:launch",
  type: "schedule",
  at: "2024-12-25T09:00:00",
  timezone: "America/Los_Angeles", // Christmas 9 AM Pacific
  handler: () => launchCampaign()
})
```

### Event-based Tasks

```ts
// Simple event handler
createTask({
  id: "user:login:log",
  type: "event",
  onEvent: "user:logged_in",
  handler: (event, data) => analytics.track("login", data),
  rateLimit: {
    interval: "1m",
    limit: 5,
    strategy: "sliding"
  }
})

// Event handler with wildcards
createTask({
  id: "audit:all",
  type: "event", 
  onEvent: "audit:*",
  handler: (event, data) => logAuditEvent(event, data)
})
```

### Task Management

```ts
// Get task statistics
const stats = taskRunner.getStats()
console.log(`Total tasks: ${stats.total}, Running: ${stats.running}`)

// Pause/resume tasks (leverages Croner's pause/resume)
taskRunner.pauseTask("cache:cleanup")
taskRunner.resumeTask("cache:cleanup")

// Get next run time using Croner introspection
const nextRun = taskRunner.getNextRunTime("cache:cleanup")
console.log(`Next run: ${nextRun}`)

// Get task execution history
const executions = taskRunner.getTaskExecutions("cache:cleanup")
console.log(`Task has run ${executions.length} times`)

// Cleanup on shutdown
process.on('SIGTERM', () => {
  taskRunner.shutdown()
})
```