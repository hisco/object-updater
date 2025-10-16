import _ from 'lodash';

export interface MergeInstructions {
  mergeByProp?: string;
  mergeByName?: boolean;
  mergeByContents?: boolean;
  deepMerge?: boolean;
}

export interface CommentInstructions {
  comment?: string;
  removeComment?: boolean;
  commentBefore?: string;
  commentAfter?: string;
}

/**
 * Result of updateObject operation including the modified object and any comments
 */
export interface ObjectEdit<T> {
  result: T;
  comments: {
    path: (string | number)[];
    comment: string;
    direction: 'left' | 'right' | 'up' | 'down';
  }[];
}

/**
 * Type-safe helper to add merge instructions for a property.
 * This function generates Symbol-based instructions that the merge algorithm uses.
 *
 * @param options - The merge instruction configuration
 * @param options.prop - The property name to apply instructions to
 * @param options.mergeByContents - Merge array items by deep equality (no duplicates)
 * @param options.mergeByProp - Merge array items by a specific property name
 * @param options.mergeByName - Merge array items by 'name' property
 * @param options.deepMerge - Deep merge objects
 * @param options.comment - Add a comment to the property (YAML only)
 * @param options.removeComment - Remove existing comment from the property (YAML only)
 * @param options.commentBefore - Add comment before the property (YAML only)
 * @param options.commentAfter - Add comment after the property (YAML only)
 *
 * @example
 * ```typescript
 * merge: () => ({
 *   ...addInstructions({
 *     prop: 'processors',
 *     mergeByContents: true,
 *     comment: 'Updated processors configuration'
 *   }),
 *   processors: {
 *     batch: {},
 *     memory_limiter: {}
 *   }
 * })
 * ```
 */
export function addInstructions(options: {
  prop: string;
  mergeByContents?: boolean;
  mergeByProp?: string;
  mergeByName?: boolean;
  deepMerge?: boolean;
  comment?: string;
  removeComment?: boolean;
  commentBefore?: string;
  commentAfter?: string;
}): Record<symbol, MergeInstructions & CommentInstructions> {
  const { prop, mergeByContents, mergeByProp, mergeByName, deepMerge, comment, removeComment, commentBefore, commentAfter } = options;
  const symbol = Symbol.for(`merge_${prop}`);

  const mergeInstructions: MergeInstructions = {};
  if (mergeByContents !== undefined) mergeInstructions.mergeByContents = mergeByContents;
  if (mergeByProp !== undefined) mergeInstructions.mergeByProp = mergeByProp;
  if (mergeByName !== undefined) mergeInstructions.mergeByName = mergeByName;
  if (deepMerge !== undefined) mergeInstructions.deepMerge = deepMerge;

  const commentInstructions: CommentInstructions = {};
  if (comment !== undefined) commentInstructions.comment = comment;
  if (removeComment !== undefined) commentInstructions.removeComment = removeComment;
  if (commentBefore !== undefined) commentInstructions.commentBefore = commentBefore;
  if (commentAfter !== undefined) commentInstructions.commentAfter = commentAfter;

  return {
    [symbol]: { ...mergeInstructions, ...commentInstructions }
  };
}

/**
 * A focused utility for updating objects with merge-based transformations.
 * This is a streamlined version that only supports the mergeWithInstructions functionality.
 *
 * Type Safety:
 * - Generic T preserves the type of the source object
 * - Generic L (inferred from findKey) represents the type at the selected path
 * - The findKey function uses TypeScript's type inference to track nested paths
 * - The merge function receives originalValue with the correct inferred type L
 * - The merge function return type allows:
 *   - For arrays: any array (unknown[])
 *   - For objects: { [K in keyof L]?: L[K] } & { [key: string]: unknown }
 *     This means you can return:
 *     * Partial<L> (subset of existing properties)
 *     * Full L (all existing properties)
 *     * Extended object (existing properties + new properties)
 * - Return type is guaranteed to be T
 * - TypeScript provides autocomplete and type checking for originalValue properties
 *
 * @example Type-safe nested property access
 * ```typescript
 * interface Config {
 *   enabled: boolean;
 *   settings: {
 *     timeout: number;
 *     retries: number;
 *   };
 * }
 *
 * const config: Config = {
 *   enabled: false,
 *   settings: { timeout: 1000, retries: 3 }
 * };
 *
 * const { result, comments } = updateObject({
 *   sourceObject: config,
 *   annotate: ({ change }) => {
 *     change({
 *       findKey: (parsed) => parsed.settings,
 *       merge: (originalValue) => {
 *         // TypeScript infers: originalValue is { timeout: number; retries: number }
 *         // Type-safe access to properties:
 *         const currentTimeout: number = originalValue.timeout; // ✓ Type-safe
 *         const currentRetries: number = originalValue.retries; // ✓ Type-safe
 *
 *         // Can return partial or full object:
 *         return {
 *           timeout: currentTimeout * 2,
 *           retries: currentRetries + 1
 *         };
 *       },
 *       comment: () => ({
 *         text: 'Increased timeout and retries for production',
 *         direction: 'right'
 *       })
 *     });
 *   }
 * });
 * // result.result is typed as Config ✓
 * // result.result.settings.timeout is 2000 ✓
 * // result.result.settings.retries is 4 ✓
 * // comments[0].comment contains the annotation ✓
 * ```
 *
 * @example Type-safe merge instructions with addInstructions helper
 * ```typescript
 * import { updateObject, addInstructions } from 'object-updater';
 *
 * const result = updateObject({
 *   sourceObject: config,
 *   annotate: ({ change }) => {
 *     change({
 *       findKey: (parsed) => parsed.valuesObject,
 *       merge: (originalValue) => ({
 *         // TypeScript tracks originalValue type
 *         enabled: true,
 *         mode: 'daemonset',
 *         // Type-safe merge instructions
 *         ...addInstructions({
 *           prop: 'processors',
 *           mergeByContents: true
 *         }),
 *         processors: {
 *           batch: {},
 *           memory_limiter: {}
 *         }
 *       })
 *     });
 *   }
 * });
 * ```
 *
 * @example Legacy Symbol-based instructions (still supported)
 * ```typescript
 * merge: () => ({
 *   [Symbol.for('merge_processors')]: {
 *     mergeByContents: true
 *   },
 *   processors: { ... }
 * })
 * ```
 */
export function updateObject<T extends object>({
  sourceObject,
  annotate
}: {
  sourceObject: T;
  annotate?: (annotator: {
    change: <L>(options: {
      findKey: (parsed: T) => L;
      merge: (originalValue: L) => L extends any[]
        ? unknown[]
        : L extends object
          ? { [K in keyof L]?: L[K] } & { [key: string]: unknown }
          : L;
      comment?: (prev?: string) => {
        text: string;
        direction: 'left' | 'right' | 'up' | 'down';
      } | undefined;
    }) => void;
  }) => void;
}): ObjectEdit<T> {
  // Deep clone the source object to ensure immutability
  const result = _.cloneDeep(sourceObject);
  const comments: {
    path: (string | number)[];
    comment: string;
    direction: 'left' | 'right' | 'up' | 'down';
  }[] = [];

  if (annotate) {
    annotate({
      change: ({ findKey, merge, comment }) => {
        const path = findKeyByProxy(result as unknown as any, findKey);

        // Handle comment if provided
        if (comment !== undefined) {
          const newComment = comment(undefined);
          if (newComment) {
            comments.push({
              path,
              comment: newComment.text,
              direction: newComment.direction,
            });
          }
        }

        // Handle merge
        if (path.length === 0) {
          const sourceValue = merge(result as any);
          mergeWithInstructions(result as any, sourceValue);
        } else {
          const originalValue = _.get(result, createPathString(path));
          if (originalValue === undefined) {
            _.set(result, createPathString(path), merge(originalValue));
          } else {
            const sourceValue = merge(originalValue);
            mergeWithInstructions(originalValue, sourceValue);
            _.set(result, createPathString(path), originalValue as any);
          }
        }
      }
    });
  }

  return {
    result,
    comments
  };
}

/**
 * Finds the path to a value in an object by tracking proxy access
 */
export function findKeyByProxy<T extends object>(
  targetObject: T,
  lambda: (proxy: T) => any,
): (string | number)[] {
  const path: (string | number)[] = [];

  const handler: ProxyHandler<any> = {
    get(target, key, receiver) {
      if (typeof key === 'symbol') {
        throw new Error('Symbol keys are not supported');
      }
      path.push(key);
      const result = Reflect.get(target, key, receiver);
      if (typeof result === 'object' && result !== null) {
        return new Proxy(result, handler);
      }
      return result;
    },
  };

  const proxy = new Proxy(targetObject, handler);
  lambda(proxy);

  return path;
}

/**
 * Creates a lodash-compatible path string from an array of keys
 */
function createPathString(path: (string | number)[]): string {
  return path.map(p => {
    if (typeof p === 'string') {
      return `['${p}']`;
    }
    return p;
  }).join('.');
}

/**
 * Merge objects using symbol-based merge instructions embedded within the source object.
 * This function reads merge instructions from Symbol.for('merge_*') properties and applies
 * the appropriate merge strategy.
 */
function mergeWithInstructions(target: any, source: any): void {
  if (!source || typeof source !== 'object') {
    return;
  }

  // Process arrays (not applicable in this context since we're merging objects)
  if (Array.isArray(source)) {
    if (!Array.isArray(target)) {
      // This shouldn't happen in normal usage
      return;
    }

    for (const item of source) {
      target.push(_.cloneDeep(item));
    }
    return;
  }

  // For objects, check for property-specific merge instructions
  const propertyMergeInstructions = extractPropertyMergeInstructions(source);

  if (Object.keys(propertyMergeInstructions).length > 0) {
    mergeWithPropertyInstructions(target, source, propertyMergeInstructions);
  } else {
    // No merge instructions, use default deep merge behavior
    deepMergeWithArrayReplacement(target, source);
  }
}

/**
 * Extracts property-specific merge instructions from Symbol properties
 */
function extractPropertyMergeInstructions(obj: any): Record<string, MergeInstructions> {
  const instructions: Record<string, MergeInstructions> = {};

  if (!obj || typeof obj !== 'object') {
    return instructions;
  }

  // Look for symbols that start with 'merge_'
  for (const symbol of Object.getOwnPropertySymbols(obj)) {
    const symbolKey = symbol.toString();
    const match = symbolKey.match(/Symbol\(merge_(\w+)\)/);
    if (match) {
      const propertyName = match[1];
      instructions[propertyName] = obj[symbol] as MergeInstructions;
    }
  }

  return instructions;
}

/**
 * Merges objects with property-specific instructions
 */
function mergeWithPropertyInstructions(
  target: any,
  source: any,
  propertyInstructions: Record<string, MergeInstructions>
): void {
  // Clean the source of merge instruction symbols
  const cleanSource = { ...source };
  for (const symbol of Object.getOwnPropertySymbols(source)) {
    const symbolKey = symbol.toString();
    if (symbolKey.includes('merge_')) {
      delete cleanSource[symbol];
    }
  }

  // Process each property with its specific merge instructions
  for (const [propertyName, instructions] of Object.entries(propertyInstructions)) {
    if (propertyName in cleanSource) {
      const sourceValue = cleanSource[propertyName];

      if (Array.isArray(sourceValue)) {
        // Ensure target has the property as an array
        if (!target[propertyName]) {
          target[propertyName] = [];
        } else if (!Array.isArray(target[propertyName])) {
          target[propertyName] = [];
        }

        // Apply the merge instruction to the array
        if (instructions.mergeByContents) {
          for (const item of sourceValue) {
            mergeByContentsInArray(target[propertyName], item);
          }
        } else if (instructions.mergeByProp) {
          for (const item of sourceValue) {
            mergeByPropInArray(target[propertyName], item, instructions.mergeByProp);
          }
        } else if (instructions.mergeByName) {
          for (const item of sourceValue) {
            mergeByNameInArray(target[propertyName], item);
          }
        } else {
          // Default: append items
          for (const item of sourceValue) {
            target[propertyName].push(_.cloneDeep(item));
          }
        }
      } else if (typeof sourceValue === 'object' && sourceValue !== null) {
        // For nested objects, recursively merge
        if (!target[propertyName] || typeof target[propertyName] !== 'object') {
          target[propertyName] = {};
        }
        deepMergeWithArrayReplacement(target[propertyName], sourceValue);
      } else {
        // For primitives, just assign
        target[propertyName] = sourceValue;
      }

      // Remove processed property from cleanSource
      delete cleanSource[propertyName];
    }
  }

  // Merge remaining properties using default behavior
  deepMergeWithArrayReplacement(target, cleanSource);
}

/**
 * Deep merge with special handling for arrays
 */
function deepMergeWithArrayReplacement(target: any, source: any): void {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (Array.isArray(source[key])) {
        if (Array.isArray(target[key])) {
          // Check if any items in source have 'name' property for smart merging
          if (source[key].length > 0 && typeof source[key][0] === 'object' && 'name' in source[key][0]) {
            mergeArraysByName(target[key], source[key]);
          } else {
            // Default: append items
            for (const item of source[key]) {
              target[key].push(_.cloneDeep(item));
            }
          }
        } else {
          // Replace non-array with array
          target[key] = _.cloneDeep(source[key]);
        }
      } else if (typeof source[key] === 'object' && source[key] !== null) {
        // Deep merge objects
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
          target[key] = {};
        }

        // Check for nested property-specific merge instructions
        const propertyMergeInstructions = extractPropertyMergeInstructions(source[key]);

        if (Object.keys(propertyMergeInstructions).length > 0) {
          mergeWithPropertyInstructions(target[key], source[key], propertyMergeInstructions);
        } else {
          deepMergeWithArrayReplacement(target[key], source[key]);
        }
      } else {
        // Replace primitives
        target[key] = source[key];
      }
    }
  }
}

/**
 * Helper functions for array merging
 */
function mergeByContentsInArray(target: any[], item: any): void {
  const existingIndex = target.findIndex(existingItem => _.isEqual(existingItem, item));

  if (existingIndex >= 0) {
    // Item already exists, skip
    return;
  } else {
    // Add new item
    target.push(_.cloneDeep(item));
  }
}

function mergeByPropInArray(target: any[], item: any, prop: string): void {
  if (!item || typeof item !== 'object' || !(prop in item)) {
    target.push(_.cloneDeep(item));
    return;
  }

  const propValue = item[prop];
  const existingIndex = target.findIndex(existingItem =>
    existingItem && typeof existingItem === 'object' && existingItem[prop] === propValue
  );

  if (existingIndex >= 0) {
    // Replace/merge existing item
    const existingItem = target[existingIndex];
    for (const key in item) {
      if (Array.isArray(item[key])) {
        existingItem[key] = _.cloneDeep(item[key]);
      } else if (typeof item[key] === 'object' && item[key] !== null) {
        if (!existingItem[key] || typeof existingItem[key] !== 'object') {
          existingItem[key] = {};
        }
        deepMergeWithArrayReplacement(existingItem[key], item[key]);
      } else {
        existingItem[key] = item[key];
      }
    }
  } else {
    // Add new item
    target.push(_.cloneDeep(item));
  }
}

function mergeByNameInArray(target: any[], item: any): void {
  mergeByPropInArray(target, item, 'name');
}

function mergeArraysByName(target: any[], source: any[]): void {
  for (const sourceItem of source) {
    if (sourceItem && typeof sourceItem === 'object' && 'name' in sourceItem) {
      const existingIndex = target.findIndex(item =>
        item && typeof item === 'object' && item.name === sourceItem.name
      );

      if (existingIndex >= 0) {
        // Merge with existing item
        deepMergeWithArrayReplacement(target[existingIndex], sourceItem);
      } else {
        // Add new item
        target.push(_.cloneDeep(sourceItem));
      }
    } else {
      // For non-object items, just append
      target.push(_.cloneDeep(sourceItem));
    }
  }
}
