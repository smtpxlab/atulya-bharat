import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError";
import { logger } from "../config/logger";
import { isProd } from "../config/env";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(HttpError.notFound("Route not found"));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.flatten(),
      },
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details ?? null },
    });
  }

  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: isProd ? "Internal Server Error" : (err as Error)?.message ?? "Unknown error",
    },
  });
}
