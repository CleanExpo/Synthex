import swaggerJsdoc from 'swagger-jsdoc';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Synthex Marketing Platform API',
      version: '1.0.0',
      description: 'AI-Powered Marketing Content Generation and Optimization Platform',
      termsOfService: 'https://synthex.ai/terms',
      contact: {
        name: 'Synthex Support',
        email: 'support@synthex.ai',
        url: 'https://synthex.ai/support'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server'
      },
      {
        url: 'https://synthex.vercel.app/api/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API Key for external access'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Error message'
            },
            metadata: {
              type: 'object',
              properties: {
                timestamp: {
                  type: 'string',
                  format: 'date-time'
                },
                version: {
                  type: 'string',
                  example: 'v1'
                }
              }
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object'
            },
            message: {
              type: 'string'
            },
            metadata: {
              type: 'object',
              properties: {
                timestamp: {
                  type: 'string',
                  format: 'date-time'
                },
                version: {
                  type: 'string',
                  example: 'v1'
                }
              }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'clh1234567890'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com'
            },
            name: {
              type: 'string',
              example: 'John Doe'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            preferences: {
              type: 'object'
            }
          }
        },
        MarketingContent: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            content: {
              type: 'string',
              example: 'Generated marketing content'
            },
            platform: {
              type: 'string',
              enum: ['instagram', 'twitter', 'linkedin', 'facebook', 'email'],
              example: 'instagram'
            },
            optimizations: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            metadata: {
              type: 'object',
              properties: {
                hashtags: {
                  type: 'array',
                  items: {
                    type: 'string'
                  }
                },
                emojis: {
                  type: 'array',
                  items: {
                    type: 'string'
                  }
                },
                sentiment: {
                  type: 'string',
                  enum: ['positive', 'neutral', 'negative']
                }
              }
            }
          }
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              example: 1
            },
            limit: {
              type: 'integer',
              example: 20
            },
            total: {
              type: 'integer',
              example: 100
            },
            hasNext: {
              type: 'boolean',
              example: true
            },
            hasPrev: {
              type: 'boolean',
              example: false
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        NotFoundError: {
          description: 'The specified resource was not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Content Generation',
        description: 'AI-powered content generation endpoints'
      },
      {
        name: 'Content Optimization',
        description: 'Content optimization and enhancement endpoints'
      },
      {
        name: 'Analytics',
        description: 'Analytics and reporting endpoints'
      },
      {
        name: 'User Management',
        description: 'User profile and settings management'
      },
      {
        name: 'AI Models',
        description: 'AI model configuration and management'
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/routes/v1/*.ts',
    './src/swagger/*.yaml'
  ]
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);