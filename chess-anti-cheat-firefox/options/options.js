/**
 * Options Page Script
 */

const DEFAULT_SETTINGS = {
    RATED_ONLY: true,
    AUTO_OPEN_POPUP: true,
    SHOW_IN_PAGE_BADGE: true,
    HIGH_RISK_THRESHOLD: 70,
    MODERATE_RISK_THRESHOLD: 50
};

document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
    // Load current settings
    await loadSettings();

    // Bind event listeners
    document.getElementById('save-btn').addEventListener('click', saveSettings);
    document.getElementById('reset-btn').addEventListener('click', resetSettings);
}

/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        const result = await browser.storage.local.get('settings');
        const settings = { ...DEFAULT_SETTINGS, ...result.settings };

        document.getElementById('rated-only').checked = settings.RATED_ONLY;
        document.getElementById('auto-popup').checked = settings.AUTO_OPEN_POPUP;
        document.getElementById('show-badge').checked = settings.SHOW_IN_PAGE_BADGE;
        document.getElementById('moderate-threshold').value = settings.MODERATE_RISK_THRESHOLD;
        document.getElementById('high-threshold').value = settings.HIGH_RISK_THRESHOLD;
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
    const settings = {
        RATED_ONLY: document.getElementById('rated-only').checked,
        AUTO_OPEN_POPUP: document.getElementById('auto-popup').checked,
        SHOW_IN_PAGE_BADGE: document.getElementById('show-badge').checked,
        MODERATE_RISK_THRESHOLD: parseInt(document.getElementById('moderate-threshold').value, 10),
        HIGH_RISK_THRESHOLD: parseInt(document.getElementById('high-threshold').value, 10)
    };

    // Validate thresholds
    if (settings.MODERATE_RISK_THRESHOLD >= settings.HIGH_RISK_THRESHOLD) {
        alert('Moderate threshold must be less than high threshold');
        return;
    }

    try {
        await browser.storage.local.set({ settings });
        showToast('Settings saved!');
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Error saving settings');
    }
}

/**
 * Reset to default settings
 */
async function resetSettings() {
    try {
        await browser.storage.local.set({ settings: DEFAULT_SETTINGS });
        await loadSettings();
        showToast('Settings reset to defaults');
    } catch (error) {
        console.error('Error resetting settings:', error);
    }
}

/**
 * Show toast notification
 */
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
