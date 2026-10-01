import { ApiError } from '../utils/ApiError.js';

export function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// Converts known Mongoose errors into clean ApiErrors, then sends a
// consistent { message } JSON body for every error in the app.
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let error = err;

  if (err.name === 'CastError') {
    error = new ApiError(400, `Invalid value for ${err.path}: ${err.value}`);
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = new ApiError(409, `That ${field} is already in use.`);
  } else if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    error = new ApiError(400, message);
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'Invalid or expired session. Please log in again.');
  } else if (!(err instanceof ApiError)) {
    console.error('Unexpected error:', err);
    error = new ApiError(500, 'Something went wrong on our end.');
  }

  res.status(error.statusCode || 500).json({
    message: error.message || 'Something went wrong on our end.',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}
