function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: { message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message;
  const code = err.errorCode; // optional machine-readable code (used by AI errors)

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join('; ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid identifier';
  } else if (err.code === 11000) {
    status = 409;
    message = 'A record with that value already exists';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON';
  }

  // Unexpected server errors are hidden; errors flagged `expose` carry safe, user-facing text.
  if (status >= 500 && !err.expose) {
    console.error(err);
    message = 'Internal server error';
  }

  res.status(status).json({
    success: false,
    error: { message, ...(code ? { code } : {}) },
  });
}

module.exports = { notFound, errorHandler };