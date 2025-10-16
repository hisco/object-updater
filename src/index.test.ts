import { updateObject, addInstructions } from './index';

import { describe, it, expect } from '@jest/globals';

// Type definitions for testing type safety
interface TestConfig {
  enabled: boolean;
  mode: string;
  replicas?: number;
  settings: {
    timeout: number;
    retries: number;
  };
  features: {
    authentication: {
      enabled: boolean;
      provider: string;
    };
  };
}

interface OtelConfig {
  enabled: boolean;
  chartVersion: string;
  valuesObject: {
    mode: string;
    image: {
      repository: string;
      tag: string;
    };
    presets: {
      clusterMetrics?: {
        enabled: boolean;
      };
      kubernetesAttributes: {
        enabled: boolean;
        extractAllPodLabels?: boolean;
      };
    };
    config: {
      processors: {
        [key: string]: any;
      };
      exporters: {
        [key: string]: any;
      };
    };
    resources: {
      limits: {
        memory: string;
        cpu: string;
      };
      requests: {
        memory: string;
        cpu: string;
      };
    };
  };
}

describe('object-updater', () => {
  describe('type safety', () => {
    it('should preserve root object type', () => {
      const config: TestConfig = {
        enabled: false,
        mode: 'development',
        settings: {
          timeout: 1000,
          retries: 3
        },
        features: {
          authentication: {
            enabled: false,
            provider: 'local'
          }
        }
      };

      const { result } = updateObject({
        sourceObject: config,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              enabled: true,
              replicas: 3
            })
          });
        }
      });

      // Type assertion to verify return type
      const typedResult: TestConfig = result;
      expect(typedResult.enabled).toBe(true);
      expect(typedResult.mode).toBe('development');
      expect(typedResult.replicas).toBe(3);
    });

    it('should preserve nested object type', () => {
      const config: TestConfig = {
        enabled: false,
        mode: 'development',
        settings: {
          timeout: 1000,
          retries: 3
        },
        features: {
          authentication: {
            enabled: false,
            provider: 'local'
          }
        }
      };

      const { result } = updateObject({
        sourceObject: config,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.settings,
            merge: (originalValue) => {
              // TypeScript should know originalValue is { timeout: number; retries: number }
              const timeout: number = originalValue.timeout;
              const retries: number = originalValue.retries;
              return {
                timeout: timeout + 1000,
                retries: retries + 1
              };
            }
          });
        }
      });

      expect(result.settings.timeout).toBe(2000);
      expect(result.settings.retries).toBe(4);
    });

    it('should preserve deeply nested object type', () => {
      const config: TestConfig = {
        enabled: false,
        mode: 'development',
        settings: {
          timeout: 1000,
          retries: 3
        },
        features: {
          authentication: {
            enabled: false,
            provider: 'local'
          }
        }
      };

      const { result } = updateObject({
        sourceObject: config,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.features.authentication,
            merge: (originalValue) => {
              // TypeScript should know originalValue is { enabled: boolean; provider: string }
              const enabled: boolean = originalValue.enabled;
              const provider: string = originalValue.provider;
              return {
                enabled: !enabled,
                provider: provider.toUpperCase()
              };
            }
          });
        }
      });

      expect(result.features.authentication.enabled).toBe(true);
      expect(result.features.authentication.provider).toBe('LOCAL');
    });

    it('should preserve complex OtelConfig type', () => {
      const otelConfig: OtelConfig = {
        enabled: false,
        chartVersion: '0.130.1',
        valuesObject: {
          mode: 'deployment',
          image: {
            repository: 'otel/opentelemetry-collector',
            tag: '0.130.0'
          },
          presets: {
            kubernetesAttributes: {
              enabled: false
            }
          },
          config: {
            processors: {},
            exporters: {}
          },
          resources: {
            limits: {
              memory: '1Gi',
              cpu: '500m'
            },
            requests: {
              memory: '512Mi',
              cpu: '250m'
            }
          }
        }
      };

      const { result } = updateObject({
        sourceObject: otelConfig,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.valuesObject.image,
            merge: (originalValue) => {
              // TypeScript should know originalValue is { repository: string; tag: string }
              const repo: string = originalValue.repository;
              const tag: string = originalValue.tag;
              return {
                repository: repo + '-contrib',
                tag: '0.131.0'
              };
            }
          });

          change({
            findKey: (parsed) => parsed.valuesObject.resources,
            merge: () => ({
              limits: {
                memory: '4Gi',
                cpu: '1000m'
              },
              requests: {
                memory: '2.5Gi',
                cpu: '750m'
              }
            })
          });
        }
      });

      // Type assertion to verify return type
      const typedResult: OtelConfig = result;
      expect(typedResult.valuesObject.image.repository).toBe('otel/opentelemetry-collector-contrib');
      expect(typedResult.valuesObject.image.tag).toBe('0.131.0');
      expect(typedResult.valuesObject.resources.limits.memory).toBe('4Gi');
    });

    it('should handle optional properties with type safety', () => {
      const config: TestConfig = {
        enabled: false,
        mode: 'development',
        settings: {
          timeout: 1000,
          retries: 3
        },
        features: {
          authentication: {
            enabled: false,
            provider: 'local'
          }
        }
      };

      const { result } = updateObject({
        sourceObject: config,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: (originalValue) => {
              // TypeScript should know replicas is optional (number | undefined)
              const replicas: number | undefined = originalValue.replicas;
              return {
                replicas: (replicas || 0) + 1
              };
            }
          });
        }
      });

      expect(result.replicas).toBe(1);
    });

    it('should infer types for nested paths correctly', () => {
      const otelConfig: OtelConfig = {
        enabled: true,
        chartVersion: '0.130.1',
        valuesObject: {
          mode: 'deployment',
          image: {
            repository: 'otel/opentelemetry-collector',
            tag: '0.130.0'
          },
          presets: {
            kubernetesAttributes: {
              enabled: true
            }
          },
          config: {
            processors: {
              batch: {}
            },
            exporters: {}
          },
          resources: {
            limits: {
              memory: '1Gi',
              cpu: '500m'
            },
            requests: {
              memory: '512Mi',
              cpu: '250m'
            }
          }
        }
      };

      const { result } = updateObject({
        sourceObject: otelConfig,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.valuesObject.config.processors,
            merge: (originalValue) => {
              // TypeScript should know originalValue is { [key: string]: any }
              const processors: { [key: string]: any } = originalValue;
              return {
                ...processors,
                'resource/add-cluster': {
                  attributes: [
                    {
                      key: 'cluster',
                      value: 'test-cluster',
                      action: 'insert'
                    }
                  ]
                }
              };
            }
          });
        }
      });

      expect(result.valuesObject.config.processors['resource/add-cluster']).toBeDefined();
      expect(result.valuesObject.config.processors['resource/add-cluster'].attributes).toHaveLength(1);
    });

    it('should track types correctly when accessing originalValue properties', () => {
      interface ServerConfig {
        host: string;
        port: number;
        ssl: boolean;
        options: {
          timeout: number;
          maxRetries: number;
        };
      }

      const config: ServerConfig = {
        host: 'localhost',
        port: 3000,
        ssl: false,
        options: {
          timeout: 5000,
          maxRetries: 3
        }
      };

      const { result } = updateObject({
        sourceObject: config,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.options,
            merge: (originalValue) => {
              // TypeScript should know: originalValue is { timeout: number; maxRetries: number }
              // These type assertions will fail at compile time if types are wrong
              const timeout: number = originalValue.timeout;
              const retries: number = originalValue.maxRetries;

              // This should be type-safe - we're returning Partial<L>
              return {
                timeout: timeout * 2,
                maxRetries: retries + 2
              };
            }
          });
        }
      });

      expect(result.options.timeout).toBe(10000);
      expect(result.options.maxRetries).toBe(5);
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(3000);
    });

    it('should allow adding new properties to objects while maintaining type safety for existing properties', () => {
      interface ProcessorConfig {
        batch: Record<string, any>;
      }

      const config: ProcessorConfig = {
        batch: {}
      };

      const { result } = updateObject({
        sourceObject: config,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: (originalValue) => {
              // TypeScript knows: originalValue is ProcessorConfig
              // We can access existing properties with type safety
              const existingBatch: Record<string, any> = originalValue.batch;

              // We can return BOTH existing properties AND new ones
              return {
                batch: existingBatch,                           // existing property
                'resource/add-cluster': {                       // NEW property
                  attributes: [
                    {
                      key: 'cluster',
                      value: 'test-cluster',
                      action: 'insert'
                    }
                  ]
                }
              };
            }
          });
        }
      });

      expect(result.batch).toEqual({});
      expect((result as any)['resource/add-cluster']).toEqual({
        attributes: [
          {
            key: 'cluster',
            value: 'test-cluster',
            action: 'insert'
          }
        ]
      });
    });
  });

  describe('basic merge functionality', () => {
    it('should merge simple object at root level', () => {
      const sourceObject = {
        enabled: false,
        mode: 'development'
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              enabled: true,
              namespaceOverride: 'production'
            })
          });
        }
      });

      expect(result).toEqual({
        enabled: true,
        mode: 'development',
        namespaceOverride: 'production'
      });
    });

    it('should merge nested objects', () => {
      const sourceObject = {
        config: {
          processors: {
            batch: {}
          }
        }
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.config.processors,
            merge: () => ({
              'resource/add-cluster': {
                attributes: [
                  {
                    key: 'cluster',
                    value: 'test-cluster',
                    action: 'insert'
                  }
                ]
              }
            })
          });
        }
      });

      expect(result.config.processors).toEqual({
        batch: {},
        'resource/add-cluster': {
          attributes: [
            {
              key: 'cluster',
              value: 'test-cluster',
              action: 'insert'
            }
          ]
        }
      });
    });
  });

  describe('merge with Symbol instructions', () => {
    it('should merge arrays by contents using Symbol.for("merge") inline', () => {
      const sourceObject = {
        config: {
          processors: {
            batch: {},
            memory_limiter: {}
          }
        }
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.config,
            merge: () => ({
              ...addInstructions({
                prop: 'processors',
                mergeByContents: true
              }),
              processors: {
                batch: {},
                memory_limiter: {},
                k8sattributes: {}
              }
            })
          });
        }
      });

      // Should merge by contents without duplication
      expect(result.config.processors).toEqual({
        batch: {},
        memory_limiter: {},
        k8sattributes: {}
      });
    });

    it('should merge arrays by contents in nested structure', () => {
      const sourceObject = {
        tolerations: [
          {
            effect: 'NoSchedule',
            operator: 'Exists'
          }
        ]
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              ...addInstructions({
                prop: 'tolerations',
                mergeByContents: true
              }),
              tolerations: [
                {
                  effect: 'NoSchedule',
                  operator: 'Exists'
                },
                {
                  effect: 'NoExecute',
                  operator: 'Exists'
                }
              ]
            })
          });
        }
      });

      expect(result.tolerations).toEqual([
        {
          effect: 'NoSchedule',
          operator: 'Exists'
        },
        {
          effect: 'NoExecute',
          operator: 'Exists'
        }
      ]);
      expect(result.tolerations.length).toBe(2);
    });

    it('should not duplicate when merging identical arrays by contents', () => {
      const sourceObject = {
        hosts: ['grafana.example.com']
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              ...addInstructions({
                prop: 'hosts',
                mergeByContents: true
              }),
              hosts: ['grafana.example.com']
            })
          });
        }
      });

      expect(result.hosts).toEqual(['grafana.example.com']);
      expect(result.hosts.length).toBe(1);
    });
  });

  describe('complex nested merge scenarios', () => {
    it('should handle deeply nested object with multiple merge instructions', () => {
      interface ServiceConfig {
        config: {
          service: {
            extensions: string[];
            telemetry?: {
              metrics: {
                level: string;
                address: string;
              };
            };
            pipelines: {
              logs: {
                receivers: string[];
                processors: string[];
                exporters: string[];
              };
            };
          };
        };
      }

      const sourceObject: ServiceConfig = {
        config: {
          service: {
            extensions: ['health_check'],
            pipelines: {
              logs: {
                receivers: ['otlp'],
                processors: ['batch'],
                exporters: ['debug']
              }
            }
          }
        }
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.config.service,
            merge: (originalValue) => ({
              extensions: [...originalValue.extensions],
              telemetry: {
                metrics: {
                  level: 'detailed',
                  address: '0.0.0.0:8889'
                }
              },
              ...addInstructions({
                prop: 'pipelines',
                mergeByContents: true
              }),
              pipelines: {
                logs: {
                  receivers: [...originalValue.pipelines.logs.receivers],
                  ...addInstructions({
                    prop: 'processors',
                    mergeByContents: true
                  }),
                  processors: [
                    'memory_limiter',
                    'k8sattributes',
                    'batch'
                  ],
                  ...addInstructions({
                    prop: 'exporters',
                    mergeByContents: true
                  }),
                  exporters: ['otlp', 'debug']
                }
              }
            })
          });
        }
      });

      expect(result.config.service.telemetry).toEqual({
        metrics: {
          level: 'detailed',
          address: '0.0.0.0:8889'
        }
      });
      expect(result.config.service.pipelines.logs.processors).toEqual([
        'batch',
        'memory_limiter',
        'k8sattributes'
      ]);
      expect(result.config.service.pipelines.logs.exporters).toEqual(['debug', 'otlp']);
    });

    it('should merge complex otel-collector style configuration', () => {
      interface OtelCollectorConfig {
        enabled: boolean;
        valuesObject: {
          mode: string;
          enabled?: boolean;
          nameOverride?: string;
          fullnameOverride?: string;
          namespaceOverride?: string;
          image?: {
            repository: string;
            tag: string;
          };
          presets?: {
            logsCollection?: {
              enabled: boolean;
              includeCollectorLogs: boolean;
              storeCheckpoints: boolean;
            };
            kubernetesAttributes?: {
              enabled: boolean;
              extractAllPodLabels: boolean;
            };
          };
          config?: {
            processors?: {
              [key: string]: any;
            };
            exporters?: {
              [key: string]: any;
            };
          };
        };
      }

      const sourceObject: OtelCollectorConfig = {
        enabled: false,
        valuesObject: {
          mode: 'deployment'
        }
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.valuesObject,
            merge: () => ({
              enabled: true,
              mode: 'daemonset',
              nameOverride: 'otel-collector-daemonset',
              fullnameOverride: 'otel-collector-daemonset',
              namespaceOverride: 'observability',
              ...addInstructions({
                prop: 'image',
                mergeByContents: true
              }),
              image: {
                repository: 'otel/opentelemetry-collector-contrib',
                tag: '0.131.0'
              },
              ...addInstructions({
                prop: 'presets',
                mergeByContents: true
              }),
              presets: {
                logsCollection: {
                  enabled: true,
                  includeCollectorLogs: false,
                  storeCheckpoints: true
                },
                kubernetesAttributes: {
                  enabled: true,
                  extractAllPodLabels: true
                }
              },
              ...addInstructions({
                prop: 'config',
                mergeByContents: true
              }),
              config: {
                ...addInstructions({
                  prop: 'processors',
                  mergeByContents: true
                }),
                processors: {
                  'resource/add-cluster': {
                    attributes: [
                      {
                        key: 'cluster',
                        value: 'test-cluster',
                        action: 'insert'
                      }
                    ]
                  }
                },
                ...addInstructions({
                  prop: 'exporters',
                  mergeByContents: true
                }),
                exporters: {
                  otlp: {
                    endpoint: 'opentelemetry-collector.observability:4317',
                    tls: {
                      insecure: true
                    }
                  }
                }
              }
            })
          });
        }
      });

      expect(result.valuesObject.enabled).toBe(true);
      expect(result.valuesObject.mode).toBe('daemonset');
      expect(result.valuesObject.nameOverride).toBe('otel-collector-daemonset');
      expect(result.valuesObject.image).toEqual({
        repository: 'otel/opentelemetry-collector-contrib',
        tag: '0.131.0'
      });
      expect(result.valuesObject.presets).toEqual({
        logsCollection: {
          enabled: true,
          includeCollectorLogs: false,
          storeCheckpoints: true
        },
        kubernetesAttributes: {
          enabled: true,
          extractAllPodLabels: true
        }
      });
      expect(result.valuesObject.config!.processors).toEqual({
        'resource/add-cluster': {
          attributes: [
            {
              key: 'cluster',
              value: 'test-cluster',
              action: 'insert'
            }
          ]
        }
      });
    });
  });

  describe('multiple merge operations', () => {
    it('should handle multiple change calls in sequence', () => {
      const sourceObject = {
        valuesObject: {
          image: {},
          presets: {},
          resources: {}
        }
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.valuesObject.image,
            merge: () => ({
              repository: 'otel/opentelemetry-collector-contrib',
              tag: '0.131.0'
            })
          });

          change({
            findKey: (parsed) => parsed.valuesObject.presets,
            merge: () => ({
              clusterMetrics: {
                enabled: true
              },
              kubernetesAttributes: {
                enabled: true,
                extractAllPodLabels: true
              }
            })
          });

          change({
            findKey: (parsed) => parsed.valuesObject.resources,
            merge: () => ({
              limits: {
                memory: '4Gi',
                cpu: '1000m'
              },
              requests: {
                memory: '2.5Gi',
                cpu: '750m'
              }
            })
          });
        }
      });

      expect(result.valuesObject.image).toEqual({
        repository: 'otel/opentelemetry-collector-contrib',
        tag: '0.131.0'
      });
      expect(result.valuesObject.presets).toEqual({
        clusterMetrics: {
          enabled: true
        },
        kubernetesAttributes: {
          enabled: true,
          extractAllPodLabels: true
        }
      });
      expect(result.valuesObject.resources).toEqual({
        limits: {
          memory: '4Gi',
          cpu: '1000m'
        },
        requests: {
          memory: '2.5Gi',
          cpu: '750m'
        }
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty source object', () => {
      interface EmptyConfig {
        enabled?: boolean;
        mode?: string;
      }

      const sourceObject: EmptyConfig = {};

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              enabled: true,
              mode: 'deployment'
            })
          });
        }
      });

      expect(result).toEqual({
        enabled: true,
        mode: 'deployment'
      });
    });

    it('should handle undefined nested paths by creating them', () => {
      interface ConfigWithProcessors {
        config?: {
          processors?: {
            batch?: Record<string, any>;
          };
        };
      }

      const sourceObject: ConfigWithProcessors = {};

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              config: {
                processors: {
                  batch: {}
                }
              }
            })
          });
        }
      });

      expect(result.config!.processors!.batch).toEqual({});
    });

    it('should override primitive values with new values', () => {
      const sourceObject = {
        enabled: false,
        mode: 'development',
        replicas: 1
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              enabled: true,
              replicas: 3
            })
          });
        }
      });

      expect(result.enabled).toBe(true);
      expect(result.mode).toBe('development');
      expect(result.replicas).toBe(3);
    });

    it('should handle null values gracefully', () => {
      interface ConfigWithNull {
        config: null | {
          processors: {
            batch: Record<string, unknown>;
          };
        };
      }

      const sourceObject: ConfigWithNull = {
        config: null
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              config: {
                processors: {
                  batch: {}
                }
              }
            })
          });
        }
      });

      expect(result.config).toEqual({
        processors: {
          batch: {}
        }
      });
    });
  });

  describe('array handling', () => {
    it('should merge array items by contents without duplication', () => {
      const sourceObject = {
        items: ['item1', 'item2']
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              ...addInstructions({
                prop: 'items',
                mergeByContents: true
              }),
              items: ['item2', 'item3']  // Add 'd', deduplicate 'b' and 'c'
            })
          });
        }
      });

      expect(result.items).toEqual(['item1', 'item2', 'item3']);
      expect(result.items.length).toBe(3);
    });

    it('should handle empty arrays', () => {
      interface ItemsConfig {
        items: string[];
      }

      const sourceObject: ItemsConfig = {
        items: []
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              ...addInstructions({
                prop: 'items',
                mergeByContents: true
              }),
              items: ['item1', 'item2']
            })
          });
        }
      });

      expect(result.items).toEqual(['item1', 'item2']);
    });

    it('should merge complex object arrays by contents', () => {
      const sourceObject = {
        scrapeConfigs: [
          {
            job_name: 'kubernetes-pods',
            scrape_interval: '30s'
          }
        ]
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              ...addInstructions({
                prop: 'scrapeConfigs',
                mergeByContents: true
              }),
              scrapeConfigs: [
                {
                  job_name: 'kubernetes-pods',
                  scrape_interval: '30s'
                },
                {
                  job_name: 'node-exporter',
                  scrape_interval: '15s'
                }
              ]
            })
          });
        }
      });

      expect(result.scrapeConfigs).toEqual([
        {
          job_name: 'kubernetes-pods',
          scrape_interval: '30s'
        },
        {
          job_name: 'node-exporter',
          scrape_interval: '15s'
        }
      ]);
      expect(result.scrapeConfigs.length).toBe(2);
    });
  });

  describe('immutability', () => {
    it('should not mutate the original source object', () => {
      const sourceObject = {
        enabled: false,
        config: {
          mode: 'development'
        }
      };

      const originalSource = JSON.parse(JSON.stringify(sourceObject));

      updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              enabled: true,
              replicas: 3
            })
          });
        }
      });

      expect(sourceObject).toEqual(originalSource);
    });
  });

  describe('addInstructions - mergeByProp', () => {
    it('should merge array items by specific property', () => {
      interface JobConfig {
        jobs: Array<{
          id: string;
          name: string;
          enabled: boolean;
        }>;
      }

      const sourceObject: JobConfig = {
        jobs: [
          { id: 'job1', name: 'First Job', enabled: true },
          { id: 'job2', name: 'Second Job', enabled: false }
        ]
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              ...addInstructions({
                prop: 'jobs',
                mergeByProp: 'id'
              }),
              jobs: [
                { id: 'job2', name: 'Updated Second Job', enabled: true },
                { id: 'job3', name: 'Third Job', enabled: true }
              ]
            })
          });
        }
      });

      expect(result.jobs).toHaveLength(3);
      expect(result.jobs[0]).toEqual({ id: 'job1', name: 'First Job', enabled: true });
      expect(result.jobs[1]).toEqual({ id: 'job2', name: 'Updated Second Job', enabled: true });
      expect(result.jobs[2]).toEqual({ id: 'job3', name: 'Third Job', enabled: true });
    });

    it('should merge nested arrays by specific property', () => {
      interface ServiceConfig {
        services: Array<{
          serviceId: string;
          endpoints: Array<{
            url: string;
            protocol: string;
          }>;
        }>;
      }

      const sourceObject: ServiceConfig = {
        services: [
          {
            serviceId: 'api',
            endpoints: [
              { url: 'http://api.example.com', protocol: 'http' }
            ]
          }
        ]
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              ...addInstructions({
                prop: 'services',
                mergeByProp: 'serviceId'
              }),
              services: [
                {
                  serviceId: 'api',
                  endpoints: [
                    { url: 'https://api.example.com', protocol: 'https' }
                  ]
                },
                {
                  serviceId: 'db',
                  endpoints: [
                    { url: 'postgres://db.example.com', protocol: 'postgres' }
                  ]
                }
              ]
            })
          });
        }
      });

      expect(result.services).toHaveLength(2);
      expect(result.services[0].serviceId).toBe('api');
      // When mergeByProp merges objects, nested arrays are replaced (deep merge behavior)
      expect(result.services[0].endpoints).toHaveLength(1);
      expect(result.services[0].endpoints[0].protocol).toBe('https');
      expect(result.services[1].serviceId).toBe('db');
    });
  });

  describe('addInstructions - mergeByName', () => {
    it('should merge array items by name property', () => {
      interface EnvVarsConfig {
        envVars: Array<{
          name: string;
          value: string;
        }>;
      }

      const sourceObject: EnvVarsConfig = {
        envVars: [
          { name: 'NODE_ENV', value: 'development' },
          { name: 'PORT', value: '3000' }
        ]
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              ...addInstructions({
                prop: 'envVars',
                mergeByName: true
              }),
              envVars: [
                { name: 'NODE_ENV', value: 'production' },
                { name: 'DATABASE_URL', value: 'postgres://...' }
              ]
            })
          });
        }
      });

      expect(result.envVars).toHaveLength(3);
      expect(result.envVars.find(e => e.name === 'NODE_ENV')?.value).toBe('production');
      expect(result.envVars.find(e => e.name === 'PORT')?.value).toBe('3000');
      expect(result.envVars.find(e => e.name === 'DATABASE_URL')?.value).toBe('postgres://...');
    });

    it('should handle complex objects with name property', () => {
      interface PluginConfig {
        plugins: Array<{
          name: string;
          version: string;
          config: {
            enabled: boolean;
            options?: Record<string, any>;
          };
        }>;
      }

      const sourceObject: PluginConfig = {
        plugins: [
          {
            name: 'auth-plugin',
            version: '1.0.0',
            config: { enabled: true, options: { timeout: 5000 } }
          }
        ]
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              ...addInstructions({
                prop: 'plugins',
                mergeByName: true
              }),
              plugins: [
                {
                  name: 'auth-plugin',
                  version: '2.0.0',
                  config: { enabled: true, options: { timeout: 10000 } }
                },
                {
                  name: 'cache-plugin',
                  version: '1.5.0',
                  config: { enabled: false }
                }
              ]
            })
          });
        }
      });

      expect(result.plugins).toHaveLength(2);
      expect(result.plugins[0].version).toBe('2.0.0');
      expect(result.plugins[0].config.options?.timeout).toBe(10000);
      expect(result.plugins[1].name).toBe('cache-plugin');
    });
  });

  describe('addInstructions - multiple instructions on same object', () => {
    it('should handle multiple properties with different merge strategies', () => {
      interface ComplexConfig {
        services: Array<{ serviceId: string; url: string }>;
        envVars: Array<{ name: string; value: string }>;
        features: string[];
      }

      const sourceObject: ComplexConfig = {
        services: [{ serviceId: 'api', url: 'http://api.local' }],
        envVars: [{ name: 'ENV', value: 'dev' }],
        features: ['auth', 'logging']
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              ...addInstructions({
                prop: 'services',
                mergeByProp: 'serviceId'
              }),
              services: [
                { serviceId: 'api', url: 'https://api.prod' },
                { serviceId: 'db', url: 'postgres://db.prod' }
              ],
              ...addInstructions({
                prop: 'envVars',
                mergeByName: true
              }),
              envVars: [
                { name: 'ENV', value: 'production' },
                { name: 'PORT', value: '8080' }
              ],
              ...addInstructions({
                prop: 'features',
                mergeByContents: true
              }),
              features: ['logging', 'monitoring', 'caching']
            })
          });
        }
      });

      expect(result.services).toHaveLength(2);
      expect(result.services[0].url).toBe('https://api.prod');
      expect(result.envVars).toHaveLength(2);
      expect(result.envVars.find(e => e.name === 'ENV')?.value).toBe('production');
      expect(result.features).toEqual(['auth', 'logging', 'monitoring', 'caching']);
    });
  });

  describe('addInstructions - deeply nested instructions', () => {
    it('should handle multiple levels of nested instructions', () => {
      interface DeepConfig {
        cluster: {
          services: {
            api: {
              replicas: number;
              containers: Array<{
                name: string;
                image: string;
                ports: number[];
              }>;
            };
          };
        };
      }

      const sourceObject: DeepConfig = {
        cluster: {
          services: {
            api: {
              replicas: 1,
              containers: [
                {
                  name: 'web',
                  image: 'nginx:1.0',
                  ports: [80]
                }
              ]
            }
          }
        }
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.cluster.services.api,
            merge: () => ({
              replicas: 3,
              ...addInstructions({
                prop: 'containers',
                mergeByName: true
              }),
              containers: [
                {
                  name: 'web',
                  image: 'nginx:2.0',
                  ports: [80, 443]
                },
                {
                  name: 'worker',
                  image: 'worker:1.0',
                  ports: [9000]
                }
              ]
            })
          });
        }
      });

      expect(result.cluster.services.api.replicas).toBe(3);
      expect(result.cluster.services.api.containers).toHaveLength(2);
      expect(result.cluster.services.api.containers[0].image).toBe('nginx:2.0');
      expect(result.cluster.services.api.containers[1].name).toBe('worker');
    });
  });

  describe('addInstructions - edge cases', () => {
    it('should handle empty arrays with mergeByProp', () => {
      interface EmptyArrayConfig {
        items: Array<{ id: string; value: string }>;
      }

      const sourceObject: EmptyArrayConfig = {
        items: []
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              ...addInstructions({
                prop: 'items',
                mergeByProp: 'id'
              }),
              items: [
                { id: '1', value: 'first' },
                { id: '2', value: 'second' }
              ]
            })
          });
        }
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({ id: '1', value: 'first' });
    });

    it('should handle mergeByName when items do not have name property', () => {
      interface NoNameConfig {
        items: Array<{ id: string; value: string }>;
      }

      const sourceObject: NoNameConfig = {
        items: [{ id: '1', value: 'original' }]
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              ...addInstructions({
                prop: 'items',
                mergeByName: true
              }),
              items: [
                { id: '2', value: 'new' }
              ]
            })
          });
        }
      });

      // Should append since no name property exists
      expect(result.items).toHaveLength(2);
    });

    it('should handle duplicate entries with mergeByProp', () => {
      interface DuplicateConfig {
        entries: Array<{ key: string; value: number }>;
      }

      const sourceObject: DuplicateConfig = {
        entries: [
          { key: 'a', value: 1 },
          { key: 'b', value: 2 }
        ]
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              ...addInstructions({
                prop: 'entries',
                mergeByProp: 'key'
              }),
              entries: [
                { key: 'a', value: 10 },
                { key: 'a', value: 20 }, // Duplicate key
                { key: 'c', value: 3 }
              ]
            })
          });
        }
      });

      // Should merge by key, last one wins for duplicates
      expect(result.entries).toHaveLength(3);
      expect(result.entries.find(e => e.key === 'a')?.value).toBe(20);
    });

    it('should handle mixed primitive and object arrays with mergeByContents', () => {
      interface MixedArrayConfig {
        primitives: (string | number)[];
        objects: Array<{ type: string } | string>;
      }

      const sourceObject: MixedArrayConfig = {
        primitives: [1, 'a', 2],
        objects: [{ type: 'obj1' }, 'string1']
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              ...addInstructions({
                prop: 'primitives',
                mergeByContents: true
              }),
              primitives: [2, 'b', 3],
              ...addInstructions({
                prop: 'objects',
                mergeByContents: true
              }),
              objects: [{ type: 'obj1' }, 'string2']
            })
          });
        }
      });

      expect(result.primitives).toEqual([1, 'a', 2, 'b', 3]);
      expect(result.objects).toHaveLength(3);
    });
  });

  describe('addInstructions - real-world scenarios', () => {
    it('should handle Kubernetes-style resource configuration', () => {
      interface K8sConfig {
        apiVersion: string;
        kind: string;
        metadata: {
          name: string;
          labels?: Record<string, string>;
          annotations?: Record<string, string>;
        };
        spec: {
          replicas: number;
          selector: {
            matchLabels: Record<string, string>;
          };
          template: {
            spec: {
              containers: Array<{
                name: string;
                image: string;
                ports?: Array<{
                  containerPort: number;
                  protocol: string;
                }>;
                env?: Array<{
                  name: string;
                  value: string;
                }>;
              }>;
            };
          };
        };
      }

      const sourceObject: K8sConfig = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'my-app'
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: { app: 'my-app' }
          },
          template: {
            spec: {
              containers: [
                {
                  name: 'app',
                  image: 'my-app:1.0',
                  env: [
                    { name: 'ENV', value: 'dev' }
                  ]
                }
              ]
            }
          }
        }
      };

      const { result } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.spec.template.spec,
            merge: () => ({
              ...addInstructions({
                prop: 'containers',
                mergeByName: true
              }),
              containers: [
                {
                  name: 'app',
                  image: 'my-app:2.0',
                  ports: [
                    { containerPort: 8080, protocol: 'TCP' }
                  ],
                  env: [
                    { name: 'ENV', value: 'production' },
                    { name: 'PORT', value: '8080' }
                  ]
                },
                {
                  name: 'sidecar',
                  image: 'sidecar:1.0',
                  ports: [
                    { containerPort: 9090, protocol: 'TCP' }
                  ]
                }
              ]
            })
          });
        }
      });

      expect(result.spec.template.spec.containers).toHaveLength(2);
      expect(result.spec.template.spec.containers[0].image).toBe('my-app:2.0');
      expect(result.spec.template.spec.containers[0].ports).toHaveLength(1);
      expect(result.spec.template.spec.containers[1].name).toBe('sidecar');
    });
  });

  describe('comment tracking', () => {
    it('should track comments for root-level changes', () => {
      interface Config {
        enabled: boolean;
        mode: string;
      }

      const sourceObject: Config = {
        enabled: false,
        mode: 'development'
      };

      const { result, comments } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              enabled: true,
              mode: 'production'
            }),
            comment: () => ({
              text: 'Switched to production configuration',
              direction: 'right'
            })
          });
        }
      });

      expect(result.enabled).toBe(true);
      expect(comments).toHaveLength(1);
      expect(comments[0]).toEqual({
        path: [],
        comment: 'Switched to production configuration',
        direction: 'right'
      });
    });

    it('should track comments for nested changes', () => {
      interface ServerConfig {
        server: {
          host: string;
          port: number;
        };
      }

      const sourceObject: ServerConfig = {
        server: {
          host: 'localhost',
          port: 3000
        }
      };

      const { result, comments } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.server,
            merge: () => ({
              host: '0.0.0.0',
              port: 8080
            }),
            comment: () => ({
              text: 'Updated server to listen on all interfaces',
              direction: 'up'
            })
          });
        }
      });

      expect(result.server.host).toBe('0.0.0.0');
      expect(comments).toHaveLength(1);
      expect(comments[0]).toEqual({
        path: ['server'],
        comment: 'Updated server to listen on all interfaces',
        direction: 'up'
      });
    });

    it('should track multiple comments from different changes', () => {
      interface AppConfig {
        database: {
          host: string;
          port: number;
        };
        cache: {
          enabled: boolean;
          ttl: number;
        };
      }

      const sourceObject: AppConfig = {
        database: {
          host: 'localhost',
          port: 5432
        },
        cache: {
          enabled: false,
          ttl: 300
        }
      };

      const { result, comments } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.database,
            merge: () => ({
              host: 'db.production.com',
              port: 5432
            }),
            comment: () => ({
              text: 'Updated to production database',
              direction: 'right'
            })
          });

          change({
            findKey: (parsed) => parsed.cache,
            merge: () => ({
              enabled: true,
              ttl: 3600
            }),
            comment: () => ({
              text: 'Enabled caching with 1 hour TTL',
              direction: 'left'
            })
          });
        }
      });

      expect(result.database.host).toBe('db.production.com');
      expect(result.cache.enabled).toBe(true);
      expect(comments).toHaveLength(2);
      expect(comments[0].comment).toBe('Updated to production database');
      expect(comments[0].path).toEqual(['database']);
      expect(comments[1].comment).toBe('Enabled caching with 1 hour TTL');
      expect(comments[1].path).toEqual(['cache']);
    });

    it('should track comments with deeply nested paths', () => {
      interface ClusterConfig {
        cluster: {
          nodes: {
            primary: {
              replicas: number;
            };
          };
        };
      }

      const sourceObject: ClusterConfig = {
        cluster: {
          nodes: {
            primary: {
              replicas: 1
            }
          }
        }
      };

      const { result, comments } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.cluster.nodes.primary,
            merge: () => ({
              replicas: 3
            }),
            comment: () => ({
              text: 'Scaled up primary nodes for high availability',
              direction: 'down'
            })
          });
        }
      });

      expect(result.cluster.nodes.primary.replicas).toBe(3);
      expect(comments).toHaveLength(1);
      expect(comments[0]).toEqual({
        path: ['cluster', 'nodes', 'primary'],
        comment: 'Scaled up primary nodes for high availability',
        direction: 'down'
      });
    });

    it('should handle changes without comments', () => {
      interface Config {
        enabled: boolean;
      }

      const sourceObject: Config = {
        enabled: false
      };

      const { result, comments } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              enabled: true
            })
            // No comment provided
          });
        }
      });

      expect(result.enabled).toBe(true);
      expect(comments).toHaveLength(0);
    });

    it('should handle comment function returning undefined', () => {
      interface Config {
        enabled: boolean;
      }

      const sourceObject: Config = {
        enabled: false
      };

      const { result, comments } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed,
            merge: () => ({
              enabled: true
            }),
            comment: () => undefined
          });
        }
      });

      expect(result.enabled).toBe(true);
      expect(comments).toHaveLength(0);
    });

    it('should support all comment directions', () => {
      interface DirectionsConfig {
        up: string;
        down: string;
        left: string;
        right: string;
      }

      const sourceObject: DirectionsConfig = {
        up: 'a',
        down: 'b',
        left: 'c',
        right: 'd'
      };

      const { comments } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.up,
            merge: () => 'A',
            comment: () => ({ text: 'Up comment', direction: 'up' })
          });
          change({
            findKey: (parsed) => parsed.down,
            merge: () => 'B',
            comment: () => ({ text: 'Down comment', direction: 'down' })
          });
          change({
            findKey: (parsed) => parsed.left,
            merge: () => 'C',
            comment: () => ({ text: 'Left comment', direction: 'left' })
          });
          change({
            findKey: (parsed) => parsed.right,
            merge: () => 'D',
            comment: () => ({ text: 'Right comment', direction: 'right' })
          });
        }
      });

      expect(comments).toHaveLength(4);
      expect(comments[0].direction).toBe('up');
      expect(comments[1].direction).toBe('down');
      expect(comments[2].direction).toBe('left');
      expect(comments[3].direction).toBe('right');
    });

    it('should track comments with addInstructions usage', () => {
      interface ProcessorConfig {
        processors: {
          batch: Record<string, unknown>;
          memory_limiter?: { limit_mib: number };
        };
      }

      const sourceObject: ProcessorConfig = {
        processors: {
          batch: {}
        }
      };

      const { result, comments } = updateObject({
        sourceObject,
        annotate: ({ change }) => {
          change({
            findKey: (parsed) => parsed.processors,
            merge: () => ({
              ...addInstructions({
                prop: 'batch',
                mergeByContents: true
              }),
              batch: {},
              memory_limiter: { limit_mib: 512 }
            }),
            comment: () => ({
              text: 'Added memory limiter processor for stability',
              direction: 'right'
            })
          });
        }
      });

      expect(result.processors.memory_limiter).toBeDefined();
      expect(comments).toHaveLength(1);
      expect(comments[0]).toEqual({
        path: ['processors'],
        comment: 'Added memory limiter processor for stability',
        direction: 'right'
      });
    });
  });
});
