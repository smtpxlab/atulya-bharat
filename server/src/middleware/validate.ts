import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

type Source = "body" | "query" | "params";

export const validate =
  (schema: ZodSchema, source: Source = "body") =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
