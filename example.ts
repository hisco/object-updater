import { updateObject, addInstructions } from './src/index';

// Example 1: Simple update
const config1 = {
  server: {
    host: 'localhost',
    port: 3000
  }
};

const { result: result1 } = updateObject({
  sourceObject: config1,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj.server,
      merge: () => ({ port: 8080 })
    });
  }
});

console.log('Example 1 - Simple update:');
console.log('Original:', config1);
console.log('Updated:', result1);
console.log('');

// Example 2: Array merging by name
const config2 = {
  containers: [
    { name: 'app', image: 'app:1.0' },
    { name: 'sidecar', image: 'sidecar:1.0' }
  ]
};

const { result: result2 } = updateObject({
  sourceObject: config2,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj,
      merge: () => ({
        ...addInstructions({
          prop: 'containers',
          mergeByName: true
        }),
        containers: [
          { name: 'app', image: 'app:2.0' }
        ]
      })
    });
  }
});

console.log('Example 2 - Array merging by name:');
console.log('Original:', config2);
console.log('Updated:', result2);
console.log('');

// Example 3: Using originalValue
const config3 = {
  version: '1.2.3',
  deployments: 5
};

const { result: result3 } = updateObject({
  sourceObject: config3,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj,
      merge: (originalValue) => {
        const [major, minor, patch] = originalValue.version.split('.').map(Number);
        return {
          version: `${major}.${minor}.${patch + 1}`,
          deployments: originalValue.deployments + 1
        };
      }
    });
  }
});

console.log('Example 3 - Using originalValue:');
console.log('Original:', config3);
console.log('Updated:', result3);
console.log('');

// Example 4: Comment tracking
const config4 = {
  database: {
    host: 'localhost',
    port: 5432
  }
};

const { result: result4, comments } = updateObject({
  sourceObject: config4,
  annotate: ({ change }) => {
    change({
      findKey: (obj) => obj.database,
      merge: () => ({
        host: 'db.production.com',
        port: 5432
      }),
      comment: () => ({
        text: 'Updated to production database',
        direction: 'right'
      })
    });
  }
});

console.log('Example 4 - Comment tracking:');
console.log('Original:', config4);
console.log('Updated:', result4);
console.log('Comments:', comments);
