import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError";

/**
 * Mirrors the Postgres enum `public.app_role`.
 * Keep in sync with the database — adding a value here without the matching
 * enum value (or vice versa) will silently break authorization.
 */
export const APP_ROLES = [
  "admin",
  "user",
  "club_owner",
  "content_manager",
  "super_admin",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

/** Roles that satisfy an `admin`-gated route. */
export const ADMIN_ROLES: AppRole[] = ["admin", "super_admin"];

export const isAppRole = (value: unknown): value is AppRole =>
  typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);

/**
 * Expand the requested roles so that `super_admin` implicitly satisfies any
 * `admin` requirement (super_admin is a strict superset of admin).
 */
const expand = (allowed: AppRole[]): AppRole[] => {
  const set = new Set<AppRole>(allowed);
  if (set.has("admin")) set.add("super_admin");
  return [...set];
};

export const hasAnyRole = (roles: string[] | undefined, allowed: AppRole[]): boolean => {
  const effective = expand(allowed);
  return (roles ?? []).some((r) => effective.includes(r as AppRole));
};

export const isAdmin = (roles: string[] | undefined): boolean =>
  hasAnyRole(roles, ["admin"]);

export const requireRole =
  (...allowed: AppRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(HttpError.unauthorized());
    if (!hasAnyRole(req.user.roles, allowed)) {
      return next(HttpError.forbidden("Insufficient role"));
    }
    next();
  };

export const requirePermission =
  (permission: string) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(HttpError.unauthorized());
    // super_admin bypasses granular permission checks.
    if (hasAnyRole(req.user.roles, ["super_admin"])) return next();
    const perms = req.user.permissions ?? [];
    if (!perms.includes(permission)) return next(HttpError.forbidden("Missing permission"));
    next();
  };
