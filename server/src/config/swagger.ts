import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env";

export const openApiSpec = swaggerJsdoc({
  definition: {
    openapi: "3.1.0",
    info: {
      title: "Atulya Bharat Run API",
      version: "0.1.0",
      description:
        "Node.js/Express backend for Atulya Bharat Run. Phase 2 — foundation only. " +
        "Business endpoints are added in later phases.",
    },
    servers: [
      { url: `http://localhost:${env.PORT}/api/${env.API_VERSION}`, description: "Local" },
      { url: `/api/${env.API_VERSION}`, description: "Same-origin" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "BAD_REQUEST" },
                message: { type: "string", example: "Invalid input" },
                details: { type: "object", nullable: true },
              },
              required: ["code", "message"],
            },
          },
          required: ["error"],
        },
        HealthStatus: {
          type: "object",
          properties: {
            status: { type: "string", example: "ok" },
            uptime: { type: "number", example: 123.45 },
            timestamp: { type: "string", format: "date-time" },
            version: { type: "string", example: "0.1.0" },
            checks: {
              type: "object",
              properties: {
                db: { type: "boolean" },
                redis: { type: "boolean" },
              },
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: "Bad Request",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        Unauthorized: {
          description: "Unauthorized",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        Forbidden: {
          description: "Forbidden",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        NotFound: {
          description: "Not Found",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        InternalError: {
          description: "Internal Server Error",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
});
