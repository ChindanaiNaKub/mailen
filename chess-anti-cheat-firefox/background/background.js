/**
 * Background Script
 * Handles messaging between content script and popup, manages state
 */

// State management
let currentOpponentData = null;
let opponentHistory = [];

/**
 * Initialize the extension
 */
async function initialize() {
    console.log('Chess.com Anti-Cheat extension initialized');

    // Load opponent history from storage
    try {
        const stored = await browser.storage.local.get('opponentHistory');
        if (stored.opponentHistory) {
            opponentHistory = stored.opponentHistory;
        }
    } catch (e) {
        console.debug('No opponent history found');
    }
}

/**
 * Handle messages from content script and popup
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse);
    return true; // Indicates async response
});

async function handleMessage(message, sender) {
    switch (message.action) {
        case 'analyzeOpponent':
            return await analyzeOpponent(message.username);

        case 'getCurrentOpponent':
            return currentOpponentData;

        case 'getOpponentHistory':
            return opponentHistory;

        case 'clearHistory':
            opponentHistory = [];
            await browser.storage.local.set({ opponentHistory: [] });
            return { success: true };

        case 'getSettings':
            return await getSettings();

        case 'saveSettings':
            return await saveSettings(message.settings);

        default:
            console.warn('Unknown message action:', message.action);
            return { error: 'Unknown action' };
    }
}

/**
 * Analyze an opponent and calculate risk score
 */
async function analyzeOpponent(username) {
    if (!username) {
        return { error: 'No username provided' };
    }

    try {
        // Update badge to show loading
        updateBadge('...', '#888888');

        const { calculateRiskScoreFromUsername, getRiskLevel } = window.ChessAntiCheat.riskScore;
        const result = await calculateRiskScoreFromUsername(username, true);

        const riskLevel = getRiskLevel(result.maxScore.value);

        currentOpponentData = {
            ...result,
            riskLevel,
            analyzedAt: new Date().toISOString()
        };

        // Update badge with score
        updateBadge(result.maxScore.value.toString(), riskLevel.color);

        // Add to history
        await addToHistory(currentOpponentData);

        return currentOpponentData;
    } catch (error) {
        console.error('Error analyzing opponent:', error);
        updateBadge('!', '#F44336');
        return { error: error.message };
    }
}

/**
 * Update browser action badge
 */
function updateBadge(text, color) {
    browser.browserAction.setBadgeText({ text });
    browser.browserAction.setBadgeBackgroundColor({ color });
}

/**
 * Add opponent to history
 */
async function addToHistory(opponentData) {
    // Check if already in history
    const existingIndex = opponentHistory.findIndex(
        h => h.username.toLowerCase() === opponentData.username.toLowerCase()
    );

    const historyEntry = {
        username: opponentData.username,
        score: opponentData.maxScore.value,
        format: opponentData.maxScore.format,
        riskLevel: opponentData.riskLevel,
        analyzedAt: opponentData.analyzedAt
    };

    if (existingIndex >= 0) {
        // Update existing entry
        opponentHistory[existingIndex] = historyEntry;
    } else {
        // Add new entry (keep max 50)
        opponentHistory.unshift(historyEntry);
        if (opponentHistory.length > 50) {
            opponentHistory = opponentHistory.slice(0, 50);
        }
    }

    // Save to storage
    await browser.storage.local.set({ opponentHistory });
}

/**
 * Get user settings
 */
async function getSettings() {
    const { DEFAULT_SETTINGS } = window.ChessAntiCheat.config;
    try {
        const stored = await browser.storage.local.get('settings');
        return { ...DEFAULT_SETTINGS, ...stored.settings };
    } catch (e) {
        return DEFAULT_SETTINGS;
    }
}

/**
 * Save user settings
 */
async function saveSettings(settings) {
    try {
        await browser.storage.local.set({ settings });
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
}

// Initialize on load
initialize();
