// middleware/auth.js

const sessions = require('../services/sessions');
const accounts = require('../services/accounts');
const { log } = require('../services/logger');

function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    // Сначала проверяем постоянные сессии
    const session = sessions.getSession(token);

    // Потом временные
    const tempSession = sessions.getTempSession(token);

    if (!session && !tempSession) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Если это временная сессия
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

    // Если это постоянная сессия
    accounts.getAccount(session.login)
        .then(account => {
            if (!account) {
                return res.status(401).json({ error: 'Account not found' });
            }
            req.account = account;
            req.token = token;
            next();
        })
        .catch(err => {
            log('auth', `Ошибка загрузки аккаунта: ${err.message}`);
            return res.status(401).json({ error: 'Account not found' });
        });
}

module.exports = { authMiddleware };