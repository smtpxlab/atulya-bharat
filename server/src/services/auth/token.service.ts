import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../../config/env";
import { getRedis } from "../../config/redis";

export interface TokenPayload {
  sub: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  sid?: string; // session id
}

const ACCESS_OPTS: SignOptions = { expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"] };
const REFRESH_OPTS: SignOptions = { expiresIn: env.JWT_REFRESH_TTL as SignOptions["expiresIn"] };

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, ACCESS_OPTS);
}

export function signRefreshToken(payload: TokenPayload & { sid: string }): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, REFRESH_OPTS);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload & { sid: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload & { sid: string };
}

export function newSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Session store using Redis (fallback: in-memory Map for local dev).
 * Keys: `session:<userId>:<sid>` → refreshTokenHash. TTL matches refresh TTL.
 */
const memStore = new Map<string, { hash: string; expiresAt: number }>();

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30d default; actual TTL set from JWT exp when available

export async function storeRefreshSession(
  userId: string,
  sid: string,
  refreshToken: string,
  ttlSeconds: number = REFRESH_TTL_SECONDS,
): Promise<void> {
  const key = `session:${userId}:${sid}`;
  const hash = hashToken(refreshToken);
  const r = getRedis();
  if (r) {
    await r.set(key, hash, "EX", ttlSeconds);
    return;
  }
  memStore.set(key, { hash, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function verifyRefreshSession(
  userId: string,
  sid: string,
  refreshToken: string,
): Promise<boolean> {
  const key = `session:${userId}:${sid}`;
  const hash = hashToken(refreshToken);
  const r = getRedis();
  if (r) {
    const stored = await r.get(key);
    return stored === hash;
  }
  const rec = memStore.get(key);
  if (!rec || rec.expiresAt < Date.now()) return false;
  return rec.hash === hash;
}

export async function revokeRefreshSession(userId: string, sid: string): Promise<void> {
  const key = `session:${userId}:${sid}`;
  const r = getRedis();
  if (r) {
    await r.del(key);
    return;
  }
  memStore.delete(key);
}
