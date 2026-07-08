require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const apiRoutes = require('./api');
const { initializeCache } = require('./services/cache');
const { log } = require('./services/logger');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res, next) => {
    log('system', `${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'search.html'));
});

app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'search.html'));
});

app.get('/group/:id', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'team.html'));
});

app.use('/api', apiRoutes);

app.use((err, req, res, next) => {
    log('system', `Error: ${err.message}`);
    res.status(500).json({ error: err.message });
});

async function start() {
    try {
        await initializeCache();
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            log('system', `Server started on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Failed to start:', error);
        log('system', `Failed to start: ${error.message}`);
    }
}

start();
