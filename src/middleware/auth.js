const sessions = require('../services/sessions');
const accounts = require('../services/accounts');
const { log } = require('../services/logger');

async function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    // Проверяем временные сессии (в памяти, синхронно)
    const tempSession = sessions.getTempSession(token);
    if (tempSession) {
        req.account = {
            login: `temp_${tempSession.handle}`,
            handle: tempSession.handle,
            apiKey: tempSession.apiKey,
            apiSecret: tempSession.apiSecret,
            hasApiKeys: true
        };
        req.token = token;
        return next();
    }

    // Проверяем постоянные сессии (в SQLite, асинхронно)
    try {
        const session = await sessions.getSession(token);
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const account = await accounts.getAccount(session.login);
        if (!account) {
            return res.status(401).json({ error: 'Account not found' });
        }

        req.account = account;
        req.token = token;
        next();
    } catch (err) {
        log('auth', `Ошибка авторизации: ${err.message}`);
        return res.status(401).json({ error: 'Auth error' });
    }
}

module.exports = { authMiddleware };
