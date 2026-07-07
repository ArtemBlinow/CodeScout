const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');

if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Логирование
 * @param {string} type - contests / users / system
 * @param {string} msg - Сообщение
 */
function log(type, msg) {
    const logFile = path.join(LOGS_DIR, `${type}.log`);
    const date = new Date().toLocaleString('ru-RU');
    const line = `[${date}] ${msg}\n`;
    fs.appendFileSync(logFile, line, 'utf8');
}

module.exports = { log };
