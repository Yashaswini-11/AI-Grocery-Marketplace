const jwt = require('jsonwebtoken');
const { prisma } = require('../config/db');
const { jwtSecret } = require('../config/env');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { isUuid } = require('../utils/ids');
const { userDto } = require('../utils/serializers');

module.exports = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'Authentication required');
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  // Tokens issued before the Postgres migration carry a Mongo ObjectId, not a UUID
  if (!isUuid(payload.sub)) throw new HttpError(401, 'Invalid or expired token');

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new HttpError(401, 'User no longer exists');

  req.user = userDto(user);
  next();
});
