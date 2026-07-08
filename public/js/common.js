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
// ============================================
// ПЕРЕКЛЮЧЕНИЕ ТЕМЫ
// ============================================
function initThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        toggle.textContent = '☀️';
    }

    toggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            toggle.textContent = '🌙';
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            toggle.textContent = '☀️';
            localStorage.setItem('theme', 'dark');
        }
    });
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    initThemeToggle();

    const modalLoaded = await loadModal();
    if (!modalLoaded) {
        console.error('Модалка не загружена, функции аккаунта недоступны');
        return;
    }

    initAccountModal();
    loadSavedKeys();
    await loadUserFromServer();
    if (typeof fillIndividualHandle === 'function') fillIndividualHandle();
    await loadGroupModal();
    await loadUserGroups();
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
                // Сервер перезапущен, сессия потеряна — не чистим токен,
                // пользователь увидит что нужно войти заново
                currentLogin = null;
                currentHandle = null;
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

// ============================================
// ГРУППЫ
// ============================================
let userGroups = [];
let editingGroupId = null;
let selectedGroupId = null;

async function loadUserGroups() {
    const token = getToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE}/groups`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        userGroups = data.groups || [];
        updateGroupSelect();
    } catch (e) {
        console.error('Ошибка загрузки групп:', e);
    }
}

function updateGroupSelect() {
    renderGroupList();
    if (selectedGroupId) {
        const group = userGroups.find(g => g.id === selectedGroupId);
        if (group) {
            showSelectedGroup(group);
        } else {
            selectedGroupId = null;
            showGroupList();
        }
    } else {
        showGroupList();
    }
}

function renderGroupList() {
    const container = document.getElementById('group-list-items');
    if (!container) return;

    if (userGroups.length === 0) {
        container.innerHTML = '<div class="group-list-empty">Нет групп. Создайте первую</div>';
        return;
    }

    container.innerHTML = userGroups.map(g => `
        <div class="group-list-item" data-id="${g.id}">
            <span class="group-list-item-name">${g.name}</span>
            <button class="group-list-item-select" data-id="${g.id}">Выбрать</button>
        </div>
    `).join('');

    container.querySelectorAll('.group-list-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('group-list-item-select')) return;
            if (!checkAuth()) {
                alert('Войдите в аккаунт');
                document.getElementById('account-btn').click();
                return;
            }
            openGroupModal(parseInt(item.dataset.id));
        });
    });

    container.querySelectorAll('.group-list-item-select').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectGroup(parseInt(btn.dataset.id));
        });
    });
}

function selectGroup(id) {
    selectedGroupId = id;
    const group = userGroups.find(g => g.id === id);
    if (group) showSelectedGroup(group);
}

function showSelectedGroup(group) {
    document.getElementById('group-selected').style.display = 'flex';
    document.getElementById('group-selected-name').textContent = group.name;
    document.getElementById('group-list').style.display = 'none';
}

function showGroupList() {
    document.getElementById('group-selected').style.display = 'none';
    document.getElementById('group-list').style.display = 'flex';
    selectedGroupId = null;
}

async function loadGroupModal() {
    try {
        const res = await fetch('/modal-group.html');
        if (!res.ok) return false;
        const html = await res.text();
        document.getElementById('group-modal-placeholder').innerHTML = html;
        initGroupModal();
        return true;
    } catch (e) {
        return false;
    }
}

// ============================================
// GROUP MODAL — SVG ICONS
// ============================================
const GM_ICONS = {
    chevron: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>',
    plus: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
    check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
};

// ============================================
// GROUP MODAL — HELPERS
// ============================================
let gmOrgs = [];
let gmExpanded = {};
let gmTeamEditing = {};

function gmUid(p) { return p + Math.random().toString(36).slice(2, 8); }
function gmEscapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function gmEscapeAttr(s) { return gmEscapeHtml(s).replace(/"/g, '&quot;'); }

function gmBuildHandleCounts() {
    const counts = {};
    gmOrgs.forEach(o => o.teams.forEach(t => t.handles.forEach(h => {
        counts[h] = (counts[h] || 0) + 1;
    })));
    return counts;
}

function gmCountsFor(org) {
    const teams = org.teams.length;
    const handles = org.teams.reduce((s, t) => s + t.handles.length, 0);
    return { teams, handles };
}

function gmDecline(n, one, two, five) {
    const abs = Math.abs(n) % 100;
    const lastDigit = abs % 10;
    if (abs > 10 && abs < 20) return five;
    if (lastDigit > 1 && lastDigit < 5) return two;
    if (lastDigit === 1) return one;
    return five;
}

// ============================================
// GROUP MODAL — RENDER
// ============================================
function gmRenderTeam(orgId, team, handleCounts) {
    const editing = gmTeamEditing[team.id];
    return `
    <div class="gm-team-row" data-team="${team.id}">
      <div class="gm-team-row-top">
        ${editing
            ? `<input type="text" class="gm-team-name-input" placeholder="Команда" value="${gmEscapeAttr(team.name)}" data-action="gm-team-name" data-org="${orgId}" data-team="${team.id}">`
            : `<span class="gm-team-name-text" data-action="gm-edit-team" data-org="${orgId}" data-team="${team.id}">${gmEscapeHtml(team.name) || 'Без названия'}</span>`}
        <span class="gm-count-badge small">${team.handles.length}</span>
        <button type="button" class="gm-icon-btn danger" data-action="gm-remove-team" data-org="${orgId}" data-team="${team.id}" title="Удалить команду">${GM_ICONS.trash}</button>
      </div>
      <div class="gm-handle-chips">
        ${team.handles.map(h => {
            const dup = handleCounts[h] > 1;
            return `<span class="gm-handle-chip${dup ? ' dup' : ''}"${dup ? ' title="Этот хендл уже есть в другой команде"' : ''}>${gmEscapeHtml(h)}<button type="button" data-action="gm-remove-handle" data-org="${orgId}" data-team="${team.id}" data-handle="${gmEscapeAttr(h)}">&times;</button></span>`;
        }).join('')}
        <input type="text" class="gm-handle-input" placeholder="${team.handles.length ? '' : 'хэндл + пробел / вставьте списком'}" data-action="gm-handle-input" data-org="${orgId}" data-team="${team.id}">
      </div>
    </div>`;
}

function gmRenderOrgs(focus) {
    const container = document.getElementById('group-orgs');
    if (!container) return;

    if (gmOrgs.length === 0) {
        container.innerHTML = '<div class="gm-orgs-empty">Пока нет вузов и школ. Добавьте первый, чтобы начать формировать команды.</div>';
        return;
    }

    const handleCounts = gmBuildHandleCounts();
    container.innerHTML = gmOrgs.map(org => {
        const c = gmCountsFor(org);
        const expanded = gmExpanded[org.id];
        return `
      <div class="gm-org-card${expanded ? ' expanded' : ''}" data-org="${org.id}">
        ${expanded
            ? `<div class="gm-org-header">
          <button type="button" class="gm-icon-btn gm-chevron-btn" data-action="gm-toggle-org" data-org="${org.id}">${GM_ICONS.chevron}</button>
          <input type="text" class="gm-org-name-input" placeholder="Учебная организация" value="${gmEscapeAttr(org.name)}" data-action="gm-org-name" data-org="${org.id}">
          <button type="button" class="gm-icon-btn danger" data-action="gm-remove-org" data-org="${org.id}" title="Удалить организацию">${GM_ICONS.trash}</button>
        </div>`
            : `<div class="gm-org-collapsed" data-action="gm-toggle-org" data-org="${org.id}">
          <button type="button" class="gm-icon-btn gm-chevron-btn rotated">${GM_ICONS.chevron}</button>
          <span class="gm-org-name-text">${gmEscapeHtml(org.name) || 'Без названия'}</span>
          <span class="gm-count-badge">${c.teams} ${gmDecline(c.teams, 'команда', 'команды', 'команд')} · ${c.handles} ${gmDecline(c.handles, 'хэндл', 'хэндла', 'хэндлов')}</span>
        </div>`}
        <div class="gm-org-body${expanded ? '' : ' collapsed'}" id="gm-org-body-${org.id}">
          <div class="gm-team-list">${org.teams.map(t => gmRenderTeam(org.id, t, handleCounts)).join('')}</div>
          <button type="button" class="gm-btn-add-inline" data-action="gm-add-team" data-org="${org.id}">${GM_ICONS.plus} Команда</button>
        </div>
      </div>`;
    }).join('');

    gmFocusAfterRender(focus);
    container.querySelectorAll('.gm-handle-input').forEach(input => gmUpdateHandlePlaceholder(input));
}

function gmFocusAfterRender(focus) {
    if (!focus) return;
    const container = document.getElementById('group-orgs');
    let el = null;
    if (focus.orgId && focus.field === 'org-name')
        el = container.querySelector(`[data-org="${focus.orgId}"] .gm-org-name-input`);
    else if (focus.teamId && focus.field === 'team-name')
        el = container.querySelector(`[data-team="${focus.teamId}"] .gm-team-name-input`);
    else if (focus.teamId && focus.field === 'handle-input')
        el = container.querySelector(`[data-team="${focus.teamId}"] .gm-handle-input`);
    if (el) {
        el.focus();
        el.select();
    }
}

function gmAddHandles(team, rawList) {
    let added = false;
    rawList.forEach(v => {
        const value = v.trim();
        if (value && !team.handles.includes(value)) { team.handles.push(value); added = true; }
    });
    return added;
}

function gmUpdateHandlePlaceholder(input) {
    const chips = input.closest('.gm-handle-chips');
    const hasChips = chips.querySelector('.gm-handle-chip');
    input.placeholder = hasChips ? '' : 'хэндл + пробел / вставьте списком';
}

// ============================================
// GROUP MODAL — EVENT DELEGATION
// ============================================
function gmInitOrgEvents() {
    const container = document.getElementById('group-orgs');
    if (!container || container._gmEventsInit) return;
    container._gmEventsInit = true;

    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;

        if (action === 'gm-toggle-org') {
            const orgId = btn.dataset.org;
            gmExpanded[orgId] = !gmExpanded[orgId];
            gmRenderOrgs();
        } else if (action === 'gm-remove-org') {
            gmOrgs = gmOrgs.filter(o => o.id !== btn.dataset.org);
            gmRenderOrgs();
        } else if (action === 'gm-add-team') {
            const org = gmOrgs.find(o => o.id === btn.dataset.org);
            const t = { id: gmUid('t'), name: '', handles: [] };
            org.teams.push(t);
            gmTeamEditing[t.id] = true;
            gmRenderOrgs({ teamId: t.id, field: 'team-name' });
        } else if (action === 'gm-edit-team') {
            gmTeamEditing[btn.dataset.team] = true;
            gmRenderOrgs({ teamId: btn.dataset.team, field: 'team-name' });
        } else if (action === 'gm-remove-team') {
            const org = gmOrgs.find(o => o.id === btn.dataset.org);
            org.teams = org.teams.filter(t => t.id !== btn.dataset.team);
            gmRenderOrgs();
        } else if (action === 'gm-remove-handle') {
            const org = gmOrgs.find(o => o.id === btn.dataset.org);
            const team = org.teams.find(t => t.id === btn.dataset.team);
            team.handles = team.handles.filter(h => h !== btn.dataset.handle);
            const chips = btn.closest('.gm-handle-chips');
            btn.closest('.gm-handle-chip').remove();
            const input = chips.querySelector('.gm-handle-input');
            if (input) gmUpdateHandlePlaceholder(input);
        }
    });

    container.addEventListener('input', (e) => {
        const el = e.target;
        if (el.dataset.action === 'gm-org-name') {
            const org = gmOrgs.find(o => o.id === el.dataset.org);
            if (org) org.name = el.value;
        } else if (el.dataset.action === 'gm-team-name') {
            const org = gmOrgs.find(o => o.id === el.dataset.org);
            if (org) {
                const team = org.teams.find(t => t.id === el.dataset.team);
                if (team) team.name = el.value;
            }
        }
    });

    container.addEventListener('blur', (e) => {
        const el = e.target;
        if (el.dataset.action === 'gm-team-name') {
            const teamId = el.dataset.team;
            gmTeamEditing[teamId] = false;
            gmRenderOrgs();
        }
    }, true);

    container.addEventListener('keydown', (e) => {
        const el = e.target;
        if (el.dataset.action === 'gm-org-name' && e.key === 'Enter') {
            e.preventDefault();
            const firstTeamName = el.closest('.gm-org-card').querySelector('.gm-team-name-input');
            if (firstTeamName) firstTeamName.focus();
            return;
        }
        if (el.dataset.action === 'gm-team-name' && e.key === 'Enter') {
            e.preventDefault();
            const handleInput = el.closest('.gm-team-row').querySelector('.gm-handle-input');
            if (handleInput) handleInput.focus();
            return;
        }
        if (el.dataset.action !== 'gm-handle-input') return;
        if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
            e.preventDefault();
            const value = el.value.trim().replace(/[, ]+$/, '');
            if (!value) return;
            const org = gmOrgs.find(o => o.id === el.dataset.org);
            const team = org.teams.find(t => t.id === el.dataset.team);
            if (gmAddHandles(team, [value])) {
                const chips = el.closest('.gm-handle-chips');
                const dup = gmBuildHandleCounts()[value] > 1;
                const chip = document.createElement('span');
                chip.className = 'gm-handle-chip' + (dup ? ' dup' : '');
                if (dup) chip.title = 'Этот хендл уже есть в другой команде';
                chip.innerHTML = `${gmEscapeHtml(value)}<button type="button" data-action="gm-remove-handle" data-org="${el.dataset.org}" data-team="${el.dataset.team}" data-handle="${gmEscapeAttr(value)}">&times;</button>`;
                chips.insertBefore(chip, el);
                el.value = '';
                el.focus();
                gmUpdateHandlePlaceholder(el);
            }
        } else if (e.key === 'Backspace' && el.value === '') {
            const org = gmOrgs.find(o => o.id === el.dataset.org);
            const team = org.teams.find(t => t.id === el.dataset.team);
            if (team.handles.length) {
                team.handles.pop();
                const chips = el.closest('.gm-handle-chips');
                const lastChip = chips.querySelector('.gm-handle-chip:last-of-type');
                if (lastChip) lastChip.remove();
                gmUpdateHandlePlaceholder(el);
            }
        }
    });

    container.addEventListener('paste', (e) => {
        const el = e.target;
        if (el.dataset.action !== 'gm-handle-input') return;
        const text = (e.clipboardData || window.clipboardData).getData('text');
        if (!text || !/[\s,;\n]/.test(text.trim())) return;
        e.preventDefault();
        const parts = text.split(/[\s,;\n]+/).filter(Boolean);
        const org = gmOrgs.find(o => o.id === el.dataset.org);
        const team = org.teams.find(t => t.id === el.dataset.team);
        if (gmAddHandles(team, parts)) {
            const chips = el.closest('.gm-handle-chips');
            const counts = gmBuildHandleCounts();
            for (const h of parts) {
                const trimmed = h.trim();
                if (!trimmed) continue;
                const dup = counts[trimmed] > 1;
                const chip = document.createElement('span');
                chip.className = 'gm-handle-chip' + (dup ? ' dup' : '');
                if (dup) chip.title = 'Этот хендл уже есть в другой команде';
                chip.innerHTML = `${gmEscapeHtml(trimmed)}<button type="button" data-action="gm-remove-handle" data-org="${el.dataset.org}" data-team="${el.dataset.team}" data-handle="${gmEscapeAttr(trimmed)}">&times;</button>`;
                chips.insertBefore(chip, el);
            }
            el.value = '';
            el.focus();
            gmUpdateHandlePlaceholder(el);
        }
    });
}

// ============================================
// GROUP MODAL — OPEN / CLOSE / SAVE / DELETE
// ============================================
function initGroupModal() {
    const overlay = document.getElementById('group-modal-overlay');
    const closeBtn = document.getElementById('group-modal-close');
    const addOrgBtn = document.getElementById('add-org-btn');
    const saveBtn = document.getElementById('group-save-btn');
    const deleteBtn = document.getElementById('group-delete-btn');

    closeBtn.addEventListener('click', closeGroupModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeGroupModal();
    });

    addOrgBtn.addEventListener('click', () => {
        const org = { id: gmUid('o'), name: '', teams: [{ id: gmUid('t'), name: '', handles: [] }] };
        gmOrgs.push(org);
        gmExpanded[org.id] = true;
        gmRenderOrgs();
    });

    saveBtn.addEventListener('click', saveGroup);
    deleteBtn.addEventListener('click', deleteGroup);

    document.getElementById('cancel-btn').addEventListener('click', closeGroupModal);

    document.getElementById('copy-group-link').addEventListener('click', () => {
        const link = document.getElementById('group-public-link').textContent;
        navigator.clipboard.writeText(link).then(() => {
            const btn = document.getElementById('copy-group-link');
            const original = btn.innerHTML;
            btn.innerHTML = GM_ICONS.check;
            setTimeout(() => { btn.innerHTML = original; }, 1500);
        });
    });

    document.getElementById('create-group-btn').addEventListener('click', () => {
        if (!checkAuth()) {
            alert('Войдите в аккаунт, чтобы создавать группы');
            document.getElementById('account-btn').click();
            return;
        }
        openGroupModal();
    });

    document.getElementById('change-group-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showGroupList();
    });

    document.getElementById('group-selected').addEventListener('click', () => {
        if (!checkAuth()) {
            alert('Войдите в аккаунт');
            document.getElementById('account-btn').click();
            return;
        }
        if (selectedGroupId) openGroupModal(selectedGroupId);
    });

    gmInitOrgEvents();
}

function openGroupModal(groupId = null) {
    editingGroupId = groupId;
    gmExpanded = {};
    gmTeamEditing = {};
    const overlay = document.getElementById('group-modal-overlay');
    const title = document.getElementById('group-modal-title');
    const deleteBtn = document.getElementById('group-delete-btn');
    const createdRow = document.getElementById('group-created-row');
    const linkRow = document.getElementById('group-link-row-wrapper');

    if (groupId) {
        title.textContent = 'Редактировать группу';
        deleteBtn.style.display = 'inline-flex';
        createdRow.style.display = 'flex';
        linkRow.style.display = 'flex';
        const group = userGroups.find(g => g.id === groupId);
        if (group) {
            document.getElementById('group-name').value = group.name;
            document.getElementById('group-description').value = group.description || '';
            const date = new Date(group.created_at);
            document.getElementById('group-created-at').textContent = date.toLocaleDateString('ru-RU');
            const link = `${window.location.origin}/group/${groupId}`;
            const linkEl = document.getElementById('group-public-link');
            linkEl.href = link;
            linkEl.textContent = link;
        }
        gmLoadMembersForEdit(groupId);
    } else {
        title.textContent = 'Создать группу';
        deleteBtn.style.display = 'none';
        createdRow.style.display = 'none';
        linkRow.style.display = 'none';
        document.getElementById('group-name').value = '';
        document.getElementById('group-description').value = '';
        gmOrgs = [{ id: gmUid('o'), name: '', teams: [{ id: gmUid('t'), name: '', handles: [] }] }];
        gmRenderOrgs();
    }

    overlay.style.display = 'flex';
}

function closeGroupModal() {
    document.getElementById('group-modal-overlay').style.display = 'none';
    editingGroupId = null;
}

async function gmLoadMembersForEdit(groupId) {
    const token = getToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE}/groups/${groupId}/members`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const { members } = await res.json();

        const orgMap = {};
        for (const m of members) {
            const org = m.org_name || '';
            if (!orgMap[org]) orgMap[org] = {};
            const team = m.team_name || '';
            if (!orgMap[org][team]) orgMap[org][team] = [];
            orgMap[org][team].push(m.handle);
        }

        gmOrgs = Object.entries(orgMap).map(([orgName, teams]) => ({
            id: gmUid('o'), name: orgName,
            teams: Object.entries(teams).map(([teamName, handles]) => ({
                id: gmUid('t'), name: teamName, handles
            }))
        }));

        if (gmOrgs.length === 0) {
            gmOrgs = [{ id: gmUid('o'), name: '', teams: [{ id: gmUid('t'), name: '', handles: [] }] }];
        }

        gmRenderOrgs();
    } catch (e) {
        console.error('Ошибка загрузки участников:', e);
    }
}

async function saveGroup() {
    const name = document.getElementById('group-name').value.trim();
    const description = document.getElementById('group-description').value.trim();

    if (!name) {
        alert('Введите название группы');
        return;
    }

    const members = [];
    for (const org of gmOrgs) {
        for (const team of org.teams) {
            for (const handle of team.handles) {
                members.push({ handle, org_name: org.name, team_name: team.name });
            }
        }
    }

    const token = getToken();
    const body = { name, description, members };

    try {
        let res;
        if (editingGroupId) {
            res = await fetch(`${API_BASE}/groups/${editingGroupId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });
        } else {
            res = await fetch(`${API_BASE}/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });
        }

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }

        closeGroupModal();
        await loadUserGroups();
    } catch (e) {
        alert('Ошибка сохранения: ' + e.message);
    }
}

async function deleteGroup() {
    if (!editingGroupId) return;
    if (!confirm('Удалить группу?')) return;

    const token = getToken();
    try {
        await fetch(`${API_BASE}/groups/${editingGroupId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        closeGroupModal();
        await loadUserGroups();
    } catch (e) {
        alert('Ошибка удаления: ' + e.message);
    }
}

window.CodeforcesAccount = {
    getApiKeys,
    getCurrentHandle,
    clearApiKeys,
    saveApiKeys,
    loadSavedKeys,
    updateHandle,
    loadUserGroups,
    getGroups: () => userGroups,
    getSelectedGroup: () => {
        if (!selectedGroupId) return null;
        return userGroups.find(g => g.id === selectedGroupId) || null;
    }
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