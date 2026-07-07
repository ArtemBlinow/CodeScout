// ============================================
// FINDCONTEST.JS — Поиск контестов
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    initDifficultyScaleSwitch();
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
// ИНИЦИАЛИЗАЦИЯ ФИЛЬТРОВ
// ============================================
function initFilters() {
    const difficultySlider = document.getElementById('difficulty-slider');
    const relativeSlider = document.getElementById('relative-slider');
    const durationSlider = document.getElementById('duration-slider');

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

        console.log('🔍 Поиск с фильтрами:', filters);
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

    // Определяем активную шкалу сложности
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

    return {
        format,
        difficulty,
        duration,
        type
    };
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
    resultsContainer.innerHTML = '<div class="no-results">⏳ Поиск контестов...</div>';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(filters)
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