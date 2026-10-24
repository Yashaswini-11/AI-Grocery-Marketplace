const HttpError = require('../utils/HttpError');

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;

const hits = new Map(); // userId -> [timestamps]

module.exports = function aiRateLimit(req, res, next) {
  const key = req.user._id.toString();
  const now = Date.now();

  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    res.set('Retry-After', String(retryAfter));
    const err = new HttpError(429, `Too many AI requests. Please wait ${retryAfter} seconds and try again.`);
    err.errorCode = 'RATE_LIMITED';
    return next(err);
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 1000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }

  next();
};