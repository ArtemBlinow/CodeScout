// ============================================
// COMMON.JS — Управление аккаунтом и API ключами
// ============================================

// Глобальные переменные
let apiKey = null;
let apiSecret = null;
let storageMode = 'local';
let currentLogin = null;
let currentHandle = null;

// API endpoint
const API_BASE = '/api';

// ============================================
// ЗАГРУЗКА КОМПОНЕНТОВ
// ============================================
async function loadModal() {
    try {
        const response = await fetch('/modal-account.html');
        if (!response.ok) throw new Error('Modal not found');
        const html = await response.text();
        document.getElementById('modal-placeholder').innerHTML = html;
        console.log('✅ Модалка загружена');
        return true;
    } catch (err) {
        console.error('❌ Ошибка загрузки модалки:', err);
        return false;
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    const modalLoaded = await loadModal();
    if (!modalLoaded) {
        console.error('Модалка не загружена, функции аккаунта недоступны');
        return;
    }

    initAccountModal();
    loadSavedKeys();
    await loadUserFromServer();
});

// ============================================
// ЗАГРУЗКА ДАННЫХ ПОЛЬЗОВАТЕЛЯ С СЕРВЕРА
// ============================================
async function loadUserFromServer() {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE}/account`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                handleLogout();
            }
            return;
        }

        const data = await response.json();
        currentLogin = data.login;
        currentHandle = data.handle;

        console.log('✅ Данные пользователя загружены:', currentLogin, currentHandle);
    } catch (err) {
        console.error('❌ Ошибка загрузки пользователя:', err);
    }
}

// ============================================
// ЗАГРУЗКА КЛЮЧЕЙ ПРИ СТАРТЕ
// ============================================
function loadSavedKeys() {
    const sessionKey = sessionStorage.getItem('cf_api_key');
    const sessionSecret = sessionStorage.getItem('cf_api_secret');

    if (sessionKey && sessionSecret) {
        apiKey = sessionKey;
        apiSecret = sessionSecret;
        storageMode = 'session';
        console.log('✅ Ключи загружены из sessionStorage (временное хранение)');
        return;
    }

    const localKey = localStorage.getItem('cf_api_key');
    const localSecret = localStorage.getItem('cf_api_secret');

    if (localKey && localSecret) {
        apiKey = localKey;
        apiSecret = localSecret;
        storageMode = 'local';
        console.log('✅ Ключи загружены из localStorage (постоянное хранение)');
        return;
    }

    // Ключей нет — по умолчанию session
    storageMode = 'session';
    console.log('ℹ️ API ключи не найдены');
}

// ============================================
// МОДАЛЬНОЕ ОКНО АККАУНТА
// ============================================
function initAccountModal() {
    const overlay = document.getElementById('modal-overlay');
    const accountBtn = document.getElementById('account-btn');
    const closeBtn = document.getElementById('modal-close');

    accountBtn.addEventListener('click', () => {
        overlay.style.display = 'flex';
        updateModalUI();
    });

    closeBtn.addEventListener('click', () => {
        overlay.style.display = 'none';
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
        }
    });

    // Табы
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('login-form').style.display = tabName === 'login' ? 'block' : 'none';
            document.getElementById('register-form').style.display = tabName === 'register' ? 'block' : 'none';
        });
    });

    // Кнопки
    document.getElementById('modal-login-btn').addEventListener('click', handleLogin);
    document.getElementById('modal-register-btn').addEventListener('click', handleRegister);
    document.getElementById('save-keys-btn').addEventListener('click', saveApiKeys);
    document.getElementById('update-handle-btn').addEventListener('click', updateHandle);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('delete-account-btn').addEventListener('click', handleDeleteAccount);

    // Enter в полях
    document.getElementById('modal-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('modal-reg-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
}

// ============================================
// ОБНОВЛЕНИЕ UI МОДАЛКИ
// ============================================
function updateModalUI() {
    const isLoggedIn = checkAuth();

    document.getElementById('auth-view').style.display = isLoggedIn ? 'none' : 'block';
    document.getElementById('account-view').style.display = isLoggedIn ? 'block' : 'none';
    document.getElementById('modal-title').textContent = isLoggedIn ? 'Аккаунт' : 'Вход / Регистрация';

    if (isLoggedIn) {
        // Логин
        document.getElementById('account-login').textContent = currentLogin || 'user';

        // Хендл Codeforces
        document.getElementById('profile-handle').value = currentHandle || '';

        // Статус API ключей
        const statusBadge = document.getElementById('api-keys-status');
        if (apiKey && apiSecret) {
            statusBadge.textContent = 'ключи есть';
            statusBadge.className = 'status-badge status-ok';
        } else {
            statusBadge.textContent = 'нет ключей';
            statusBadge.className = 'status-badge status-no';
        }

        // Поля ключей
        document.getElementById('api-key').value = apiKey || '';
        document.getElementById('api-secret').value = apiSecret || '';

        // Radio — определяем, что выбрано
        const radioLocal = document.querySelector('input[name="storage-mode"][value="local"]');
        const radioSession = document.querySelector('input[name="storage-mode"][value="session"]');

        if (radioLocal && radioSession) {
            // Если ключи есть — смотрим storageMode
            if (apiKey && apiSecret) {
                radioLocal.checked = (storageMode === 'local');
                radioSession.checked = (storageMode === 'session');
            } else {
                // Если ключей нет — по умолчанию "только на сессию"
                radioLocal.checked = false;
                radioSession.checked = true;
                storageMode = 'session';
            }
        }

        // Скрываем статус хендла
        const handleStatus = document.getElementById('handle-status');
        if (handleStatus) {
            handleStatus.style.display = 'none';
        }
    }

    // Очищаем сообщение
    document.getElementById('modal-message').textContent = '';
    document.getElementById('modal-message').className = 'modal-footer';
}

// ============================================
// АВТОРИЗАЦИЯ
// ============================================
function checkAuth() {
    return !!(localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'));
}

function getToken() {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

// ============================================
// ВХОД
// ============================================
async function handleLogin() {
    const login = document.getElementById('modal-login').value.trim();
    const password = document.getElementById('modal-password').value;

    if (!login || !password) {
        showMessage('Заполните все поля', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });

        if (!response.ok) {
            const err = await response.json();
            showMessage(err.error || 'Ошибка входа', 'error');
            return;
        }

        const data = await response.json();

        // Сохраняем токен
        localStorage.setItem('auth_token', data.token);
        currentLogin = data.login;
        currentHandle = data.handle;

        // Загружаем ключи из хранилища
        loadSavedKeys();

        // Обновляем UI
        updateModalUI();

        showMessage('Вход выполнен успешно', 'success');

        // Очищаем поля
        document.getElementById('modal-login').value = '';
        document.getElementById('modal-password').value = '';

    } catch (err) {
        showMessage('Ошибка соединения с сервером', 'error');
        console.error(err);
    }
}

// ============================================
// РЕГИСТРАЦИЯ
// ============================================
async function handleRegister() {
    const login = document.getElementById('modal-reg-login').value.trim();
    const password = document.getElementById('modal-reg-password').value;
    const handle = document.getElementById('modal-reg-handle').value.trim();

    if (!login || !password || !handle) {
        showMessage('Заполните все поля', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password, handle })
        });

        if (!response.ok) {
            const err = await response.json();
            showMessage(err.error || 'Ошибка регистрации', 'error');
            return;
        }

        const data = await response.json();

        localStorage.setItem('auth_token', data.token);
        currentLogin = login;
        currentHandle = handle;

        // Загружаем ключи
        loadSavedKeys();

        // Обновляем UI
        updateModalUI();

        // Очищаем поля
        document.getElementById('modal-reg-login').value = '';
        document.getElementById('modal-reg-password').value = '';
        document.getElementById('modal-reg-handle').value = '';

    } catch (err) {
        showMessage('Ошибка соединения с сервером', 'error');
        console.error(err);
    }
}

// ============================================
// ОБНОВЛЕНИЕ ХЕНДЛА
// ============================================
async function updateHandle() {
    const newHandle = document.getElementById('profile-handle').value.trim();

    if (!newHandle) {
        showHandleStatus('Введите хендл', 'error');
        return;
    }

    const token = getToken();
    if (!token) {
        showHandleStatus('Вы не авторизованы', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/account/handle`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ handle: newHandle })
        });

        if (!response.ok) {
            const err = await response.json();
            showHandleStatus(err.error || 'Ошибка обновления', 'error');
            return;
        }

        currentHandle = newHandle;
        showHandleStatus(`Хендл изменён на ${newHandle}`, 'success');

    } catch (err) {
        showHandleStatus('Ошибка соединения с сервером', 'error');
        console.error(err);
    }
}

function showHandleStatus(text, type) {
    const el = document.getElementById('handle-status');
    if (!el) return;

    el.textContent = text;
    el.className = `handle-status ${type}`;
    el.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => {
            el.style.display = 'none';
        }, 3000);
    }
}

// ============================================
// ВЫХОД (удаляет ключи всегда)
// ============================================
function handleLogout() {
    // Удаляем ключи
    clearApiKeys();

    // Удаляем токен
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');

    // Очищаем переменные
    apiKey = null;
    apiSecret = null;
    currentLogin = null;
    currentHandle = null;
    storageMode = 'local';

    updateModalUI();
}

// ============================================
// УДАЛЕНИЕ АККАУНТА
// ============================================
async function handleDeleteAccount() {
    if (!confirm('Вы уверены? Аккаунт будет удалён безвозвратно.')) return;

    const token = getToken();

    try {
        await fetch(`${API_BASE}/account`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (err) {
        console.error('Ошибка удаления на сервере:', err);
    }

    // Очищаем всё
    clearApiKeys();
    localStorage.clear();
    sessionStorage.clear();

    apiKey = null;
    apiSecret = null;
    currentLogin = null;
    currentHandle = null;
    storageMode = 'local';

    updateModalUI();
}

// ============================================
// СОХРАНЕНИЕ API КЛЮЧЕЙ (локально)
// ============================================
function saveApiKeys() {
    const key = document.getElementById('api-key').value.trim();
    const secret = document.getElementById('api-secret').value.trim();

    if (!key || !secret) {
        showMessage('Введите API Key и API Secret', 'error');
        return;
    }

    const radioLocal = document.querySelector('input[name="storage-mode"][value="local"]');
    const radioSession = document.querySelector('input[name="storage-mode"][value="session"]');

    // Если radio не выбраны (маловероятно, но на всякий случай) — по умолчанию session
    if (radioSession && radioSession.checked) {
        storageMode = 'session';
    } else if (radioLocal && radioLocal.checked) {
        storageMode = 'local';
    } else {
        storageMode = 'session';
    }

    apiKey = key;
    apiSecret = secret;

    if (storageMode === 'local') {
        localStorage.setItem('cf_api_key', key);
        localStorage.setItem('cf_api_secret', secret);
        sessionStorage.removeItem('cf_api_key');
        sessionStorage.removeItem('cf_api_secret');
        console.log('💾 Ключи сохранены в localStorage');
    } else {
        sessionStorage.setItem('cf_api_key', key);
        sessionStorage.setItem('cf_api_secret', secret);
        localStorage.removeItem('cf_api_key');
        localStorage.removeItem('cf_api_secret');
        console.log('⏳ Ключи сохранены в sessionStorage');
    }

    updateModalUI();
    showMessage('API ключи сохранены', 'success');
}

// ============================================
// ОЧИСТКА КЛЮЧЕЙ
// ============================================
function clearApiKeys() {
    apiKey = null;
    apiSecret = null;
    storageMode = 'local';
    localStorage.removeItem('cf_api_key');
    localStorage.removeItem('cf_api_secret');
    sessionStorage.removeItem('cf_api_key');
    sessionStorage.removeItem('cf_api_secret');
    console.log('🗑️ Ключи удалены');
}

// ============================================
// ПОЛУЧЕНИЕ ДАННЫХ (для findcontest.js)
// ============================================
function getApiKeys() {
    return {
        key: apiKey,
        secret: apiSecret,
        hasKeys: !!(apiKey && apiSecret),
        storageMode
    };
}

function getCurrentHandle() {
    return currentHandle;
}

window.CodeforcesAccount = {
    getApiKeys,
    getCurrentHandle,
    clearApiKeys,
    saveApiKeys,
    loadSavedKeys,
    updateHandle
};

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================
function showMessage(text, type = '') {
    const footer = document.getElementById('modal-message');
    footer.textContent = text;
    footer.className = 'modal-footer';
    if (type) footer.classList.add(type);

    setTimeout(() => {
        footer.textContent = '';
        footer.className = 'modal-footer';
    }, 3000);
}