const attempts = new Map();

// Periodic garbage collection of expired IP windows
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts.entries()) {
    if (now > record.resetTime) {
      attempts.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

/**
 * Lightweight in-memory rate limiter middleware.
 * @param {Object} options
 * @param {number} options.windowMs Window in milliseconds (default 15 minutes)
 * @param {number} options.max Maximum requests permitted in window (default 20)
 * @param {string} options.message Error message returned when limit exceeded
 */
export const rateLimit = ({
  windowMs = 15 * 60 * 1000,
  max = 20,
  message = 'Too many requests from this IP. Please try again after 15 minutes.',
} = {}) => {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const key = `${ip}:${req.baseUrl || ''}${req.path}`;
    const now = Date.now();

    const record = attempts.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    record.count += 1;
    attempts.set(key, record);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      return res.status(429).json({ error: message, code: 'RATE_LIMIT_EXCEEDED' });
    }

    next();
  };
};
