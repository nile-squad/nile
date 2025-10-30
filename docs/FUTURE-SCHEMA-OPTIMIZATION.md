# Future Schema Optimization Plan

**Status**: 📋 Planned (Not Implemented)  
**Priority**: Low - Optimize Later  
**Created**: October 30, 2024  
**Estimated Effort**: 4-6 hours  
**Memory Savings**: ~50% reduction in schema memory usage

---

## 🎯 Goal

**Remove the need to store Zod schema references on action objects permanently.**

Instead, provide schemas on-demand that can be garbage collected immediately after use (JSON schema generation).

---

## 💡 The Problem

### Current Memory Usage (After Lazy Implementation)

```
┌─────────────────────────────────────────────┐
│ Model Instance                              │
│  └─ schemaMap: Map<ModelAction, ZodSchema> │  ← Model cache
│     ├─ 'create' → ZodObject (2KB)           │
│     ├─ 'update' → ZodObject (2KB)           │
│     └─ ... (27 actions)                     │
│                                             │
│ Total Model Cache: ~54KB                    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Actions Array                               │
│  └─ actions[0]                              │
│     └─ validation.zodSchema → ZodObject     │  ← Action reference
│  └─ actions[1]                              │
│     └─ validation.zodSchema → ZodObject     │
│  └─ ... (27 actions)                        │
│                                             │
│ Total Action References: ~54KB              │
└─────────────────────────────────────────────┘

TOTAL PER MODEL: ~108KB (54KB cache + 54KB references)
For 50 tables: ~5.4MB
```

### The Issue

1. **Zod schemas are large objects** (~2KB each)
2. **Stored in two places**: Model cache + Action objects
3. **Kept in memory permanently** even though only used once for JSON schema generation
4. **Scales linearly** with number of tables × actions

---

## ✅ Proposed Solution

### Remove Permanent Storage on Actions

**Current**:
```typescript
const action: Action = {
  name: 'create',
  validation: {
    zodSchema: model.getSchema('create') // ← Permanent reference
  }
};
```

**Proposed**:
```typescript
const action: Action = {
  name: 'create',
  validation: {
    // No zodSchema stored here!
    getSchema: () => model.getSchemaForAction('create') // ← On-demand
  }
};
```

### Implementation Approach

#### 1. Add `getAllSchemas()` Method (Batch Generation)

```typescript
function createModel({ table, dbInstance, config }) {
  return {
    /**
     * Generates all validation schemas at once.
     * Returns a temporary Map that can be GC'd after extraction.
     * 
     * Use case: Factory initialization for action generation
     * 
     * @returns Temporary Map of all schemas (not cached in model)
     */
    getAllSchemas: () => {
      const tempSchemas = new Map<ModelAction, ZodObject<ZodRawShape>>();
      
      // Generate all schemas
      Object.entries(ACTION_OPERATION_MAP).forEach(([actionName, operation]) => {
        tempSchemas.set(
          actionName as ModelAction,
          getValidationSchema({
            inferTable: table,
            ...config,
            context: { operation }
          })
        );
      });
      
      // Optional: Auto-cleanup after extraction
      // The Map structure can be GC'd, but schemas are held by actions
      setTimeout(() => {
        tempSchemas.clear();
      }, 100);
      
      return tempSchemas;
    },
    
    /**
     * Get single schema on-demand (no caching)
     * Use case: Manual/custom access, rare usage
     */
    getSchema: (actionName: ModelAction) => {
      const operation = ACTION_OPERATION_MAP[actionName];
      if (!operation) return null;
      
      // Generate fresh each time, no cache
      return getValidationSchema({
        inferTable: table,
        ...config,
        context: { operation }
      });
    }
  };
}
```

#### 2. Update Action Type (Remove zodSchema)

**Current Type**:
```typescript
export type Action = {
  name: string;
  validation: {
    zodSchema?: ZodObject<ZodRawShape>; // ← Stored permanently
  };
  // ...
};
```

**Proposed Type**:
```typescript
export type Action = {
  name: string;
  validation: {
    // Option A: Function that returns schema on-demand
    getSchema?: () => ZodObject<ZodRawShape> | null;
    
    // Option B: Store JSON schema instead (much lighter)
    jsonSchema?: Record<string, any>;
    
    // Option C: Reference to model + action name
    schemaRef?: {
      model: Model<any, any>;
      actionName: ModelAction;
    };
  };
  // ...
};
```

#### 3. Update Factory to Use `getAllSchemas()`

**Current**:
```typescript
const model = createModel({ table, dbInstance, config });

actions.push({
  name: 'create',
  validation: {
    zodSchema: model.getSchema('create') // ← Stores in action
  }
});
```

**Proposed**:
```typescript
const model = createModel({ table, dbInstance, config });
const allSchemas = model.getAllSchemas(); // ← Batch generate

actions.push({
  name: 'create',
  validation: {
    getSchema: () => model.getSchema('create') // ← On-demand function
    // OR store JSON immediately:
    // jsonSchema: z.toJSONSchema(allSchemas.get('create'))
  }
});

// allSchemas Map goes out of scope → GC'd
```

#### 4. Update RPC/REST to Use On-Demand Schemas

**Current**:
```typescript
export const getSchemas = (serverConfig) => {
  const finalServices = processServices(serverConfig);
  
  const schemaData = finalServices.map((service) => ({
    [service.name]: service.actions.map((a) => ({
      validation: a.validation?.zodSchema
        ? z.toJSONSchema(a.validation.zodSchema) // ← Uses stored schema
        : null
    }))
  }));
  
  return formatResult(schemaData, 'Schemas');
};
```

**Proposed**:
```typescript
export const getSchemas = (serverConfig) => {
  const finalServices = processServices(serverConfig);
  
  const schemaData = finalServices.map((service) => ({
    [service.name]: service.actions.map((a) => {
      // Get schema on-demand
      const zodSchema = a.validation?.getSchema?.();
      
      return {
        validation: zodSchema
          ? z.toJSONSchema(zodSchema) // ← Generate, use, then let GC
          : null
      };
    })
  }));
  
  return formatResult(schemaData, 'Schemas');
};
```

---

## 📊 Expected Impact

### Memory Savings

**Before Optimization**:
```
50 tables × 27 actions × 2KB × 2 (cache + references) = ~5.4MB
```

**After Optimization**:
```
Option A (On-demand functions):
  50 tables × 27 actions × ~100 bytes (function ref) = ~135KB
  Savings: ~5.3MB (98% reduction!)

Option B (Store JSON schemas):
  50 tables × 27 actions × ~500 bytes (JSON) = ~675KB
  Savings: ~4.7MB (87% reduction!)

Option C (Schema references):
  50 tables × 27 actions × ~50 bytes (ref) = ~68KB
  Savings: ~5.3MB (99% reduction!)
```

### Performance Impact

**Pros**:
- ✅ Massive memory reduction (~5MB for typical app)
- ✅ Faster GC cycles (fewer large objects)
- ✅ Better memory scaling with table count

**Cons**:
- ⚠️ Schema generation on each `getSchemas()` call
- ⚠️ Slightly slower RPC/REST schema endpoint (~10-50ms for 50 tables)
- ⚠️ More complex implementation

**Mitigation**:
- Cache JSON schemas at RPC layer if needed
- Generate JSON schemas once during server init
- Use Option B (store lightweight JSON schemas)

---

## 🔄 Implementation Steps

### Phase 1: Add `getAllSchemas()` Method (2 hours)

1. Add `getAllSchemas()` to `createModel` in `nile/src/core/orm/index.ts`
2. Add type definition to `Model` interface
3. Write tests for batch generation
4. Verify memory is released (use WeakRef if needed)

### Phase 2: Update Action Type (1 hour)

1. Decide on approach (A, B, or C)
2. Update `Action` type in `nile/src/types/actions.ts`
3. Mark `zodSchema` as deprecated (keep for backward compatibility)
4. Update type exports

### Phase 3: Update Factories (1 hour)

1. Update action generators to use new approach
2. Test with `getAllSchemas()` batch generation
3. Verify schemas are correctly passed

### Phase 4: Update RPC/REST/WS (2 hours)

1. Update `getSchemas()` in RPC to use on-demand
2. Update REST schema endpoint
3. Update WebSocket schema handling
4. Add caching if performance degrades

### Phase 5: Testing & Validation (1 hour)

1. Run full test suite
2. Memory profiling (before/after)
3. Performance benchmarks
4. Frontend type generation verification

### Phase 6: Documentation & Cleanup (1 hour)

1. Update documentation
2. Add migration guide
3. Deprecation notices for old approach
4. Performance notes

---

## 🚨 Breaking Changes Considerations

### Backward Compatibility Strategy

**Option 1: Gradual Migration**
- Keep `zodSchema` for 1-2 major versions
- Add new approach alongside
- Deprecation warnings in logs
- Remove in v2.0

**Option 2: Automatic Migration**
- Detect usage of `action.validation.zodSchema`
- Auto-convert to new approach
- Warn in development mode
- Silent in production

**Option 3: Feature Flag**
- Add `config.useOnDemandSchemas: boolean`
- Default to false (current behavior)
- Opt-in to new approach
- Make default in next major

---

## 🤔 Decision Points

### Which Approach to Use?

**Option A: On-Demand Functions** ✅ **Recommended**
```typescript
validation: {
  getSchema: () => model.getSchema('create')
}
```
**Pros**: Maximum memory savings, true on-demand
**Cons**: Schema generation on each call, most complex

**Option B: Store JSON Schemas** ⚡ **Best Balance**
```typescript
validation: {
  jsonSchema: z.toJSONSchema(zodSchema)
}
```
**Pros**: Good memory savings, no runtime generation, simple
**Cons**: Still stores data (but 75% smaller)

**Option C: Schema References** 🎯 **Simplest**
```typescript
validation: {
  schemaRef: { model, actionName: 'create' }
}
```
**Pros**: Minimal memory, simple implementation
**Cons**: Requires model reference, coupling

### Recommendation: **Option B (Store JSON Schemas)**

**Why**:
1. 87% memory reduction is excellent
2. No runtime generation overhead
3. Simplest implementation
4. JSON schemas are what we need anyway
5. Easy backward compatibility

---

## 📝 Implementation Notes

### WeakMap Consideration

The original discussion mentioned WeakMap, but it's not needed because:
- Zod schemas are held by actions (strong references)
- WeakMap only helps if keys can be GC'd
- Action objects are held by services (strong references)
- Services are held by server config (permanent)

**Conclusion**: WeakMap doesn't help here. Focus on not storing schemas permanently.

### Timing Consideration

```typescript
// This doesn't help much:
setTimeout(() => schemas.clear(), 100);

// Because:
// 1. Map structure is tiny (~1KB)
// 2. Individual schemas are held by actions (can't be GC'd)
// 3. Map going out of scope is sufficient
```

**Better approach**: Let JS natural GC handle it, or store JSON schemas immediately.

---

## 🎯 Success Metrics

### Must Have
- ✅ Memory usage reduced by >50%
- ✅ All tests pass
- ✅ Frontend type generation works
- ✅ Backward compatible (or clear migration path)

### Nice to Have
- ✅ Memory usage reduced by >80%
- ✅ RPC performance same or better
- ✅ Zero-config migration
- ✅ Improved GC performance

---

## 🔮 Future Enhancements

### 1. Distributed Schema Cache
```typescript
// Share schemas across multiple server instances
const schemaCache = new Redis();
```

### 2. Schema Compression
```typescript
// Compress JSON schemas for even smaller memory
const compressed = zlib.gzip(JSON.stringify(jsonSchema));
```

### 3. Schema Lazy Loading
```typescript
// Load schemas from disk on-demand
const schema = await loadSchemaFromDisk(actionName);
```

### 4. Schema CDN
```typescript
// Serve schemas from CDN for frontend
const schemas = await fetch('https://cdn.example.com/schemas');
```

---

## 📚 References

- **Current Implementation**: `nile/src/core/orm/index.ts` (lines 134-159)
- **Action Type**: `nile/src/types/actions.ts` (line 48)
- **RPC Schema Generation**: `nile/src/interfaces/rpc/service-utils.ts` (lines 239-284)
- **Factory Usage**: `nile/src/core/actions/create.ts` (line 49)

---

## 👥 Discussion History

**Key Insights from Discussion**:

1. Model methods don't need cached schemas - they call `getValidationSchema()` directly with runtime options

2. `getSchema()` is primarily for factory initialization (batch use)

3. Schemas are only used once to generate JSON schemas for frontend

4. Current lazy caching creates duplicate memory (model cache + action references)

5. `getAllSchemas()` can generate batch, return temp Map, let GC handle cleanup

6. Best approach: Store JSON schemas on actions (lightweight, no runtime cost)

---

## ✅ Implementation Checklist

When implementing this optimization:

- [ ] Read this document fully
- [ ] Choose approach (A, B, or C)
- [ ] Create feature branch
- [ ] Implement `getAllSchemas()` method
- [ ] Update `Action` type
- [ ] Update factory generators
- [ ] Update RPC/REST/WS layers
- [ ] Write tests
- [ ] Memory profiling
- [ ] Performance benchmarks
- [ ] Update documentation
- [ ] Create migration guide
- [ ] Get code review
- [ ] Merge to main

---

**Status**: 📋 Ready for Implementation  
**Next Step**: Schedule for future sprint when memory optimization is prioritized  
**Contact**: Review this document when ready to implement

---

## 💭 Final Thoughts

This optimization is **not critical** for current functionality but provides significant value for:

1. **Large-scale applications** (100+ tables)
2. **Memory-constrained environments** (serverless, containers)
3. **Long-running processes** (reduce GC pressure)

**Recommendation**: Implement when:
- Memory profiling shows schema memory is significant
- Scaling to 50+ database tables
- Optimizing for serverless/edge deployments
- Next major version (breaking changes acceptable)

**Priority**: Low - Current implementation works well for typical use cases

