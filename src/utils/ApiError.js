// Standard operational error, thrown deliberately from controllers and caught
// by the global error handler. Anything else (bugs, unexpected exceptions) is
// treated as a 500 and does not leak internals to the client.
export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
