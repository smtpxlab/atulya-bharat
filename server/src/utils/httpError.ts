export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(msg = "Bad Request", details?: unknown) {
    return new HttpError(400, "BAD_REQUEST", msg, details);
  }
  static unauthorized(msg = "Unauthorized") {
    return new HttpError(401, "UNAUTHORIZED", msg);
  }
  static forbidden(msg = "Forbidden") {
    return new HttpError(403, "FORBIDDEN", msg);
  }
  static notFound(msg = "Not Found") {
    return new HttpError(404, "NOT_FOUND", msg);
  }
  static conflict(msg = "Conflict") {
    return new HttpError(409, "CONFLICT", msg);
  }
  static tooMany(msg = "Too Many Requests") {
    return new HttpError(429, "TOO_MANY_REQUESTS", msg);
  }
  static internal(msg = "Internal Server Error") {
    return new HttpError(500, "INTERNAL_ERROR", msg);
  }
}
