# HealthFlow Digital Prescription Portals - API Documentation

**Version:** 1.0.0  
**Date:** October 12, 2025  
**Author:** HealthFlow team

## 1. Introduction

This document provides an overview of the APIs exposed by the HealthFlow Digital Prescription Portals system. The system implements RESTful APIs following OpenAPI 3.0 specifications to ensure consistency, discoverability, and ease of integration.

## 2. API Design Principles

The HealthFlow APIs are designed according to the following principles:

**RESTful Architecture:** APIs follow REST principles with resource-based URLs, standard HTTP methods, and stateless communication.

**Consistency:** All APIs use consistent naming conventions, error handling, and response formats to provide a predictable developer experience.

**Versioning:** API versioning is implemented through URL paths (e.g., `/api/v1/`) to ensure backward compatibility as the system evolves.

**Security:** All APIs require authentication and implement appropriate authorization checks to protect sensitive healthcare data.

**Documentation:** Comprehensive API documentation is provided through OpenAPI specifications and interactive documentation tools.

## 3. Base URLs

The system provides different base URLs for different environments:

| Environment | Base URL                                              |
| ----------- | ----------------------------------------------------- |
| Development | `http://localhost:3000/api/v1`                        |
| Staging     | `https://staging-api.healthflow.gov.eg/api/v1`        |
| Production  | `https://api.healthflow.gov.eg/api/v1`                |

## 4. Authentication

### 4.1. Authentication Flow

The system uses JWT (JSON Web Token) based authentication. The authentication flow consists of the following steps:

1. **Login:** The client sends credentials to the `/auth/login` endpoint.
2. **Token Issuance:** Upon successful authentication, the server returns an access token and a refresh token.
3. **API Access:** The client includes the access token in the `Authorization` header for subsequent API requests.
4. **Token Refresh:** When the access token expires, the client uses the refresh token to obtain a new access token.

### 4.2. Authentication Endpoints

**POST /auth/login**

Authenticates a user and returns access and refresh tokens.

Request Body:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "role": "healthcare_professional"
  }
}
```

**POST /auth/refresh**

Refreshes an expired access token using a valid refresh token.

Request Body:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

**POST /auth/logout**

Invalidates the current session and refresh token.

Request Headers:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:
```json
{
  "message": "Successfully logged out"
}
```

### 4.3. Authorization Header

All authenticated API requests must include the access token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 5. API Services

### 5.1. Admin Service API

The Admin Service provides endpoints for user management, role assignment, and system configuration.

**Base Path:** `/admin/v1`

**Key Endpoints:**

| Method | Endpoint                    | Description                          |
| ------ | --------------------------- | ------------------------------------ |
| GET    | /users                      | List all users with pagination       |
| GET    | /users/:id                  | Get user details by ID               |
| POST   | /users                      | Create a new user                    |
| PUT    | /users/:id                  | Update user information              |
| DELETE | /users/:id                  | Deactivate a user                    |
| GET    | /roles                      | List all available roles             |
| POST   | /users/:id/roles            | Assign roles to a user               |
| GET    | /audit-logs                 | Retrieve audit logs                  |

### 5.2. EDA Service API

The Event-Driven Architecture service provides endpoints for event publishing and subscription management.

**Base Path:** `/eda/v1`

**Key Endpoints:**

| Method | Endpoint                    | Description                          |
| ------ | --------------------------- | ------------------------------------ |
| POST   | /events                     | Publish an event                     |
| GET    | /events                     | List recent events                   |
| GET    | /events/:id                 | Get event details                    |
| POST   | /subscriptions              | Create event subscription            |
| GET    | /subscriptions              | List subscriptions                   |
| DELETE | /subscriptions/:id          | Remove subscription                  |

### 5.3. Analytics Service API

The Analytics Service provides endpoints for data analysis and reporting.

**Base Path:** `/analytics/v1`

**Key Endpoints:**

| Method | Endpoint                    | Description                          |
| ------ | --------------------------- | ------------------------------------ |
| GET    | /dashboard/summary          | Get dashboard summary metrics        |
| GET    | /prescriptions/trends       | Get prescription trend data          |
| GET    | /prescriptions/statistics   | Get prescription statistics          |
| GET    | /providers/performance      | Get healthcare provider performance  |
| POST   | /reports/generate           | Generate custom report               |
| GET    | /reports/:id                | Retrieve generated report            |

## 6. Common Response Formats

### 6.1. Success Response

Successful API responses follow this structure:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "metadata": {
    "timestamp": "2025-10-12T10:30:00Z",
    "requestId": "req-abc123"
  }
}
```

### 6.2. Error Response

Error responses follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email format is invalid"
      }
    ]
  },
  "metadata": {
    "timestamp": "2025-10-12T10:30:00Z",
    "requestId": "req-abc123"
  }
}
```

### 6.3. Pagination

List endpoints support pagination using query parameters:

```
GET /api/v1/users?page=1&limit=20&sortBy=createdAt&order=desc
```

Paginated responses include metadata:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "totalItems": 100,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

## 7. HTTP Status Codes

The APIs use standard HTTP status codes to indicate the result of requests:

| Status Code | Meaning                    | Usage                                     |
| ----------- | -------------------------- | ----------------------------------------- |
| 200         | OK                         | Successful GET, PUT, PATCH, DELETE        |
| 201         | Created                    | Successful POST that creates a resource   |
| 204         | No Content                 | Successful DELETE with no response body   |
| 400         | Bad Request                | Invalid request data or parameters        |
| 401         | Unauthorized               | Missing or invalid authentication         |
| 403         | Forbidden                  | Authenticated but not authorized          |
| 404         | Not Found                  | Resource does not exist                   |
| 409         | Conflict                   | Resource conflict (e.g., duplicate)       |
| 422         | Unprocessable Entity       | Validation errors                         |
| 429         | Too Many Requests          | Rate limit exceeded                       |
| 500         | Internal Server Error      | Server-side error                         |
| 503         | Service Unavailable        | Service temporarily unavailable           |

## 8. Rate Limiting

To ensure fair usage and protect against abuse, the APIs implement rate limiting:

| User Type                | Rate Limit                    |
| ------------------------ | ----------------------------- |
| Unauthenticated          | 100 requests per hour         |
| Authenticated            | 1,000 requests per hour       |
| Healthcare Professional  | 5,000 requests per hour       |
| System Administrator     | 10,000 requests per hour      |

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1697097600
```

## 9. Error Codes

The system uses standardized error codes for consistent error handling:

| Error Code              | Description                                      |
| ----------------------- | ------------------------------------------------ |
| VALIDATION_ERROR        | Input validation failed                          |
| AUTHENTICATION_FAILED   | Authentication credentials are invalid           |
| UNAUTHORIZED            | Authentication required                          |
| FORBIDDEN               | Insufficient permissions                         |
| NOT_FOUND               | Requested resource not found                     |
| CONFLICT                | Resource conflict                                |
| RATE_LIMIT_EXCEEDED     | Too many requests                                |
| INTERNAL_ERROR          | Internal server error                            |
| SERVICE_UNAVAILABLE     | Service temporarily unavailable                  |

## 10. Data Formats

### 10.1. Date and Time

All date and time values are in ISO 8601 format with UTC timezone:

```
2025-10-12T10:30:00Z
```

### 10.2. Identifiers

Resource identifiers are UUIDs in string format:

```
"id": "550e8400-e29b-41d4-a716-446655440000"
```

### 10.3. Monetary Values

Monetary values are represented as strings to avoid floating-point precision issues:

```json
{
  "amount": "150.50",
  "currency": "EGP"
}
```

## 11. Webhooks

The system supports webhooks for real-time event notifications. Webhook endpoints can be configured through the Admin Portal.

### 11.1. Webhook Events

| Event Type                    | Description                                |
| ----------------------------- | ------------------------------------------ |
| prescription.created          | New prescription created                   |
| prescription.approved         | Prescription approved                      |
| prescription.rejected         | Prescription rejected                      |
| user.created                  | New user account created                   |
| user.deactivated              | User account deactivated                   |

### 11.2. Webhook Payload

Webhook payloads follow this structure:

```json
{
  "eventId": "evt-123",
  "eventType": "prescription.created",
  "timestamp": "2025-10-12T10:30:00Z",
  "data": {
    // Event-specific data
  }
}
```

## 12. API Testing

### 12.1. Postman Collection

A Postman collection with example requests for all API endpoints is available in the repository at `/docs/api/postman/`.

### 12.2. OpenAPI Specification

Complete OpenAPI 3.0 specifications for all services are available in the repository at `/docs/api/openapi/`.

### 12.3. Interactive Documentation

Interactive API documentation powered by Swagger UI is available at:

- Staging: `https://staging-api.healthflow.gov.eg/docs`
- Production: `https://api.healthflow.gov.eg/docs`

## 13. SDK and Client Libraries

Official client libraries will be provided for the following languages in future releases:

- JavaScript/TypeScript
- Python
- Java
- C#
- PHP

## 14. Support and Feedback

For API support, questions, or feedback:

- **Slack Channel:** #digital-prescription-portals-api
- **Email:** api-support@healthflow.gov.eg
- **Issue Tracker:** GitHub Issues

## 15. Changelog

API changes and updates are documented in the changelog:

| Version | Date         | Changes                                    |
| ------- | ------------ | ------------------------------------------ |
| 1.0.0   | Oct 12, 2025 | Initial API documentation                  |

---

**Note:** This is a high-level API overview. Detailed endpoint specifications, request/response schemas, and code examples will be added as services are implemented during Sprint 1 and beyond.

