import type { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Webhook Task Processor API',
      version: '1.0.0',
      description:
        'Interactive API reference for webhook ingestion, pipeline management, manual trigger, and subscriber connectors.',
    },
    servers: [
      {
        url: '/api',
      },
    ],
    tags: [
      { name: 'Webhooks', description: 'Inbound webhook ingestion and task status tracking' },
      { name: 'Pipelines', description: 'Pipeline CRUD and execution controls' },
      { name: 'Subscribers', description: 'Outbound connector subscriber management' },
      { name: 'Tasks', description: 'Task processing history and status timeline' },
    ],
    components: {
      schemas: {
        ApiError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Internal server error' },
          },
        },
        Pipeline: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx123pipeline' },
            name: { type: 'string', example: 'Orders Pipeline' },
            description: { type: 'string', nullable: true, example: 'Routes ecommerce order events' },
            actionType: {
              type: 'string',
              enum: ['CONVERTER', 'EMAIL', 'DISCORD', 'PDF', 'AI_SUMMARIZER'],
              example: 'CONVERTER',
            },
            rateLimit: { type: 'integer', minimum: 1, maximum: 1000, default: 60, example: 120 },
            enabledActions: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['CONVERTER', 'EMAIL', 'DISCORD', 'PDF', 'AI_SUMMARIZER'],
              },
              example: ['CONVERTER', 'AI_SUMMARIZER', 'PDF', 'EMAIL', 'DISCORD'],
            },
            emailEnabled: { type: 'boolean', example: true },
            discordEnabled: { type: 'boolean', example: true },
            isActive: { type: 'boolean', example: true },
            config: { type: 'object', additionalProperties: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PipelineWithSubscribers: {
          allOf: [
            {
              $ref: '#/components/schemas/Pipeline',
            },
            {
              type: 'object',
              properties: {
                subscribers: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Subscriber',
                  },
                },
              },
            },
          ],
        },
        PipelineInput: {
          type: 'object',
          required: ['name', 'actionType'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255, example: 'Orders Pipeline' },
            description: { type: 'string', example: 'Processes order webhooks end-to-end' },
            actionType: {
              type: 'string',
              enum: ['CONVERTER', 'EMAIL', 'DISCORD', 'PDF', 'AI_SUMMARIZER'],
              example: 'CONVERTER',
            },
            rateLimit: { type: 'integer', minimum: 1, maximum: 1000, default: 60, example: 60 },
            enabledActions: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['CONVERTER', 'EMAIL', 'DISCORD', 'PDF', 'AI_SUMMARIZER'],
              },
            },
            emailEnabled: { type: 'boolean', example: true },
            discordEnabled: { type: 'boolean', example: true },
            config: { type: 'object', additionalProperties: true },
          },
        },
        Subscriber: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx123subscriber' },
            pipelineId: { type: 'string', example: 'clx123pipeline' },
            targetUrl: { type: 'string', format: 'uri', example: 'https://integrator.example.com/events' },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        SubscriberInput: {
          type: 'object',
          required: ['targetUrl'],
          properties: {
            targetUrl: { type: 'string', format: 'uri', example: 'https://integrator.example.com/events' },
          },
        },
        TriggerInput: {
          type: 'object',
          required: ['payload'],
          properties: {
            payload: { type: 'object', additionalProperties: true },
            eventType: { type: 'string', example: 'order.created' },
          },
        },
        WebhookIngestionAccepted: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Webhook accepted for processing' },
            logId: { type: 'string', example: 'clx123task' },
            jobId: { type: 'string', example: 'job_6f3b9ce9' },
            status: { type: 'string', example: 'pending' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation completed successfully' },
            data: {
              oneOf: [
                { type: 'object', additionalProperties: true },
                {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: true,
                  },
                },
              ],
            },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx123task' },
            pipelineId: { type: 'string', example: 'clx123pipeline' },
            webhookId: { type: 'string', nullable: true, example: 'clx123webhook' },
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed', 'stuck'],
              example: 'pending',
            },
            payload: { type: 'object', additionalProperties: true },
            attempts: { type: 'integer', minimum: 0, example: 0 },
            maxAttempts: { type: 'integer', minimum: 1, example: 5 },
            result: { oneOf: [{ type: 'object', additionalProperties: true }, { type: 'string' }, { type: 'null' }] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, example: 1 },
            limit: { type: 'integer', minimum: 1, example: 50 },
            total: { type: 'integer', minimum: 0, example: 120 },
            totalPages: { type: 'integer', minimum: 1, example: 3 },
          },
        },
      },
    },
    paths: {
      '/webhooks/{pipelineId}': {
        post: {
          summary: 'Inbound Webhook',
          description: 'Ingest an inbound webhook payload and enqueue processing for the target pipeline.',
          tags: ['Webhooks'],
          parameters: [
            {
              in: 'path',
              name: 'pipelineId',
              required: true,
              description: 'Pipeline identifier.',
              schema: { type: 'string', example: 'clx123pipeline' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
                example: {
                  eventType: 'order.created',
                  orderId: 'ORD-1001',
                  total: 149.99,
                },
              },
            },
          },
          responses: {
            202: {
              description: 'Webhook accepted for processing',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/WebhookIngestionAccepted' },
                },
              },
            },
            400: { description: 'Invalid payload or routing mismatch' },
            404: { description: 'Pipeline or webhook configuration not found' },
            429: { description: 'Too many requests' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/pipelines': {
        get: {
          summary: 'List all',
          description: 'List all pipelines with subscriber metadata.',
          tags: ['Pipelines'],
          responses: {
            200: {
              description: 'Pipelines retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Retrieved 2 pipeline(s)' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/PipelineWithSubscribers' },
                      },
                    },
                  },
                },
              },
            },
            500: { description: 'Internal server error' },
          },
        },
        post: {
          summary: 'Create new',
          description: 'Create a new pipeline.',
          tags: ['Pipelines'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PipelineInput' },
              },
            },
          },
          responses: {
            201: {
              description: 'Pipeline created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Pipeline created successfully' },
                      data: { $ref: '#/components/schemas/Pipeline' },
                    },
                  },
                },
              },
            },
            400: { description: 'Validation error' },
            409: { description: 'Pipeline with this name already exists' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/pipelines/{id}/trigger': {
        post: {
          summary: 'Manual Execution',
          description: 'Trigger pipeline execution manually with a custom payload.',
          tags: ['Pipelines'],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              description: 'Pipeline identifier.',
              schema: { type: 'string', example: 'clx123pipeline' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TriggerInput' },
                example: {
                  eventType: 'order.created',
                  payload: {
                    orderId: 'ORD-1001',
                    total: 149.99,
                  },
                },
              },
            },
          },
          responses: {
            202: {
              description: 'Pipeline trigger accepted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Pipeline trigger accepted' },
                      data: {
                        type: 'object',
                        properties: {
                          taskId: { type: 'string', example: 'clx123task' },
                          jobId: { type: 'string', example: 'job_6f3b9ce9' },
                          status: { type: 'string', example: 'pending' },
                          webhookId: { type: 'string', nullable: true, example: 'clx123webhook' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: 'Validation error' },
            404: { description: 'Pipeline or event webhook not found' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/pipelines/{id}/subscribers': {
        post: {
          summary: 'Add Outbound Connectors',
          description: 'Add an outbound subscriber URL to a pipeline.',
          tags: ['Subscribers'],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              description: 'Pipeline identifier.',
              schema: { type: 'string', example: 'clx123pipeline' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SubscriberInput' },
              },
            },
          },
          responses: {
            201: {
              description: 'Subscriber added',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Subscriber added successfully' },
                      data: { $ref: '#/components/schemas/Subscriber' },
                    },
                  },
                },
              },
            },
            400: { description: 'Validation error' },
            404: { description: 'Pipeline not found' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/tasks': {
        get: {
          summary: 'List processing history',
          description: 'List processing tasks for dashboard history with filters and pagination.',
          tags: ['Tasks'],
          parameters: [
            {
              in: 'query',
              name: 'page',
              required: false,
              schema: { type: 'integer', minimum: 1, default: 1 },
            },
            {
              in: 'query',
              name: 'limit',
              required: false,
              schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
            },
            {
              in: 'query',
              name: 'status',
              required: false,
              schema: { type: 'string' },
            },
            {
              in: 'query',
              name: 'pipelineId',
              required: false,
              schema: { type: 'string' },
            },
            {
              in: 'query',
              name: 'riskLevel',
              required: false,
              schema: {
                type: 'string',
                enum: ['Low', 'Medium', 'High'],
              },
            },
          ],
          responses: {
            200: {
              description: 'Task history retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Task' },
                      },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
            400: { description: 'Invalid query parameters' },
            500: { description: 'Internal server error' },
          },
        },
      },
    },
  },
  // Explicit OpenAPI object only; no runtime JSDoc scanning.
  apis: [],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export function setupSwaggerDocs(app: Express): void {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Webhook Task Processor API Docs',
      explorer: true,
      swaggerOptions: {
        docExpansion: 'none',
        filter: true,
      },
    })
  );
}
