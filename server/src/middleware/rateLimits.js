const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// One place for every rate limit. Each value can be overridden from the environment:
// keep the production numbers below, and raise them only in the local .env.
// Limits that run after authToken count per signed-in user; the rest count per IP address.
// Behind Render or Vercel set TRUST_PROXY=1 (see index.js) so "per IP" means per visitor.

const MINUTE = 60 * 1000;
const num = (name, fallback) => {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

const make = ({ windowMs, limit, message, perUser }) => rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    // Counts per signed-in user; falls back to the visitor's IP address when there is none.
    ...(perUser ? { keyGenerator: (req) => (req.user ? `u:${req.user.id}` : ipKeyGenerator(req.ip)) } : {}),
});

// Login, register, forgot and reset password: 10 per 15 minutes per IP.
const authLimiter = () => make({
    windowMs: 15 * MINUTE,
    limit: num('AUTH_RATE_LIMIT', 10),
    message: 'Too many attempts, please try again in a few minutes.',
});

// Password, email, export and delete: 10 per hour per user.
const accountLimiter = () => make({
    windowMs: 60 * MINUTE,
    limit: num('ACCOUNT_RATE_LIMIT', 10),
    message: 'Too many attempts, please try again later.',
    perUser: true,
});

// Public notice links: 30 per 15 minutes per IP.
const noticeLimiter = () => make({
    windowMs: 15 * MINUTE,
    limit: num('NOTICE_RATE_LIMIT', 30),
    message: 'Too many requests, please try again later.',
});

// Everything else behind login: 300 per 15 minutes per user.
const apiLimiter = () => make({
    windowMs: 15 * MINUTE,
    limit: num('API_RATE_LIMIT', 300),
    message: 'Too many requests, please slow down and try again shortly.',
    perUser: true,
});

module.exports = { authLimiter, accountLimiter, noticeLimiter, apiLimiter };
