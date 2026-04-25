/**
 * Standard response envelope builder.
 * All API responses use this format.
 */

const success = (res, data, meta = null, statusCode = 200) => {
  const payload = { success: true, data };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

const created = (res, data) => success(res, data, null, 201);

const error = (res, message, code = 'ERROR', statusCode = 400, details = null, extras = null) => {
  const payload = { success: false, error: { code, message } };
  if (details) payload.error.details = details;
  if (extras && typeof extras === 'object') {
    Object.assign(payload.error, extras);
  }
  return res.status(statusCode).json(payload);
};

const notFound = (res, message = 'Resource not found') =>
  error(res, message, 'NOT_FOUND', 404);

const unauthorized = (res, message = 'Unauthorized') =>
  error(res, message, 'UNAUTHORIZED', 401);

const forbidden = (res, message = 'Forbidden') =>
  error(res, message, 'FORBIDDEN', 403);

const validationError = (res, details) =>
  error(res, 'Validation failed', 'VALIDATION_ERROR', 422, details);

const serverError = (res, message = 'Internal server error') =>
  error(res, message, 'SERVER_ERROR', 500);

module.exports = { success, created, error, notFound, unauthorized, forbidden, validationError, serverError };
