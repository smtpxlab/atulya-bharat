import type { Server as HttpServer } from "node:http";
import { Server as IoServer, Socket } from "socket.io";
import { verifyAccessToken } from "../services/auth/token.service";
import { corsOrigins } from "../config/env";
import { logger } from "../config/logger";

let io: IoServer | null = null;

export function initSocket(httpServer: HttpServer): IoServer {
  if (io) return io;
  io = new IoServer(httpServer, {
    cors: { origin: corsOrigins.length ? corsOrigins : true, credentials: true },
    path: "/socket.io",
  });

  io.use((socket, next) => {
    // JWT auth via handshake.auth.token (client sends after login).
    const token = (socket.handshake.auth?.token as string | undefined) ?? undefined;
    if (!token) return next(); // allow anonymous connect for public channels
    try {
      const payload = verifyAccessToken(token);
      (socket.data as { userId?: string }).userId = payload.sub;
      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket.data as { userId?: string }).userId;
    logger.debug({ sid: socket.id, userId }, "socket connected");
    if (userId) socket.join(`user:${userId}`);
    socket.on("disconnect", (reason) => {
      logger.debug({ sid: socket.id, reason }, "socket disconnected");
    });
  });

  return io;
}

export function getIo(): IoServer | null {
  return io;
}
