const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');
const { log } = require('./logger');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'accounts.db');

const fs = require('fs');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
        login TEXT PRIMARY KEY,
        handle TEXT NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
        .createHash('sha256')
        .update(salt + password)
        .digest('hex');
    return salt + ':' + hash;
}

function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    const computed = crypto
        .createHash('sha256')
        .update(salt + password)
        .digest('hex');
    return computed === hash;
}

// ==== СОХРАНЕНИЕ АККАУНТА ====
function saveAccount(login, handle, password) {
    return new Promise((resolve, reject) => {
        const passwordHash = hashPassword(password);
        db.run(
            `INSERT INTO accounts (login, handle, password) 
             VALUES (?, ?, ?)`,
            [login, handle, passwordHash],
            (err) => {
                if (err) {
                    log('users', `Ошибка сохранения ${login}: ${err.message}`);
                    reject(err);
                } else {
                    log('users', `Аккаунт сохранен: ${login} (${handle})`);
                    resolve();
                }
            }
        );
    });
}

// ==== ПОЛУЧИТЬ АККАУНТ ====
function getAccount(login) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM accounts WHERE login = ?', [login], (err, row) => {
            if (err || !row) {
                reject(err || new Error('Not found'));
            } else {
                resolve({
                    login: row.login,
                    handle: row.handle,
                    apiKey: row.api_key,
                    apiSecret: row.api_secret,
                    hasApiKeys: !!(row.api_key && row.api_secret),
                    created_at: row.created_at
                });
            }
        });
    });
}

// ==== ПРОВЕРКА ЛОГИНА ====
function checkLogin(login, password) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM accounts WHERE login = ?', [login], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            if (!row) {
                resolve(null);
                return;
            }

            const isValid = verifyPassword(password, row.password);
            if (isValid) {
                resolve({
                    login: row.login,
                    handle: row.handle,
                    apiKey: row.api_key,
                    apiSecret: row.api_secret,
                    hasApiKeys: !!(row.api_key && row.api_secret),
                    created_at: row.created_at
                });
            } else {
                resolve(null);
            }
        });
    });
}

// ==== ДОБАВИТЬ/ОБНОВИТЬ API КЛЮЧИ ====
function saveApiKeys(login, apiKey, apiSecret) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE accounts SET api_key = ?, api_secret = ? WHERE login = ?',
            [apiKey, apiSecret, login],
            function (err) {
                if (err) {
                    log('users', `Ошибка сохранения ключей ${login}: ${err.message}`);
                    reject(err);
                } else {
                    log('users', `API ключи сохранены для ${login}`);
                    resolve();
                }
            }
        );
    });
}

// ==== УДАЛИТЬ API КЛЮЧИ ====
function deleteApiKeys(login) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE accounts SET api_key = NULL, api_secret = NULL WHERE login = ?',
            [login],
            function (err) {
                if (err) {
                    log('users', `Ошибка удаления ключей ${login}: ${err.message}`);
                    reject(err);
                } else {
                    log('users', `API ключи удалены для ${login}`);
                    resolve();
                }
            }
        );
    });
}

// ==== УДАЛИТЬ АККАУНТ ====
function deleteAccount(login) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM accounts WHERE login = ?', [login], function (err) {
            if (err) {
                log('users', `Ошибка удаления аккаунта ${login}: ${err.message}`);
                reject(err);
            } else {
                log('users', `Аккаунт удален: ${login}`);
                resolve();
            }
        });
    });
}

// ==== ОБНОВИТЬ ХЕНДЛ ====
function updateHandle(login, newHandle) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE accounts SET handle = ? WHERE login = ?',
            [newHandle, login],
            function (err) {
                if (err) {
                    log('users', `Ошибка обновления хендла ${login}: ${err.message}`);
                    reject(err);
                } else if (this.changes === 0) {
                    reject(new Error('Account not found'));
                } else {
                    log('users', `Хендл обновлён: ${login} → ${newHandle}`);
                    resolve();
                }
            }
        );
    });
}

// ==== ПРОВЕРКА СУЩЕСТВОВАНИЯ ЛОГИНА ====
function loginExists(login) {
    return new Promise((resolve) => {
        db.get('SELECT 1 FROM accounts WHERE login = ?', [login], (err, row) => {
            resolve(!!row);
        });
    });
}

module.exports = {
    saveAccount,
    getAccount,
    checkLogin,
    saveApiKeys,
    deleteApiKeys,
    deleteAccount,
    loginExists,
    updateHandle
};