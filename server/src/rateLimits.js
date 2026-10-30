const rateLimit = require('express-rate-limit');

// One place for every request limit. Each is per visitor, per 15 minutes.
// Production defaults apply when the variable is unset. Raise them in .env for local testing only.
const WINDOW_MS = 15 * 60 * 1000;

const KINDS = {
    auth:    { env: 'AUTH_RATE_LIMIT',    fallback: 10,  message: 'Too many attempts, please try again later.' },   // register, login, verify, reset
    account: { env: 'ACCOUNT_RATE_LIMIT', fallback: 10,  message: 'Too many attempts, please try again later.' },   // password, email change, export, delete
    notice:  { env: 'NOTICE_RATE_LIMIT',  fallback: 30,  message: 'Too many requests, please try again later.' },   // public co-writer links
    api:     { env: 'API_RATE_LIMIT',     fallback: 600, message: 'Too many requests, please try again later.' },   // everything under /api
};

// A missing, empty, zero or non-numeric value falls back to the default, so a typo never switches a limit off.
function limitFor(kind) {
    const n = Number(process.env[KINDS[kind].env]);
    return Number.isFinite(n) && n > 0 ? n : KINDS[kind].fallback;
}

function makeLimiter(kind, options = {}) {
    return rateLimit({
        windowMs: WINDOW_MS,
        limit: limitFor(kind),
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: KINDS[kind].message },
        ...options,
    });
}

// The ceiling for everything under /api. Images load through /api/media and a discography page can ask for dozens at once,
// so media is left out of the count. Mount this at '/api'.
const apiLimiter = () => makeLimiter('api', { skip: (req) => req.path.startsWith('/media') });

module.exports = { makeLimiter, apiLimiter, limitFor, KINDS };
