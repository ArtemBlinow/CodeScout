const crypto = require('crypto');

// Постоянные сессии (логин/пароль)
const sessions = new Map();

// Временные сессии (API ключи, 1 час)
const tempSessions = new Map();

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 дней
const TEMP_SESSION_DURATION = 60 * 60 * 1000; // 1 час

function createSession(login) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
        login,
        createdAt: Date.now()
    });
    return token;
}

function getSession(token) {
    const session = sessions.get(token);
    if (!session) return null;

    if (Date.now() - session.createdAt > SESSION_DURATION) {
        sessions.delete(token);
        return null;
    }

    return session;
}

function deleteSession(token) {
    sessions.delete(token);
    tempSessions.delete(token);
}

function deleteAllSessions(login) {
    for (const [token, session] of sessions) {
        if (session.login === login) {
            sessions.delete(token);
        }
    }
}

// ====== ВРЕМЕННЫЕ СЕССИИ ======
function createTempSession(handle, apiKey, apiSecret) {
    const token = crypto.randomBytes(32).toString('hex');
    tempSessions.set(token, {
        handle,
        apiKey,
        apiSecret,
        createdAt: Date.now()
    });

    // Автоочистка через 1 час
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

// Очистка истекших сессий каждые 30 минут
setInterval(() => {
    const now = Date.now();

    for (const [token, session] of sessions) {
        if (now - session.createdAt > SESSION_DURATION) {
            sessions.delete(token);
        }
    }

    for (const [token, session] of tempSessions) {
        if (now - session.createdAt > TEMP_SESSION_DURATION) {
            tempSessions.delete(token);
        }
    }
}, 30 * 60 * 1000);

module.exports = {
    createSession,
    getSession,
    deleteSession,
    deleteAllSessions,
    createTempSession,
    getTempSession
};