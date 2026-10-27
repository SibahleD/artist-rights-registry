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

const { sweepNotices } = require('./services/notices');

const app = express();

app.use(cors());
// Imports can carry thousands of rows, so this route gets a larger body limit. It is mounted first so the
// default parser below sees an already-parsed body and leaves it alone.
app.use('/api/streams', express.json({ limit: '4mb' }), streamRoutes);
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok'}));

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

app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    if (res.headersSent) return;
    res.status(err.status || 500).json({ error: 'Internal server error' });
});
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));
process.on('uncaughtException', (e) => console.error('uncaughtException:', e));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`)); 

sweepNotices().catch((e) => console.error('sweep failed:', e.message));
setInterval(() => sweepNotices().catch((e) => console.error('sweep failed:', e.message)), 60 * 60 * 1000).unref();

