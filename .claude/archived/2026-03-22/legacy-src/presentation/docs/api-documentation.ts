/**
 * API Documentation Generator
 * Provides comprehensive OpenAPI/Swagger documentation for the 3-tier API
 */

export const apiDocumentation = {
  openapi: '3.0.0',
  info: {
    title: 'SYNTHEX Auto Marketing Platform API',
    version: '1.0.0',
    description: `
# SYNTHEX API Documentation

A comprehensive 3-tier enterprise API for automated marketing platform management.

## Architecture Overview

The SYNTHEX API follows a strict 3-tier architecture:

- **Presentation Layer**: REST API endpoints with authentication, validation, and error handling
- **Business Logic Layer**: Core business services with caching, security, and monitoring
- **Data Access Layer**: Repository pattern with Unit of Work and advanced ORM features

## Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Granular permissions system
- **Rate Limiting**: Comprehensive rate limiting across all endpoints
- **Monitoring**: Built-in metrics and health checks
- **Caching**: Redis-based caching with in-memory fallback
- **Message Queues**: Async processing with retry and dead letter queues
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Structured error responses with correlation IDs

## Getting Started

1. Obtain your API credentials
2. Authenticate to get a JWT token
3. Include the token in the Authorization header: \`Bearer <token>\`
4. Make API requests to the available endpoints

## Rate Limits

- General API: 100 requests per 15 minutes
- Authentication: 20 requests per minute
- User operations: 50 requests per minute

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "success": false,
  "message": "Error description",
  "errors": [{
    "code": "ERROR_CODE",
    "message": "Detailed error message",
    "field": "fieldName" // Optional
  }],
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "correlationId": "req_123456789",
    "errorType": "ValidationError"
  }
}
\`\`\`
    `,
    contact: {
      name: 'SYNTHEX API Support',
      email: 'api-support@synthex.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Production API V1'
    },
    {
      url: 'http://localhost:3000/api/v1',
      description: 'Development Server'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from authentication endpoint'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique user identifier'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          firstName: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'User first name'
          },
          lastName: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'User last name'
          },
          role: {
            type: 'string',
            enum: ['user', 'admin', 'moderator', 'editor'],
            description: 'User role'
          },
          permissions: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'User permissions'
          },
          isActive: {
            type: 'boolean',
            description: 'Whether the user account is active'
          },
          tenantId: {
            type: 'string',
            format: 'uuid',
            description: 'Tenant identifier for multi-tenant setup'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          },
          lastLoginAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last login timestamp'
          }
        },
        required: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'createdAt', 'updatedAt']
      },
      CreateUserRequest: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          password: {
            type: 'string',
            minLength: 8,
            description: 'User password (must contain uppercase, lowercase, number, and special character)'
          },
          firstName: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'User first name'
          },
          lastName: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'User last name'
          },
          role: {
            type: 'string',
            enum: ['user', 'admin', 'moderator', 'editor'],
            description: 'User role (optional, defaults to "user")'
          },
          permissions: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'User permissions (optional)'
          },
          tenantId: {
            type: 'string',
            format: 'uuid',
            description: 'Tenant identifier (optional)'
          }
        },
        required: ['email', 'password', 'firstName', 'lastName']
      },
      UpdateUserRequest: {
        type: 'object',
        properties: {
          firstName: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'User first name'
          },
          lastName: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'User last name'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          role: {
            type: 'string',
            enum: ['user', 'admin', 'moderator', 'editor'],
            description: 'User role (requires admin permissions)'
          },
          permissions: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'User permissions (requires admin permissions)'
          },
          isActive: {
            type: 'boolean',
            description: 'Whether the user account is active'
          }
        }
      },
      AuthenticationRequest: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          password: {
            type: 'string',
            description: 'User password'
          }
        },
        required: ['email', 'password']
      },
      AuthenticationResponse: {
        type: 'object',
        properties: {
          user: {
            $ref: '#/components/schemas/User'
          },
          token: {
            type: 'string',
            description: 'JWT access token'
          },
          refreshToken: {
            type: 'string',
            description: 'Refresh token for obtaining new access tokens'
          },
          expiresIn: {
            type: 'integer',
            description: 'Token expiration time in seconds'
          }
        },
        required: ['user', 'token', 'refreshToken', 'expiresIn']
      },
      UserStatistics: {
        type: 'object',
        properties: {
          totalUsers: {
            type: 'integer',
            description: 'Total number of users'
          },
          activeUsers: {
            type: 'integer',
            description: 'Number of active users'
          },
          inactiveUsers: {
            type: 'integer',
            description: 'Number of inactive users'
          },
          newUsersToday: {
            type: 'integer',
            description: 'New users registered today'
          },
          newUsersThisWeek: {
            type: 'integer',
            description: 'New users registered this week'
          },
          newUsersThisMonth: {
            type: 'integer',
            description: 'New users registered this month'
          },
          usersByRole: {
            type: 'object',
            additionalProperties: {
              type: 'integer'
            },
            description: 'Number of users by role'
          },
          recentlyActiveUsers: {
            type: 'integer',
            description: 'Users active in the last 24 hours'
          }
        },
        required: ['totalUsers', 'activeUsers', 'inactiveUsers', 'newUsersToday', 'newUsersThisWeek', 'newUsersThisMonth', 'usersByRole', 'recentlyActiveUsers']
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the operation was successful'
          },
          data: {
            description: 'Response data (varies by endpoint)'
          },
          message: {
            type: 'string',
            description: 'Human-readable message'
          },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code'
                },
                message: {
                  type: 'string',
                  description: 'Error message'
                },
                field: {
                  type: 'string',
                  description: 'Field that caused the error (optional)'
                }
              },
              required: ['code', 'message']
            },
            description: 'Array of errors (present on failure)'
          },
          metadata: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Response timestamp'
              },
              correlationId: {
                type: 'string',
                description: 'Request correlation ID'
              },
              pagination: {
                type: 'object',
                properties: {
                  page: {
                    type: 'integer',
                    description: 'Current page number'
                  },
                  limit: {
                    type: 'integer',
                    description: 'Items per page'
                  },
                  total: {
                    type: 'integer',
                    description: 'Total number of items'
                  },
                  hasMore: {
                    type: 'boolean',
                    description: 'Whether there are more pages'
                  }
                },
                description: 'Pagination metadata (for paginated responses)'
              }
            }
          }
        },
        required: ['success', 'metadata']
      },
      HealthCheck: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'unhealthy'],
            description: 'Overall health status'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Health check timestamp'
          },
          version: {
            type: 'string',
            description: 'Application version'
          },
          uptime: {
            type: 'number',
            description: 'Application uptime in seconds'
          },
          checks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Health check name'
                },
                status: {
                  type: 'string',
                  enum: ['healthy', 'degraded', 'unhealthy'],
                  description: 'Individual check status'
                },
                message: {
                  type: 'string',
                  description: 'Status message'
                },
                responseTime: {
                  type: 'number',
                  description: 'Response time in milliseconds'
                },
                lastCheck: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Last check timestamp'
                }
              }
            },
            description: 'Individual health checks'
          }
        },
        required: ['status', 'timestamp', 'version', 'uptime']
      }
    },
    parameters: {
      UserId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: {
          type: 'string',
          format: 'uuid'
        },
        description: 'User ID'
      },
      Page: {
        name: 'page',
        in: 'query',
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        },
        description: 'Page number for pagination'
      },
      Limit: {
        name: 'limit',
        in: 'query',
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20
        },
        description: 'Number of items per page'
      },
      Search: {
        name: 'search',
        in: 'query',
        schema: {
          type: 'string'
        },
        description: 'Search query for filtering results'
      },
      SortField: {
        name: 'sortField',
        in: 'query',
        schema: {
          type: 'string'
        },
        description: 'Field to sort by'
      },
      SortDirection: {
        name: 'sortDirection',
        in: 'query',
        schema: {
          type: 'string',
          enum: ['asc', 'desc'],
          default: 'desc'
        },
        description: 'Sort direction'
      }
    },
    responses: {
      Success: {
        description: 'Success response',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApiResponse'
            }
          }
        }
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/ApiResponse' },
                {
                  properties: {
                    success: { enum: [false] }
                  }
                }
              ]
            }
          }
        }
      },
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/ApiResponse' },
                {
                  properties: {
                    success: { enum: [false] },
                    errors: {
                      type: 'array',
                      items: {
                        properties: {
                          code: { enum: ['UNAUTHORIZED', 'INVALID_TOKEN', 'TOKEN_EXPIRED'] }
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      },
      Forbidden: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/ApiResponse' },
                {
                  properties: {
                    success: { enum: [false] },
                    errors: {
                      type: 'array',
                      items: {
                        properties: {
                          code: { enum: ['FORBIDDEN', 'INSUFFICIENT_PERMISSIONS'] }
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/ApiResponse' },
                {
                  properties: {
                    success: { enum: [false] },
                    errors: {
                      type: 'array',
                      items: {
                        properties: {
                          code: { enum: ['NOT_FOUND', 'USER_NOT_FOUND'] }
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      },
      RateLimitExceeded: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/ApiResponse' },
                {
                  properties: {
                    success: { enum: [false] },
                    errors: {
                      type: 'array',
                      items: {
                        properties: {
                          code: { enum: ['RATE_LIMITED'] }
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      },
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/ApiResponse' },
                {
                  properties: {
                    success: { enum: [false] },
                    errors: {
                      type: 'array',
                      items: {
                        properties: {
                          code: { enum: ['INTERNAL_SERVER_ERROR'] }
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    }
  },
  security: [
    {
      BearerAuth: []
    }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Get application health status',
        security: [],
        responses: {
          200: {
            description: 'Health status',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthCheck'
                }
              }
            }
          }
        }
      }
    },
    '/health/detailed': {
      get: {
        tags: ['Health'],
        summary: 'Detailed health check',
        description: 'Get detailed application health status with system metrics',
        security: [],
        responses: {
          200: {
            description: 'Detailed health status',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/HealthCheck' },
                    {
                      properties: {
                        system: {
                          type: 'object',
                          properties: {
                            cpu: { type: 'number' },
                            memory: {
                              type: 'object',
                              properties: {
                                used: { type: 'number' },
                                total: { type: 'number' },
                                percentage: { type: 'number' }
                              }
                            },
                            uptime: { type: 'number' }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/metrics': {
      get: {
        tags: ['Monitoring'],
        summary: 'Application metrics',
        description: 'Get application metrics in Prometheus format',
        security: [],
        responses: {
          200: {
            description: 'Prometheus metrics',
            content: {
              'text/plain': {
                schema: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    },
    '/users': {
      post: {
        tags: ['Users'],
        summary: 'Create user',
        description: 'Create a new user account',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateUserRequest'
              }
            }
          }
        },
        responses: {
          200: {
            description: 'User created successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/User' }
                      }
                    }
                  ]
                }
              }
            }
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      get: {
        tags: ['Users'],
        summary: 'List users',
        description: 'Get a paginated list of users with optional search and filtering',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Search' },
          { $ref: '#/components/parameters/SortField' },
          { $ref: '#/components/parameters/SortDirection' },
          {
            name: 'filter.role',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by user role'
          },
          {
            name: 'filter.isActive',
            in: 'query',
            schema: { type: 'boolean' },
            description: 'Filter by active status'
          }
        ],
        responses: {
          200: {
            description: 'Users retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/User' }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get user',
        description: 'Get a specific user by ID',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/UserId' }
        ],
        responses: {
          200: {
            description: 'User retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/User' }
                      }
                    }
                  ]
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      put: {
        tags: ['Users'],
        summary: 'Update user',
        description: 'Update an existing user',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/UserId' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateUserRequest'
              }
            }
          }
        },
        responses: {
          200: {
            description: 'User updated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/User' }
                      }
                    }
                  ]
                }
              }
            }
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete user',
        description: 'Soft delete a user account',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/UserId' }
        ],
        responses: {
          200: {
            description: 'User deleted successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse'
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/users/{id}/authenticate': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate user',
        description: 'Authenticate a user and return JWT tokens',
        security: [],
        parameters: [
          { $ref: '#/components/parameters/UserId' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AuthenticationRequest'
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Authentication successful',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/AuthenticationResponse' }
                      }
                    }
                  ]
                }
              }
            }
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/users/{id}/activate': {
      patch: {
        tags: ['Users'],
        summary: 'Activate user',
        description: 'Activate a user account (admin only)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/UserId' }
        ],
        responses: {
          200: {
            description: 'User activated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/User' }
                      }
                    }
                  ]
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/users/{id}/deactivate': {
      patch: {
        tags: ['Users'],
        summary: 'Deactivate user',
        description: 'Deactivate a user account (admin only)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/UserId' }
        ],
        responses: {
          200: {
            description: 'User deactivated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/User' }
                      }
                    }
                  ]
                }
              }
            }
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/users/statistics': {
      get: {
        tags: ['Users'],
        summary: 'User statistics',
        description: 'Get comprehensive user statistics (admin only)',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'User statistics retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/UserStatistics' }
                      }
                    }
                  ]
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    }
  },
  tags: [
    {
      name: 'Health',
      description: 'Health check and monitoring endpoints'
    },
    {
      name: 'Monitoring',
      description: 'Application metrics and monitoring'
    },
    {
      name: 'Authentication',
      description: 'Authentication and authorization endpoints'
    },
    {
      name: 'Users',
      description: 'User management endpoints'
    }
  ]
};