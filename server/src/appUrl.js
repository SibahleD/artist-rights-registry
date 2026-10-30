// The public address of the web app, used to build every link that goes out by email
// (verify email, change email, reset password, co-writer notices).
// In production APP_URL must be set to the real address, including the /app part,
// e.g. https://yourdomain.com/app. A missing or localhost value stops the server from
// starting, so a real user can never be sent a link that points at localhost.
const { isProduction } = require('./env');
const raw = process.env.APP_URL;
const isLocal = (u) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(u);

if (isProduction && (!raw || isLocal(raw))) {
  throw new Error('APP_URL must be set to the real public address of the app (for example https://yourdomain.com/app) in production. Email links would point at localhost.');
}

module.exports = (raw || 'http://localhost:5173/app').replace(/\/+$/, '');
