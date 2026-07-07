const fs = require('fs').promises;
const path = require('path');
const cfApi = require('./cfApi');
const { log } = require('./logger');

const CACHE_FILE = path.join(__dirname, '..', '..', 'data', 'gyms.json');
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 дней

class Cache {
    constructor() {
        this.gyms = [];
        this.lastUpdated = null;
    }

    async load() {
        try {
            const data = await fs.readFile(CACHE_FILE, 'utf8');
            const cache = JSON.parse(data);
            this.gyms = cache.gyms || [];
            this.lastUpdated = new Date(cache.lastUpdated);
            log('system', `Кэш загружен: ${this.gyms.length} тренировок`);
            return true;
        } catch {
            log('system', 'Кэш не найден');
            return false;
        }
    }

    async save() {
        try {
            const dir = path.dirname(CACHE_FILE);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(CACHE_FILE, JSON.stringify({
                gyms: this.gyms,
                lastUpdated: new Date().toISOString()
            }, null, 2));
            log('system', `Кэш сохранен: ${this.gyms.length} тренировок`);
        } catch (error) {
            log('system', `Ошибка сохранения кэша: ${error.message}`);
        }
    }

    needsRefresh() {
        if (!this.lastUpdated) return true;
        return Date.now() - this.lastUpdated.getTime() > CACHE_TTL;
    }

    async refresh() {
        log('system', 'Обновление кэша...');
        try {
            const gyms = await cfApi.getGymList();
            this.gyms = gyms.map(g => ({
                id: g.id,
                name: g.name,
                type: g.type,
                difficulty: g.difficulty,
                durationSeconds: g.durationSeconds,
                startTimeSeconds: g.startTimeSeconds
            }));
            this.lastUpdated = new Date();
            await this.save();
            log('system', `Кэш обновлен: ${this.gyms.length} тренировок`);
            return true;
        } catch (error) {
            log('system', `Ошибка обновления кэша: ${error.message}`);
            return false;
        }
    }

    getGyms(filters = {}) {
        let result = this.gyms;
        if (filters.difficulty) {
            result = result.filter(g => String(g.difficulty) === String(filters.difficulty));
        }
        if (filters.type) {
            result = result.filter(g => g.type === filters.type);
        }
        return result;
    }

    getInfo() {
        return {
            total: this.gyms.length,
            lastUpdated: this.lastUpdated,
            age: this.lastUpdated ?
                `${Math.round((Date.now() - this.lastUpdated.getTime()) / (24 * 60 * 60 * 1000))} дней` :
                'никогда'
        };
    }
}

const cache = new Cache();

async function initializeCache() {
    const loaded = await cache.load();
    if (!loaded || cache.needsRefresh()) {
        await cache.refresh();
    }
}

module.exports = { cache, initializeCache };