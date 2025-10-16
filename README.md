# @hiscojs/object-updater

Type-safe, immutable object updates with advanced array merging strategies and proxy-based path tracking.

## Installation

```bash
npm install @hiscojs/object-updater
```

## Quick Start

```typescript
import { updateObject, addInstructions } from '@hiscojs/object-updater';

const source = {
  server: {
    host: 'localhost',
    port: 3000
  }
};

const { result } = updateObject({
  sourceObject: source,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj.server,
      merge: () => ({ port: 8080 })
    });
  }
});

console.log(result.server.port); // 8080
```

## Features

- **Type-Safe**: Full TypeScript support with generic type parameters
- **Immutable**: Original objects are never modified
- **Proxy-Based Path Tracking**: Automatic path detection via property access
- **Advanced Array Merging**: Multiple strategies for merging arrays
- **Deep Merging**: Recursive object merging with control
- **Comment Tracking**: Track changes with metadata for documentation

## API Reference

### `updateObject<T>(options)`

Updates an object immutably with type safety.

#### Parameters

```typescript
interface UpdateObjectOptions<T> {
  sourceObject: T;
  annotate?: (annotator: {
    change: <L>(options: ChangeOptions<T, L>) => void;
  }) => void;
}
```

#### Returns

```typescript
interface ObjectEdit<T> {
  result: T;              // Updated object
  comments: {            // Array of comments for tracking changes
    path: (string | number)[];
    comment: string;
    direction: 'left' | 'right' | 'up' | 'down';
  }[];
}
```

### `change<L>(options)`

Defines a single change operation.

```typescript
interface ChangeOptions<T, L> {
  findKey: (obj: T) => L;
  merge: (originalValue: L) => Partial<L>;
  comment?: () => { text: string; direction: 'left' | 'right' | 'up' | 'down' } | undefined;
}
```

- **`findKey`**: Function that returns the nested value to update. Uses proxy tracking to determine the path.
- **`merge`**: Function that receives the original value and returns updates to apply.
- **`comment`**: Optional function to add metadata about the change.

## Array Merging Strategies

### `addInstructions(options)`

Defines how arrays should be merged using special symbol-based instructions.

```typescript
interface MergeInstructions {
  prop: string;              // Property name containing the array
  mergeByContents?: boolean; // Deduplicate by deep equality
  mergeByProp?: string;      // Merge by specific property (e.g., 'id')
  mergeByName?: boolean;     // Merge by 'name' property (shorthand)
  deepMerge?: boolean;       // Deep merge objects in arrays
}
```

### Strategy 1: `mergeByContents`

Deduplicates array items by deep equality.

```typescript
const source = {
  items: ['a', 'b', 'c']
};

const { result } = updateObject({
  sourceObject: source,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj,
      merge: () => ({
        ...addInstructions({
          prop: 'items',
          mergeByContents: true
        }),
        items: ['b', 'c', 'd']  // Add 'd', deduplicate 'b' and 'c'
      })
    });
  }
});

// result.items = ['a', 'b', 'c', 'd']
```

### Strategy 2: `mergeByName`

Merges array items by their `name` property.

```typescript
const source = {
  containers: [
    { name: 'app', image: 'app:1.0' },
    { name: 'sidecar', image: 'sidecar:1.0' }
  ]
};

const { result } = updateObject({
  sourceObject: source,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj,
      merge: () => ({
        ...addInstructions({
          prop: 'containers',
          mergeByName: true
        }),
        containers: [
          { name: 'app', image: 'app:2.0' }  // Updates existing 'app'
        ]
      })
    });
  }
});

// result.containers = [
//   { name: 'app', image: 'app:2.0' },      // Updated
//   { name: 'sidecar', image: 'sidecar:1.0' } // Preserved
// ]
```

### Strategy 3: `mergeByProp`

Merges array items by any specified property.

```typescript
const source = {
  users: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ]
};

const { result } = updateObject({
  sourceObject: source,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj,
      merge: () => ({
        ...addInstructions({
          prop: 'users',
          mergeByProp: 'id'
        }),
        users: [
          { id: 1, name: 'Alice Smith' },  // Updates id=1
          { id: 3, name: 'Charlie' }       // Adds new
        ]
      })
    });
  }
});

// result.users = [
//   { id: 1, name: 'Alice Smith' },  // Updated
//   { id: 2, name: 'Bob' },          // Preserved
//   { id: 3, name: 'Charlie' }       // Added
// ]
```

### Strategy 4: `deepMerge`

Deep merges nested objects in arrays.

```typescript
const source = {
  configs: [
    { name: 'db', settings: { timeout: 30, pool: 10 } }
  ]
};

const { result } = updateObject({
  sourceObject: source,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj,
      merge: () => ({
        ...addInstructions({
          prop: 'configs',
          mergeByName: true,
          deepMerge: true
        }),
        configs: [
          { name: 'db', settings: { timeout: 60 } }  // Only update timeout
        ]
      })
    });
  }
});

// result.configs = [
//   { name: 'db', settings: { timeout: 60, pool: 10 } }  // pool preserved
// ]
```

## Using `originalValue`

Access the original value before changes to make conditional updates.

```typescript
const source = {
  version: '1.2.3',
  deployments: 5
};

const { result } = updateObject({
  sourceObject: source,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj,
      merge: (originalValue) => {
        // Increment patch version
        const [major, minor, patch] = originalValue.version.split('.').map(Number);

        return {
          version: `${major}.${minor}.${patch + 1}`,
          deployments: originalValue.deployments + 1
        };
      }
    });
  }
});

// result = { version: '1.2.4', deployments: 6 }
```

## Advanced Examples

### Multiple Changes

Apply multiple changes in sequence:

```typescript
const { result } = updateObject({
  sourceObject: config,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj.database,
      merge: () => ({ host: 'db.production.com' })
    });

    change({
      findKey: (obj) => obj.cache,
      merge: () => ({ host: 'cache.production.com' })
    });

    change({
      findKey: (obj) => obj.api,
      merge: () => ({ host: 'api.production.com' })
    });
  }
});
```

### Conditional Updates

```typescript
const { result } = updateObject({
  sourceObject: deployment,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj.spec,
      merge: (originalValue) => ({
        replicas: originalValue.replicas < 3
          ? originalValue.replicas * 2
          : originalValue.replicas
      })
    });
  }
});
```

### Nested Array Operations

```typescript
const { result } = updateObject({
  sourceObject: manifest,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj.spec.template.spec,
      merge: () => ({
        ...addInstructions({
          prop: 'containers',
          mergeByName: true,
          deepMerge: true
        }),
        containers: [
          {
            name: 'app',
            resources: {
              cpu: '500m',
              memory: '256Mi'
            }
          }
        ]
      })
    });
  }
});
```

## Type Safety

Full TypeScript support with generic type parameters:

```typescript
interface Config {
  server: {
    host: string;
    port: number;
  };
  database: {
    host: string;
    port: number;
  };
}

const { result } = updateObject<Config>({
  sourceObject: config,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj.server,  // obj is Config, fully typed
      merge: () => ({ port: 8080 })  // Return type validated
    });
  }
});

// result.server.port is number (type-safe!)
```

## Helper Functions

### `findKeyByProxy<T>(targetObject, lambda)`

Manually find a path using proxy tracking (typically used internally).

```typescript
import { findKeyByProxy } from '@hiscojs/object-updater';

const path = findKeyByProxy(config, (obj) => obj.server.port);
// Returns: ['server', 'port']
```

### `addInstructions(options)`

Create merge instructions for arrays.

```typescript
import { addInstructions } from '@hiscojs/object-updater';

const instructions = addInstructions({
  prop: 'items',
  mergeByContents: true
});

// Returns an object with a symbol key containing merge instructions
```

## How It Works

### Proxy-Based Path Tracking

The `findKey` function uses JavaScript Proxies to track property access:

```typescript
findKey: (obj) => obj.server.database.host
// Internally tracks: ['server', 'database', 'host']
```

This allows type-safe path specification without string literals.

### Immutable Updates

All operations use `lodash.cloneDeep` and spread operators to ensure immutability:

```typescript
const original = { value: 1 };
const { result } = updateObject({
  sourceObject: original,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj,
      merge: () => ({ value: 2 })
    });
  }
});

console.log(original.value);  // 1 (unchanged)
console.log(result.value);    // 2 (new object)
```

## Best Practices

### 1. Use Type Parameters

```typescript
// ✅ Good - Type safe
const { result } = updateObject<MyType>({ ... });

// ❌ Avoid - No type safety
const { result } = updateObject({ ... });
```

### 2. Leverage `originalValue`

```typescript
// ✅ Good - Read original values
merge: (originalValue) => ({
  count: originalValue.count + 1
})

// ❌ Avoid - Hardcoded values
merge: () => ({ count: 6 })
```

### 3. Use Appropriate Merge Strategies

```typescript
// ✅ Good - Explicit merge strategy
...addInstructions({
  prop: 'users',
  mergeByProp: 'id'
})

// ❌ Avoid - Direct array replacement
users: newUsers  // Loses existing items
```

### 4. Multiple Focused Changes

```typescript
// ✅ Good - Multiple focused changes
change({ findKey: (obj) => obj.server, ... });
change({ findKey: (obj) => obj.database, ... });

// ❌ Avoid - Single large change
change({ findKey: (obj) => obj, merge: () => ({ ...everything }) });
```

## Common Patterns

### Configuration Management

```typescript
const { result } = updateObject({
  sourceObject: appConfig,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj.environment,
      merge: () => ({ NODE_ENV: 'production' })
    });
  }
});
```

### Kubernetes Manifest Updates

```typescript
const { result } = updateObject({
  sourceObject: deployment,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj.spec,
      merge: (original) => ({ replicas: original.replicas * 2 })
    });
  }
});
```

### State Management

```typescript
const { result } = updateObject({
  sourceObject: state,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj.user.preferences,
      merge: (prefs) => ({ ...prefs, theme: 'dark' })
    });
  }
});
```

## Performance Considerations

- **Proxy Creation**: Proxies are created per `findKey` call. Minimize findKey invocations in loops.
- **Deep Cloning**: Uses `lodash.cloneDeep` for immutability. Large objects may impact performance.
- **Array Merging**: `mergeByContents` uses deep equality checks. Consider `mergeByProp` for large arrays.

## License

MIT

## Contributing

Issues and pull requests welcome!

## Repository

https://github.com/hisco/object-updater
