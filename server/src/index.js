require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const releaseRoutes = require('./routes/releases');
const sharedTrackRoutes = require('./routes/sharedTracks');
const publicNoticeRoutes = require('./routes/publicNotices');
const mediaRoutes = require('./routes/media');
const glossaryRoutes = require('./routes/glossary');
const streamRoutes = require('./routes/streams');

const { apiLimiter } = require('./middleware/rateLimits');
const { mailConfigProblems } = require('./services/mailer');

{
    const problems = mailConfigProblems();
    if (problems.length && process.env.NODE_ENV === 'production') throw new Error('Mail settings: ' + problems.join(' '));
    for (const m of problems) console.warn('Mail settings:', m);
}

const app = express();

if (process.env.TRUST_PROXY) {
    const n = Number(process.env.TRUST_PROXY);
    app.set('trust proxy', Number.isInteger(n) && n >= 0 ? n : process.env.TRUST_PROXY);
}

app.use(cors());
app.use('/api', apiLimiter());
app.use('/api/streams', express.json({ limit: '4mb' }), streamRoutes);
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/health/db', async (_req, res) => {
    try { await require('./db/pool').query('SELECT 1'); res.json({ status: 'ok' }); }
    catch { res.status(503).json({ status: 'database unavailable' }); }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/releases', releaseRoutes);
app.use('/api/shared-tracks', sharedTrackRoutes);
app.use('/api/notices', publicNoticeRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/glossary', glossaryRoutes);

if (process.env.DEV_OUTBOX === 'true') {
    if (process.env.NODE_ENV === 'production') throw new Error('DEV_OUTBOX must never be enabled in production.');
    app.use('/api/dev', require('./routes/dev'));
}

if (process.env.SERVE_CLIENT === 'true') {
    const path = require('path');
    const fs = require('fs');
    const dist = path.resolve(process.env.CLIENT_DIST || path.join(__dirname, '..', '..', 'client', 'dist'));
    const appIndex = path.join(dist, 'app', 'index.html');
    if (!fs.existsSync(appIndex)) throw new Error(`SERVE_CLIENT is on but ${appIndex} was not found. Build the client first (npm run build in client).`);
    app.use(express.static(dist));
    app.use((req, res, next) => {
        const isPage = req.method === 'GET' || req.method === 'HEAD';
        if (isPage && (req.path === '/app' || req.path.startsWith('/app/'))) return res.sendFile(appIndex);
        next();
    });
}

app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    if (res.headersSent) return;
    res.status(err.status || 500).json({ error: 'Internal server error' });
});

if (require.main === module) {
    process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));
    process.on('uncaughtException', (e) => console.error('uncaughtException:', e));

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
}

module.exports = app;