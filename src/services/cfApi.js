const crypto = require('crypto');
const https = require('https');
const { log } = require('./logger');

// Базовый запрос к CF API
function fetchCF(methodPath) {
    return new Promise((resolve, reject) => {
        const url = `https://codeforces.com/api/${methodPath}`;
        log('contests', `CF GET ${methodPath}`);

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.status === 'OK') {
                        resolve(json.result);
                    } else {
                        reject(new Error(json.comment || 'API error'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Авторизованный запрос
function fetchCFAuth(method, params, apiKey, apiSecret) {
    return new Promise((resolve, reject) => {
        const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        const time = Math.floor(Date.now() / 1000);
        const allParams = { ...params, apiKey, time };
        const sortedKeys = Object.keys(allParams).sort();
        const paramString = sortedKeys.map(k => `${k}=${allParams[k]}`).join('&');
        const signString = `${rand}/${method}?${paramString}#${apiSecret}`;
        const hash = crypto.createHash('sha512').update(signString).digest('hex');
        const apiSig = rand + hash;
        const url = `https://codeforces.com/api/${method}?${paramString}&apiSig=${apiSig}`;

        log('contests', `CF AUTH ${method}`);

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.status === 'OK') {
                        resolve(json.result);
                    } else {
                        reject(new Error(json.comment || 'API error'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Проверка ключей
async function verifyCredentials(handle, apiKey, apiSecret) {
    try {
        const result = await fetchCFAuth('user.info', {
            handles: handle
        }, apiKey, apiSecret);
        return result && Array.isArray(result) && result.length > 0;
    } catch (error) {
        log('users', `Ошибка проверки ключей ${handle}: ${error.message}`);
        return false;
    }
}

// Получить список тренировок
async function getGymList() {
    log('contests', 'Загрузка списка тренировок...');
    const gyms = await fetchCF('contest.list?gym=true');
    log('contests', `Загружено ${gyms.length} тренировок`);
    return gyms;
}

// Проверка участия в контесте
async function checkUserInContest(contestId, handle, apiKey, apiSecret) {
    try {
        const result = await fetchCFAuth('contest.standings', {
            contestId,
            handles: handle,
            showUnofficial: 'true'
        }, apiKey, apiSecret);
        return result.rows && result.rows.length > 0;
    } catch {
        return false;
    }
}

// Поиск случайной тренировки
async function findRandomGym(handles, difficulty, type, apiKey, apiSecret, cache) {
    const filtered = cache.getGyms({ difficulty, type });

    if (filtered.length === 0) {
        return { error: 'Нет тренировок по фильтрам' };
    }

    const shuffled = [...filtered].sort(() => Math.random() - 0.5);

    for (const gym of shuffled) {
        let someoneParticipated = false;
        for (const handle of handles) {
            const participated = await checkUserInContest(gym.id, handle, apiKey, apiSecret);
            if (participated) {
                someoneParticipated = true;
                break;
            }
            await new Promise(r => setTimeout(r, 2000));
        }
        if (!someoneParticipated) {
            return {
                gym,
                total: shuffled.length,
                checked: shuffled.indexOf(gym) + 1
            };
        }
    }

    return { error: 'Все тренировки заняты' };
}

module.exports = {
    getGymList,
    checkUserInContest,
    findRandomGym,
    verifyCredentials
};