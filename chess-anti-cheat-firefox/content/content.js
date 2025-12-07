/**
 * Content Script
 * Monitors chess.com game pages and detects opponent
 */

(function () {
    'use strict';

    let lastOpponent = null;
    let observer = null;
    let urlObserver = null;
    let badgeElement = null;

    /**
     * Initialize content script
     */
    function initialize() {
        console.log('Chess.com Anti-Cheat: Content script loaded');

        // Start monitoring for games
        setupGameMonitor();
        setupUrlObserver();

        // Initial check
        checkForOpponent();
    }

    /**
     * Setup DOM observer for game changes
     */
    function setupGameMonitor() {
        observer = new MutationObserver(debounce(checkForOpponent, 500));
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Setup URL observer for SPA navigation
     */
    function setupUrlObserver() {
        let lastUrl = window.location.href;

        urlObserver = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                lastOpponent = null;
                removeBadge();
                setTimeout(checkForOpponent, 1000);
            }
        });

        urlObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Check for opponent on current page
     */
    function checkForOpponent() {
        const opponentUsername = extractOpponentUsername();

        if (opponentUsername && opponentUsername !== lastOpponent) {
            lastOpponent = opponentUsername;
            console.log('Chess.com Anti-Cheat: Found opponent:', opponentUsername);
            analyzeOpponent(opponentUsername);
        }
    }

    /**
     * Extract opponent username from the page
     */
    function extractOpponentUsername() {
        // Try various selectors used by chess.com
        const selectors = [
            // Live game opponent (top of board)
            '.board-player-default-top .user-username-component',
            '.board-layout-player-top .user-username-component',
            // Alternative selectors
            '[data-cy="player-top"] .user-username-component',
            '.player-top .user-username-component',
            // Game page headers
            '.game-header-user-top .user-username-component'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                const username = element.textContent?.trim();
                if (username && !isOwnUsername(username)) {
                    return username;
                }
            }
        }

        // Fallback: look for any username components and find the opponent
        const allUsernames = document.querySelectorAll('.user-username-component');
        for (const el of allUsernames) {
            const username = el.textContent?.trim();
            if (username && !isOwnUsername(username)) {
                return username;
            }
        }

        return null;
    }

    /**
     * Check if username is the current user (to filter out)
     */
    function isOwnUsername(username) {
        // Try to get logged in username from page
        const profileLink = document.querySelector('a[href*="/member/"]');
        if (profileLink) {
            const href = profileLink.getAttribute('href');
            const match = href.match(/\/member\/([^/?]+)/);
            if (match && match[1].toLowerCase() === username.toLowerCase()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Analyze opponent by sending message to background script
     */
    async function analyzeOpponent(username) {
        try {
            const response = await browser.runtime.sendMessage({
                action: 'analyzeOpponent',
                username: username
            });

            if (response && !response.error) {
                displayRiskBadge(response);
            }
        } catch (error) {
            console.error('Chess.com Anti-Cheat: Error analyzing opponent:', error);
        }
    }

    /**
     * Display risk badge on the page
     */
    function displayRiskBadge(data) {
        removeBadge();

        // Find opponent name element to attach badge near
        const opponentEl = document.querySelector(
            '.board-player-default-top .user-username-component, ' +
            '.board-layout-player-top .user-username-component'
        );

        if (!opponentEl) return;

        const parent = opponentEl.closest('.board-player-default-top, .board-layout-player-top');
        if (!parent) return;

        badgeElement = document.createElement('div');
        badgeElement.id = 'chess-anticheat-badge';
        badgeElement.className = 'chess-anticheat-badge';

        const score = data.maxScore.value;
        const riskLevel = data.riskLevel;

        badgeElement.innerHTML = `
            <span class="risk-score" style="background-color: ${riskLevel.color}">${score}</span>
            <span class="risk-label">${riskLevel.label}</span>
        `;

        badgeElement.title = `Risk Score: ${score}\nFormat: ${data.maxScore.format || 'N/A'}\nAccount Age: ${data.accountAgeDays} days`;

        parent.style.position = 'relative';
        parent.appendChild(badgeElement);
    }

    /**
     * Remove existing badge
     */
    function removeBadge() {
        if (badgeElement) {
            badgeElement.remove();
            badgeElement = null;
        }
        const existing = document.getElementById('chess-anticheat-badge');
        if (existing) {
            existing.remove();
        }
    }

    /**
     * Debounce function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Cleanup on unload
     */
    function cleanup() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        if (urlObserver) {
            urlObserver.disconnect();
            urlObserver = null;
        }
        removeBadge();
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.addEventListener('unload', cleanup);
})();
