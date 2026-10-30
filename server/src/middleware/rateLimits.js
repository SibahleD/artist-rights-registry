const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// One place for every request limit. Each is counted over 15 minutes.
// Production defaults apply when the variable is unset. Raise them in .env for local testing only.
// Behind a proxy (Netlify, Render) set TRUST_PROXY=1 (see index.js) so "per IP" means per visitor.
const WINDOW_MS = 15 * 60 * 1000;

const KINDS = {
    auth:    { env: 'AUTH_RATE_LIMIT',    fallback: 10,  message: 'Too many attempts, please try again later.' },   // register, login, verify, reset (per IP)
    account: { env: 'ACCOUNT_RATE_LIMIT', fallback: 10,  message: 'Too many attempts, please try again later.' },   // password, email change, export, delete (per IP)
    notice:  { env: 'NOTICE_RATE_LIMIT',  fallback: 30,  message: 'Too many requests, please try again later.' },   // public co-writer links (per IP)
    api:     { env: 'API_RATE_LIMIT',     fallback: 600, message: 'Too many requests, please try again later.' },   // everything under /api (per IP)
    userApi: { env: 'API_RATE_LIMIT',     fallback: 300, message: 'Too many requests, please slow down and try again shortly.', perUser: true },   // signed-in routes (per user)
};

// A missing, empty, zero or non-numeric value falls back to the default, so a typo never switches a limit off.
function limitFor(kind) {
    const n = Number(process.env[KINDS[kind].env]);
    return Number.isFinite(n) && n > 0 ? n : KINDS[kind].fallback;
}

// Per-user limits run after authToken and count by user id; with no user they fall back to the visitor's IP address.
const userKey = (req) => (req.user ? `u:${req.user.id}` : ipKeyGenerator(req.ip));

function makeLimiter(kind, options = {}) {
    const { perUser, message } = KINDS[kind];
    return rateLimit({
        windowMs: WINDOW_MS,
        limit: limitFor(kind),
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: message },
        ...(perUser ? { keyGenerator: userKey } : {}),
        ...options,
    });
}

// The ceiling for everything under /api. Images load through /api/media and a discography page can ask for dozens at once,
// so media is left out of the count. Mount this at '/api'.
const apiLimiter = () => makeLimiter('api', { skip: (req) => req.path.startsWith('/media') });

// For routers that sit behind authToken: counts per signed-in user.
const userApiLimiter = () => makeLimiter('userApi');

module.exports = { makeLimiter, apiLimiter, userApiLimiter, limitFor, KINDS };
