# SubService Meta System

**Version:** 1.1  
**Date:** September 22, 2025  
**Author:** Hussein Kizz

## Overview

The SubService Meta System provides a flexible way to attach arbitrary metadata to SubServices in the Nile framework. This generic approach allows developers to store any configuration or metadata they need without framework limitations.

## Type Definition

```typescript
export type SubService = {
  name: string;
  description: string;
  actions: Action[];
  tableName: string;
  idName: string;
  meta?: Record<string, any>; // Generic metadata property
};
```

## Usage Patterns

### Access Control Configuration

```typescript
{
  name: 'users',
  tableName: 'users',
  idName: 'id',
  meta: {
    access: {
      create: ['owner', 'admin'],
      read: ['owner', 'admin', 'manager', 'member'],
      update: ['owner', 'admin', 'manager'],
      delete: ['owner', 'admin']
    }
  }
}
```

### Multiple Metadata Types

```typescript
{
  name: 'products',
  tableName: 'products', 
  idName: 'id',
  meta: {
    access: {
      create: ['owner', 'admin'],
      read: ['owner', 'admin', 'manager', 'member'],
      update: ['owner', 'admin'],
      delete: ['owner']
    },
    caching: { ttl: 300, strategy: 'lru' },
    validation: { strict: true, sanitize: true },
    features: ['beta', 'experimental']
  }
}
```

## Implementation Example

```typescript
import type { ActionTypes } from '@nile-squad/nile/types';

export const subServices: ActionTypes.SubServices = [
  {
    name: 'users',
    description: 'User management',
    tableName: 'users',
    idName: 'id',
    actions: [],
    publicActions: ['getOne'], // Actions that are public (no authentication required)
    meta: {
      access: {
        create: ['owner', 'admin'],
        read: ['owner', 'admin', 'manager', 'member'],
        update: ['owner', 'admin'],
        delete: ['owner']
      }
    },
  },
];
```

## Benefits

1. **Flexibility**: Store any metadata without framework changes
2. **Extensibility**: Add new metadata types as needed
3. **Type Safety**: Full TypeScript support with `Record<string, any>`
4. **Backward Compatibility**: Optional property doesn't break existing code
5. **Performance**: Metadata is available at service definition time

## Best Practices

1. **Consistent Structure**: Use consistent metadata property names across services
2. **Documentation**: Document your metadata structure for team clarity
3. **Validation**: Validate metadata structure if needed for critical configurations
4. **Namespacing**: Use nested objects to avoid property name conflicts

---

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz  
**Framework:** [Nile](https://github.com/nile-squad/nile)