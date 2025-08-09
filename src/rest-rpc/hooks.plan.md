# Hooks System Design for nile/src/rest-rpc

## Overview

This document outlines the design for implementing a composable hooks/middleware system that extends the existing action structure in the nile/src/rest-rpc framework. The system allows actions to define before and after hooks that are executed as part of a predictable pipeline, providing auditing capabilities and flexible control over the execution flow.

## Core Design Principles

1. **Minimal Friction**: Leverage existing action structure with minimal changes
2. **Composability**: Reuse existing actions as hooks
3. **Predictability**: Clear execution order and error handling
4. **Defensive Programming**: Fail fast for development-time configuration errors
5. **Auditability**: Complete execution tracking for debugging and compliance

## Type Definitions

### Hook Definition
```typescript
interface HookDefinition {
  canFail: boolean; // If false and the hook fails, halt the pipeline immediately
  name: string;     // The name of another action to invoke as a hook
}
```

### Action Result Configuration
```typescript
interface ActionResultConfig {
  pipeline: boolean; // When true, include detailed pipeline audit data in the final response
}
```

### Extended Action Type
```typescript
interface Action {
  name: string;
  description: string;
  handler: (data: any, context?: HookContext) => Promise<any>;
  validation: any;
  // Optional hooks property to define before and after hooks
  hooks?: {
    before?: HookDefinition[];
    after?: HookDefinition[];
  };
  // Optional configuration to influence what gets returned after pipeline execution
  result?: ActionResultConfig;
}
```

### Hook Context
```typescript
interface HookContext {
  actionName: string;
  input: any;
  output?: any;
  error?: Error;
  state: Record<string, any>;
  log: {
    before: Array<{ name: string; input: any; output: any; passed: boolean }>;
    after: Array<{ name: string; input: any; output: any; passed: boolean }>;
  };
}
```

## Pipeline Execution Flow

### 1. Context Creation
When any action is invoked, create a HookContext that includes:
- Original payload (input)
- Mutable state object for sharing data throughout the pipeline
- Logging arrays for tracking hook invocations
- Space for main action output and errors

### 2. Before Hooks Execution
- Execute before hooks sequentially in the order defined
- Each hook's output becomes the input for the next hook (or main action)
- Log each hook's details: name, input, output, pass/fail status
- **Defensive Programming**: If a referenced action is not found, throw an error immediately
- **canFail Logic**: If a hook fails and `canFail` is false, halt pipeline and return hook's response with audit log

### 3. Main Action Execution
- Execute the main action handler using the final output from before hooks (or original input if no before hooks)
- Record the output and any errors in the HookContext
- All actions share the same handler signature, enabling uniform success/failure determination

### 4. After Hooks Execution
- Execute after hooks sequentially in the order defined
- Input starts with main action's result (or previous after hook's output)
- Log each hook's invocation details
- Apply same `canFail` logic as before hooks

### 5. Final Result Composition
If `action.result?.pipeline` is true, return:
```typescript
{
  result: mainActionOutput,
  pipeline: {
    state: finalPipelineState,
    log: completeHookExecutionLog
  }
}
```

Otherwise, return just the main action's output.

## Error Handling

### Development-Time Errors
- **Missing Hook Actions**: Throw immediately if a referenced hook action is not found
- **Configuration Errors**: Validate hook definitions during action registration

### Runtime Errors
- **canFail: false**: If hook fails, immediately return hook's response with audit log
- **canFail: true**: Log the failure but continue pipeline execution
- **Main Action Failures**: Always halt pipeline and return error with audit log

## Benefits

1. **Reuse Existing Infrastructure**: Hooks are just existing actions, no new handler types needed
2. **Clear Data Flow**: Before hooks → Main action → After hooks with explicit input/output chaining
3. **Complete Auditability**: Every hook invocation logged with input, output, and status
4. **Flexible Control**: Actions can choose to expose full pipeline details or just main response
5. **Fail-Fast Development**: Missing references caught early, not in production
6. **Composable**: Any action can be used as a hook for any other action

## Example Usage

```typescript
const userCreationAction: Action = {
  name: 'createUser',
  description: 'Create a new user account',
  handler: createUserHandler,
  validation: { zodSchema: userSchema },
  hooks: {
    before: [
      { name: 'validateEmail', canFail: false },
      { name: 'checkDuplicateUser', canFail: false },
      { name: 'enrichUserData', canFail: true }
    ],
    after: [
      { name: 'sendWelcomeEmail', canFail: true },
      { name: 'logUserCreation', canFail: false },
      { name: 'updateAnalytics', canFail: true }
    ]
  },
  result: {
    pipeline: true // Include full audit trail in response
  }
};
```

## Implementation Checklist

- [ ] Extend Action type definition with hooks and result properties
- [ ] Create HookContext interface and supporting types
- [ ] Implement hook resolution with defensive error handling
- [ ] Modify action execution flow to process before/after hooks
- [ ] Add pipeline result composition logic
- [ ] Create comprehensive tests for hook execution scenarios
- [ ] Add validation for hook configurations during action registration
- [ ] Document hook usage patterns and best practices

## Future Considerations

- **Performance**: Consider lazy loading of hook actions for large hook chains
- **Async Hooks**: Evaluate need for parallel hook execution vs sequential
- **Hook Validation**: Add schema validation for hook inputs/outputs
- **Monitoring**: Integration with existing logging/monitoring systems
- **Caching**: Pipeline result caching for expensive hook chains