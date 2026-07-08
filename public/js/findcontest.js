// ============================================
// FINDCONTEST.JS — Поиск контестов
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    initDifficultyScaleSwitch();
    initSearchMode();
    initSearchButton();
    initToggleButtons();
});

// ============================================
// ПЕРЕКЛЮЧЕНИЕ ШКАЛ СЛОЖНОСТИ
// ============================================
function initDifficultyScaleSwitch() {
    const scaleGroup = document.getElementById('difficulty-scale');
    const starsPanel = document.getElementById('scale-stars');
    const relativePanel = document.getElementById('scale-relative');

    scaleGroup.addEventListener('click', (e) => {
        if (!e.target.classList.contains('toggle-btn')) return;

        scaleGroup.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.classList.add('active');

        const scale = e.target.dataset.value;

        if (scale === 'stars') {
            starsPanel.style.display = 'block';
            relativePanel.style.display = 'none';
        } else {
            starsPanel.style.display = 'none';
            relativePanel.style.display = 'block';
        }
    });
}

// ============================================
// РЕЖИМ ПОИСКА (индивидуальный / командный / групповой)
// ============================================
function initSearchMode() {
    const modeGroup = document.getElementById('search-mode');
    const groupSelector = document.getElementById('group-selector');
    const teamPanel = document.getElementById('team-search-panel');
    const individualPanel = document.getElementById('individual-panel');
    if (!modeGroup) return;

    function updateVisibility() {
        const active = modeGroup.querySelector('.toggle-btn.active');
        const mode = active?.dataset.value || 'individual';
        if (individualPanel) individualPanel.style.display = mode === 'individual' ? '' : 'none';
        if (groupSelector) groupSelector.style.display = mode === 'group' ? '' : 'none';
        if (teamPanel) teamPanel.style.display = mode === 'team' ? '' : 'none';
    }

    modeGroup.addEventListener('click', (e) => {
        if (!e.target.classList.contains('toggle-btn')) return;
        modeGroup.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        updateVisibility();
    });

    updateVisibility();
}

function fillIndividualHandle() {
    const handle = window.CodeforcesAccount?.getCurrentHandle();
    const input = document.getElementById('individual-handle');
    if (handle && input && !input.value) {
        input.value = handle;
    }
}

// ============================================
// ОПИСАНИЯ УРОВНЕЙ СЛОЖНОСТИ (звёзды)
// ============================================
const STAR_DESCRIPTIONS = [
    'Основы синтаксиса языка',
    'Базовые алгоритмы и структуры данных',
    'Алгоритмические контесты средней сложности',
    'Уровень четвертьфиналов и полуфиналов ICPC',
    'Уровень финала ICPC и других престижных международных соревнований'
];

function updateStarDescription(value) {
    const el = document.getElementById('star-description');
    if (el) {
        const stars = '⭐'.repeat(value);
        el.textContent = `${stars} — ${STAR_DESCRIPTIONS[value - 1]}`;
    }
}

// ============================================
// ОПИСАНИЕ ОТНОСИТЕЛЬНОЙ ШКАЛЫ
// ============================================
function updateRelativeDescription() {
    const el = document.getElementById('relative-description');
    if (el) {
        el.textContent = 'Сложность рассчитывается относительно уровня вашей команды';
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ФИЛЬТРОВ
// ============================================
function initFilters() {
    const difficultySlider = document.getElementById('difficulty-slider');
    const relativeSlider = document.getElementById('relative-slider');
    const durationSlider = document.getElementById('duration-slider');

    if (difficultySlider) {
        difficultySlider.addEventListener('input', () => {
            updateStarDescription(parseInt(difficultySlider.value));
        });
        updateStarDescription(parseInt(difficultySlider.value));
    }

    if (relativeSlider) {
        updateRelativeDescription();
    }

    if (durationSlider) {
        durationSlider.classList.add('filled');

        function updateDurationFill() {
            const min = parseInt(durationSlider.min);
            const max = parseInt(durationSlider.max);
            const val = parseInt(durationSlider.value);
            const percent = ((val - min) / (max - min)) * 100;
            durationSlider.style.setProperty('--fill-percent', percent + '%');

            durationSlider.style.background = `linear-gradient(to right,
            var(--cf-green) 0%,
            var(--cf-green) ${percent}%,
            var(--surface-2) ${percent}%,
            var(--surface-2) 100%)`;
        }

        durationSlider.addEventListener('input', updateDurationFill);
        updateDurationFill();
    }
}

// ============================================
// ПЕРЕКЛЮЧАТЕЛИ (формат ICPC/IOI)
// ============================================
function initToggleButtons() {
    document.querySelectorAll('.toggle-group').forEach(group => {
        group.addEventListener('click', (e) => {
            if (!e.target.classList.contains('toggle-btn')) return;

            group.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            e.target.classList.add('active');
        });
    });
}

// ============================================
// КНОПКА ПОИСКА
// ============================================
function initSearchButton() {
    const searchBtn = document.getElementById('search-contests-btn');

    searchBtn.addEventListener('click', () => {
        const filters = getFilters();

        if (!isLoggedIn()) {
            alert('Сначала войдите в аккаунт');
            document.getElementById('account-btn').click();
            return;
        }

        if (filters.searchMode === 'group' && !filters.groupId) {
            alert('Выберите группу или создайте новую');
            return;
        }

        if (filters.searchMode === 'individual' && !filters.handle) {
            alert('Введите хэндл');
            return;
        }

        if (filters.searchMode === 'team' && (!filters.teamHandles || filters.teamHandles.length === 0)) {
            alert('Укажите хэндлы участников');
            return;
        }

        console.log('Поиск с фильтрами:', filters);
        searchContests(filters);
    });
}

// ============================================
// СБОР ФИЛЬТРОВ
// ============================================
function getFilters() {
    const format = document.querySelector('#contest-format .toggle-btn.active')?.dataset.value || 'ICPC';
    const duration = parseInt(document.getElementById('duration-slider').value);
    const type = document.querySelector('input[name="contest-type"]:checked')?.value || 'official-icpc';
    const searchMode = document.querySelector('#search-mode .toggle-btn.active')?.dataset.value || 'individual';

    const scale = document.querySelector('#difficulty-scale .toggle-btn.active')?.dataset.value || 'stars';

    let difficulty;
    if (scale === 'stars') {
        difficulty = {
            scale: 'stars',
            value: parseInt(document.getElementById('difficulty-slider').value)
        };
    } else {
        difficulty = {
            scale: 'relative',
            value: parseInt(document.getElementById('relative-slider').value)
        };
    }

    const filters = { format, difficulty, duration, type, searchMode };

    if (searchMode === 'individual') {
        const handle = document.getElementById('individual-handle')?.value.trim();
        filters.handle = handle || null;
    }

    if (searchMode === 'group') {
        const group = window.CodeforcesAccount.getSelectedGroup();
        filters.groupId = group ? group.id : null;
    }

    if (searchMode === 'team') {
        const raw = document.getElementById('team-handles')?.value || '';
        const items = raw.split(',').map(h => h.trim()).filter(h => h);
        filters.teamHandles = items.map(h => {
            if (h.startsWith('+')) return { handle: h.slice(1), type: 'wrote' };
            if (h.startsWith('-')) return { handle: h.slice(1), type: 'writes' };
            return { handle: h, type: 'member' };
        });
    }

    return filters;
}

// ============================================
// ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================
function isLoggedIn() {
    return !!(localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'));
}

// ============================================
// ПОИСК КОНТЕСТОВ
// ============================================
async function searchContests(filters) {
    const resultsSection = document.getElementById('results-section');
    const resultsContainer = document.getElementById('results-container');

    resultsSection.style.display = 'block';
    resultsContainer.innerHTML = '<div class="no-results">Поиск контестов...</div>';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

        let handles = [];
        if (filters.searchMode === 'group' && filters.groupId) {
            const membersRes = await fetch(`/api/groups/${filters.groupId}/members`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (membersRes.ok) {
                const { members } = await membersRes.json();
                handles = members.map(m => m.handle);
            }
        }

        if (filters.searchMode === 'individual' && filters.handle) {
            handles = [filters.handle];
        }

        if (filters.searchMode === 'team') {
            handles = (filters.teamHandles || []).map(h => h.handle);
        }

        const body = {
            difficulty: filters.difficulty,
            type: filters.type,
            handles
        };

        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Ошибка поиска');
        }

        const data = await response.json();
        renderResults(data.contests || []);

    } catch (err) {
        console.error('Ошибка поиска:', err);
        resultsContainer.innerHTML = `<div class="no-results">❌ ${err.message}</div>`;
    }
}

// ============================================
// ОТРИСОВКА РЕЗУЛЬТАТОВ
// ============================================
function renderResults(contests) {
    const container = document.getElementById('results-container');

    if (!contests || contests.length === 0) {
        container.innerHTML = '<div class="no-results">😕 Ничего не найдено. Попробуйте изменить фильтры</div>';
        return;
    }

    container.innerHTML = contests.map(contest => `
        <div class="result-item">
            <div class="result-item-header">
                <div class="result-item-title">${contest.name || 'Без названия'}</div>
                <div class="result-item-type">${contest.format || 'ICPC'}</div>
            </div>
            <div class="result-item-meta">
                <span>⏱ ${contest.duration || '?'} ч</span>
                <span>⭐ ${contest.difficulty || '?'}</span>
                <span>👥 ${contest.participants || 0} уч.</span>
            </div>
            <a class="result-item-link" href="${contest.url || '#'}" target="_blank">
                Открыть на Codeforces ↗
            </a>
        </div>
    `).join('');
}