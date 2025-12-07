/**
 * Popup Script - Chess.com Anti-Cheat Extension
 */

document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
    // Bind event listeners
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('refresh-btn')?.addEventListener('click', refreshAnalysis);
    document.getElementById('clear-history').addEventListener('click', clearHistory);

    // Load current opponent data
    await loadCurrentOpponent();

    // Load history
    await loadHistory();
}

/**
 * Load current opponent analysis
 */
async function loadCurrentOpponent() {
    try {
        const response = await browser.runtime.sendMessage({ action: 'getCurrentOpponent' });

        if (response && response.username) {
            displayOpponentAnalysis(response);
        } else {
            showNoOpponent();
        }
    } catch (error) {
        console.error('Error loading current opponent:', error);
        showNoOpponent();
    }
}

/**
 * Display opponent analysis
 */
function displayOpponentAnalysis(data) {
    document.getElementById('no-opponent-state').classList.add('hidden');
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('opponent-analysis').classList.remove('hidden');

    // Update score and gauge
    const score = data.maxScore.value;
    const riskLevel = data.riskLevel;

    document.getElementById('score-value').textContent = score;
    updateGauge(score, riskLevel.color);

    // Update risk label
    const riskLabel = document.getElementById('risk-label');
    riskLabel.textContent = riskLevel.label;
    riskLabel.className = 'risk-label ' + getRiskClass(score);

    // Update opponent info
    document.getElementById('opponent-name').textContent = data.username;
    document.getElementById('opponent-format').textContent = formatName(data.maxScore.format);

    // Update factors
    if (data.maxScore.factors) {
        const factors = data.maxScore.factors;
        document.getElementById('overall-winrate').textContent =
            factors.overallWinRate ? `${factors.overallWinRate.raw.toFixed(1)}%` : '--';
        document.getElementById('recent-winrate').textContent =
            factors.recentWinRate ? `${factors.recentWinRate.raw.toFixed(1)}%` : '--';
        document.getElementById('accuracy-pct').textContent =
            factors.accuracy ? `${factors.accuracy.raw.toFixed(1)}%` : '--';
    }

    document.getElementById('account-age').textContent =
        data.accountAgeDays ? `${data.accountAgeDays} days` : '--';

    // Update profile link
    document.getElementById('view-profile').href =
        `https://www.chess.com/member/${data.username}`;
}

/**
 * Update gauge visualization
 */
function updateGauge(score, color) {
    const gaugeFill = document.getElementById('gauge-fill');
    // Gauge path length is approximately 126 units
    const offset = 126 - (score / 100 * 126);
    gaugeFill.style.strokeDashoffset = offset;
    gaugeFill.style.stroke = color;
}

/**
 * Get CSS class for risk level
 */
function getRiskClass(score) {
    if (score <= 30) return 'low';
    if (score <= 50) return 'moderate';
    if (score <= 70) return 'high';
    return 'very-high';
}

/**
 * Format game format name
 */
function formatName(format) {
    if (!format) return 'Unknown';
    return format.replace('chess_', '').charAt(0).toUpperCase() +
        format.replace('chess_', '').slice(1);
}

/**
 * Show no opponent state
 */
function showNoOpponent() {
    document.getElementById('no-opponent-state').classList.remove('hidden');
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('opponent-analysis').classList.add('hidden');
}

/**
 * Refresh analysis
 */
async function refreshAnalysis() {
    const opponentName = document.getElementById('opponent-name').textContent;
    if (!opponentName || opponentName === 'Opponent') return;

    document.getElementById('opponent-analysis').classList.add('hidden');
    document.getElementById('loading-state').classList.remove('hidden');

    try {
        const response = await browser.runtime.sendMessage({
            action: 'analyzeOpponent',
            username: opponentName
        });

        if (response && !response.error) {
            displayOpponentAnalysis(response);
        }
    } catch (error) {
        console.error('Error refreshing:', error);
    }
}

/**
 * Load opponent history
 */
async function loadHistory() {
    try {
        const history = await browser.runtime.sendMessage({ action: 'getOpponentHistory' });
        displayHistory(history || []);
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

/**
 * Display history list
 */
function displayHistory(history) {
    const historyList = document.getElementById('history-list');
    historyList.textContent = ''; // Clear existing content safely

    if (!history || history.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-history';
        emptyMsg.textContent = 'No opponents analyzed yet';
        historyList.appendChild(emptyMsg);
        return;
    }

    history.slice(0, 10).forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.dataset.username = item.username;

        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'history-username';
        usernameSpan.textContent = item.username;

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'history-score';
        scoreSpan.style.backgroundColor = item.riskLevel.color;
        scoreSpan.textContent = item.score;

        historyItem.appendChild(usernameSpan);
        historyItem.appendChild(scoreSpan);
        historyList.appendChild(historyItem);
    });

    // Add click handlers
    historyList.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', async () => {
            const username = item.dataset.username;
            document.getElementById('loading-state').classList.remove('hidden');
            document.getElementById('no-opponent-state').classList.add('hidden');

            const response = await browser.runtime.sendMessage({
                action: 'analyzeOpponent',
                username: username
            });

            if (response && !response.error) {
                displayOpponentAnalysis(response);
            }
        });
    });
}

/**
 * Clear history
 */
async function clearHistory() {
    await browser.runtime.sendMessage({ action: 'clearHistory' });
    displayHistory([]);
}

/**
 * Open settings page
 */
function openSettings() {
    browser.runtime.openOptionsPage();
}
