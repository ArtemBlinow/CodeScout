const express = require('express');
const router = express.Router();
const { log } = require('../services/logger');
const { authMiddleware } = require('../middleware/auth');
const accounts = require('../services/accounts');
const sessions = require('../services/sessions');
const cfApi = require('../services/cfApi');
const { cache } = require('../services/cache');
const groups = require('../services/groups');

// ============================================================
// ====== РЕГИСТРАЦИЯ ======
// ============================================================
router.post('/register', async (req, res) => {
    const { login, password, handle } = req.body;

    log('users', `Регистрация: ${login} (${handle})`);

    if (!login || !password || !handle) {
        return res.status(400).json({
            error: 'Login, password and handle required'
        });
    }

    // Валидация только логина
    const loginRegex = /^[a-zA-Z0-9_]+$/;
    if (!loginRegex.test(login)) {
        return res.status(400).json({
            error: 'Login: only latin letters, numbers and underscore'
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            error: 'Password must be at least 8 characters'
        });
    }

    // Хендл не проверяем — любой

    try {
        if (await accounts.loginExists(login)) {
            return res.status(400).json({ error: 'Login already exists' });
        }

        await accounts.saveAccount(login, handle, password);
        const token = sessions.createSession(login);

        log('users', `Успешная регистрация: ${login} (${handle})`);

        res.json({
            success: true,
            token,
            login,
            handle,
            hasApiKeys: false,
            message: 'Account created successfully'
        });
    } catch (error) {
        log('users', `Ошибка регистрации ${login}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ====== ЛОГИН ======
// ============================================================
router.post('/login', async (req, res) => {
    const { login, password } = req.body;

    log('users', `Попытка входа: ${login}`);

    if (!login || !password) {
        return res.status(400).json({ error: 'Login and password required' });
    }

    try {
        const account = await accounts.checkLogin(login, password);
        if (!account) {
            log('users', `Неудачный вход: ${login}`);
            return res.status(401).json({ error: 'Invalid login or password' });
        }

        const token = sessions.createSession(login);

        log('users', `Успешный вход: ${login} (${account.handle})`);

        res.json({
            success: true,
            token,
            login: account.login,
            handle: account.handle,
            hasApiKeys: account.hasApiKeys,
            message: 'Logged in successfully'
        });
    } catch (error) {
        log('users', `Ошибка входа ${login}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ====== ИНФО О ПОЛЬЗОВАТЕЛЕ ======
// ============================================================
router.get('/account', authMiddleware, async (req, res) => {
    try {
        const account = await accounts.getAccount(req.account.login);

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        res.json({
            login: account.login,
            handle: account.handle,
            hasApiKeys: account.hasApiKeys,
            created_at: account.created_at
        });
    } catch (error) {
        log('users', `Ошибка получения данных ${req.account.login}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ====== ОБНОВИТЬ ХЕНДЛ (без проверок) ======
// ============================================================
router.put('/account/handle', authMiddleware, async (req, res) => {
    const { handle } = req.body;
    const { login } = req.account;

    log('users', `Обновление хендла: ${login} → ${handle}`);

    if (!handle || handle.trim().length === 0) {
        return res.status(400).json({ error: 'Handle required' });
    }

    try {
        const account = await accounts.getAccount(login);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        await accounts.updateHandle(login, handle.trim());

        res.json({
            success: true,
            handle: handle.trim(),
            message: 'Handle updated successfully'
        });
    } catch (error) {
        log('users', `Ошибка обновления хендла ${login}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});


// ============================================================
// ====== ДОБАВИТЬ/ОБНОВИТЬ ПОСТОЯННЫЕ КЛЮЧИ ======
// ============================================================
router.put('/keys', authMiddleware, async (req, res) => {
    const { apiKey, apiSecret } = req.body;
    const { login } = req.account;

    if (!apiKey || !apiSecret) {
        return res.status(400).json({ error: 'API Key and Secret required' });
    }

    try {
        // Проверяем ключи
        const valid = await cfApi.verifyCredentials(req.account.handle, apiKey, apiSecret);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid Codeforces credentials' });
        }

        await accounts.saveApiKeys(login, apiKey, apiSecret);
        log('users', `API ключи добавлены для ${login}`);

        res.json({ success: true, message: 'API keys saved' });
    } catch (error) {
        log('users', `Ошибка сохранения ключей ${login}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ====== УДАЛИТЬ ПОСТОЯННЫЕ КЛЮЧИ ======
// ============================================================
router.delete('/keys', authMiddleware, async (req, res) => {
    const { login } = req.account;

    try {
        await accounts.deleteApiKeys(login);
        log('users', `API ключи удалены для ${login}`);
        res.json({ success: true, message: 'API keys deleted' });
    } catch (error) {
        log('users', `Ошибка удаления ключей ${login}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ====== ВРЕМЕННЫЙ ВХОД ======
// ============================================================
router.post('/temp-login', async (req, res) => {
    const { handle, apiKey, apiSecret } = req.body;

    if (!handle || !apiKey || !apiSecret) {
        return res.status(400).json({ error: 'Handle, API Key and Secret required' });
    }

    try {
        const valid = await cfApi.verifyCredentials(handle, apiKey, apiSecret);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = sessions.createTempSession(handle, apiKey, apiSecret);
        log('users', `Временный вход: ${handle}`);

        res.json({ token, expiresIn: 3600 });
    } catch (error) {
        log('users', `Ошибка временного входа ${handle}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ====== УДАЛИТЬ АККАУНТ ======
// ============================================================
router.delete('/account', authMiddleware, async (req, res) => {
    const { login } = req.account;

    try {
        await accounts.deleteAccount(login);
        await sessions.deleteAllSessions(login);
        log('users', `Аккаунт удален: ${login}`);
        res.json({ success: true, message: 'Account deleted' });
    } catch (error) {
        log('users', `Ошибка удаления аккаунта ${login}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ====== ВЫХОД ======
// ============================================================
router.post('/logout', authMiddleware, (req, res) => {
    sessions.deleteSession(req.token);
    log('users', `Выход: ${req.account.login}`);
    res.json({ success: true });
});

// ============================================================
// ====== ПОИСК (с проверкой ключей) ======
// ============================================================
router.post('/search', authMiddleware, async (req, res) => {
    const { handles, difficulty, type } = req.body;
    let { apiKey, apiSecret } = req.account;
    const { login, handle } = req.account;

    // Если у пользователя нет постоянных ключей
    if (!apiKey || !apiSecret) {
        // Проверяем, может это временная сессия
        const tempSession = sessions.getTempSession(req.token);
        if (tempSession) {
            apiKey = tempSession.apiKey;
            apiSecret = tempSession.apiSecret;
        } else {
            return res.status(400).json({
                error: 'No API keys. Add permanent keys or use temporary access.'
            });
        }
    }

    log('contests', `Поиск для ${handle}, сложность: ${difficulty || 'любая'}`);

    const searchHandles = handles?.length > 0 ? handles : [handle];

    try {
        const result = await cfApi.findRandomGym(
            searchHandles,
            difficulty,
            type,
            apiKey,
            apiSecret,
            cache
        );

        if (result.gym) {
            log('contests', `Найдена тренировка ${result.gym.id} для ${handle}`);
        } else {
            log('contests', `Не найдено для ${handle}: ${result.error}`);
        }

        res.json(result);
    } catch (error) {
        log('contests', `Ошибка поиска для ${handle}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ====== ПОЛУЧИТЬ СПИСОК ТРЕНИРОВОК ======
// ============================================================
router.get('/gyms', authMiddleware, (req, res) => {
    const { difficulty, type } = req.query;
    const gyms = cache.getGyms({ difficulty, type });
    res.json({
        total: gyms.length,
        gyms: gyms.slice(0, 100)
    });
});

// ============================================================
// ====== ГРУППЫ ======
// ============================================================

// Получить группы текущего пользователя
router.get('/groups', authMiddleware, async (req, res) => {
    try {
        const userGroups = await groups.getGroupsByOwner(req.account.login);
        res.json({ groups: userGroups });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Создать группу
router.post('/groups', authMiddleware, async (req, res) => {
    const { name, description, members } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Group name required' });
    }

    try {
        const id = await groups.createGroup(name.trim(), description || '', req.account.login);
        if (members && members.length > 0) {
            await groups.setGroupMembers(id, members);
        }
        log('users', `Группа создана: "${name}" by ${req.account.login}`);
        res.json({ success: true, id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Обновить группу
router.put('/groups/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, description, members } = req.body;

    try {
        if (!(await groups.isOwner(id, req.account.login))) {
            return res.status(403).json({ error: 'Not your group' });
        }

        if (name) await groups.updateGroup(id, name.trim(), description || '');
        if (members) await groups.setGroupMembers(id, members);

        log('users', `Группа id=${id} обновлена by ${req.account.login}`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Удалить группу
router.delete('/groups/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;

    try {
        if (!(await groups.isOwner(id, req.account.login))) {
            return res.status(403).json({ error: 'Not your group' });
        }

        await groups.deleteGroup(id);
        log('users', `Группа id=${id} удалена by ${req.account.login}`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Получить участников группы
router.get('/groups/:id/members', authMiddleware, async (req, res) => {
    try {
        const members = await groups.getGroupMembers(req.params.id);
        res.json({ members });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ====== ПУБЛИЧНАЯ СТРАНИЦА ГРУППЫ ======
// ============================================================
router.get('/public/groups/:id', async (req, res) => {
    try {
        const group = await groups.getGroupById(req.params.id);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        const members = await groups.getGroupMembers(req.params.id);
        res.json({ group, members });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;