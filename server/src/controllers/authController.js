const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/db');
const { userDto } = require('../utils/serializers');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: jwtExpiresIn });
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (cleanName.length < 2 || cleanName.length > 60) {
    throw new HttpError(400, 'Name must be 2 to 60 characters');
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    throw new HttpError(400, 'Enter a valid email address');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    throw new HttpError(400, 'Password must be 8 to 72 characters');
  }

  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) throw new HttpError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name: cleanName, email: cleanEmail, passwordHash } });

  res.status(201).json({ success: true, token: signToken(user), user: userDto(user) });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!cleanEmail || typeof password !== 'string' || !password) {
    throw new HttpError(400, 'Email and password are required');
  }

  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!ok) throw new HttpError(401, 'Invalid email or password');

  res.json({ success: true, token: signToken(user), user: userDto(user) });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = { register, login, me };