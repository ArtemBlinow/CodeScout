const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'accounts.db');
const db = new sqlite3.Database(DB_PATH);

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 дней
const TEMP_SESSION_DURATION = 60 * 60 * 1000; // 1 час

// Таблица для постоянных сессий
db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        login TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )
`);

// Временные сессии — в памяти (недолговечные)
const tempSessions = new Map();

function createSession(login) {
    const token = crypto.randomBytes(32).toString('hex');
    db.run(
        'INSERT INTO sessions (token, login, created_at) VALUES (?, ?, ?)',
        [token, login, Date.now()]
    );
    return token;
}

function getSession(token) {
    return new Promise((resolve) => {
        db.get('SELECT * FROM sessions WHERE token = ?', [token], (err, row) => {
            if (err || !row) return resolve(null);

            if (Date.now() - row.created_at > SESSION_DURATION) {
                db.run('DELETE FROM sessions WHERE token = ?', [token]);
                return resolve(null);
            }

            resolve({ login: row.login, createdAt: row.created_at });
        });
    });
}

function deleteSession(token) {
    db.run('DELETE FROM sessions WHERE token = ?', [token]);
    tempSessions.delete(token);
}

function deleteAllSessions(login) {
    db.run('DELETE FROM sessions WHERE login = ?', [login]);
}

// ====== ВРЕМЕННЫЕ СЕССИИ (в памяти) ======
function createTempSession(handle, apiKey, apiSecret) {
    const token = crypto.randomBytes(32).toString('hex');
    tempSessions.set(token, {
        handle,
        apiKey,
        apiSecret,
        createdAt: Date.now()
    });

    setTimeout(() => {
        tempSessions.delete(token);
    }, TEMP_SESSION_DURATION);

    return token;
}

function getTempSession(token) {
    const session = tempSessions.get(token);
    if (!session) return null;

    if (Date.now() - session.createdAt > TEMP_SESSION_DURATION) {
        tempSessions.delete(token);
        return null;
    }

    return session;
}

// Очистка истекших постоянных сессий каждые 30 минут
setInterval(() => {
    const cutoff = Date.now() - SESSION_DURATION;
    db.run('DELETE FROM sessions WHERE created_at < ?', [cutoff]);
}, 30 * 60 * 1000);

module.exports = {
    createSession,
    getSession,
    deleteSession,
    deleteAllSessions,
    createTempSession,
    getTempSession
};
