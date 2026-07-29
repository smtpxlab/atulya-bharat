import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, TokenPayload } from "../services/auth/token.service";
import { HttpError } from "../utils/httpError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(HttpError.unauthorized("Missing bearer token"));
  const token = header.slice("Bearer ".length).trim();
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(HttpError.unauthorized("Invalid or expired token"));
  }
}

export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  try {
    req.user = verifyAccessToken(header.slice("Bearer ".length).trim());
  } catch {
    /* ignore */
  }
  next();
};
