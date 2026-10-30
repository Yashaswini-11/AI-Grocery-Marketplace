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

  if (err.code === 'P2002') {
    // Prisma: unique constraint violated
    status = 409;
    message = 'A record with that value already exists';
  } else if (err.code === 'P2025') {
    status = 404;
    message = 'Record not found';
  } else if (err.code === 'P2003') {
    status = 409;
    message = 'This record is still referenced by other data';
  } else if (err.code === 'P2023') {
    status = 400;
    message = 'Invalid identifier';
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