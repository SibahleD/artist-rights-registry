require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const releaseRoutes = require('./routes/releases');
const sharedTrackRoutes = require('./routes/sharedTracks');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok'}));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/releases', releaseRoutes);
app.use('/api/shared-tracks', sharedTrackRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`)); 