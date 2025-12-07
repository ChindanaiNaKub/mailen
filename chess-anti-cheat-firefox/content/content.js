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
        // Try various selectors used by chess.com (including new cc- prefixed classes)
        const selectors = [
            // New chess.com selectors (cc- prefix)
            '.board-player-default-top .cc-user-username-component',
            '.board-layout-player-top .cc-user-username-component',
            // Live game opponent (top of board)
            '.board-player-default-top .user-username-component',
            '.board-layout-player-top .user-username-component',
            // Alternative selectors
            '[data-cy="player-top"] .user-username-component',
            '[data-cy="player-top"] .cc-user-username-component',
            '.player-top .user-username-component',
            '.player-top .cc-user-username-component',
            // Game page headers
            '.game-header-user-top .user-username-component',
            '.game-header-user-top .cc-user-username-component'
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

        // Fallback: look for any username components (both old and new classes)
        const allUsernames = document.querySelectorAll('.user-username-component, .cc-user-username-component');
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
     * The user is always displayed at the BOTTOM of the board
     */
    function isOwnUsername(username) {
        // Find all username elements
        const allUsernames = document.querySelectorAll('.cc-user-username-component, .user-username-component');

        if (allUsernames.length < 2) {
            return false; // Can't determine if we don't have both players
        }

        // Find the element for this username
        let thisElement = null;
        for (const el of allUsernames) {
            if (el.textContent?.trim().toLowerCase() === username.toLowerCase()) {
                thisElement = el;
                break;
            }
        }

        if (!thisElement) return false;

        // Get the position of this element
        const thisRect = thisElement.getBoundingClientRect();

        // Find the board element to determine the middle point
        const board = document.querySelector('.board, [class*="board-layout"], .chessboard');

        if (board) {
            const boardRect = board.getBoundingClientRect();
            const boardMiddle = boardRect.top + (boardRect.height / 2);

            // If this element is below the board middle, it's the user (bottom player)
            if (thisRect.top > boardMiddle) {
                return true;
            }
        } else {
            // Fallback: compare positions of all username elements
            // The bottom-most username is the current user
            let maxY = -Infinity;
            let bottomElement = null;

            for (const el of allUsernames) {
                const rect = el.getBoundingClientRect();
                if (rect.top > maxY) {
                    maxY = rect.top;
                    bottomElement = el;
                }
            }

            if (bottomElement && bottomElement.textContent?.trim().toLowerCase() === username.toLowerCase()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Analyze opponent by sending message to background script
     */
    async function analyzeOpponent(username) {
        // Show loading indicator immediately so user knows it's working
        displayLoadingBadge();

        try {
            const response = await browser.runtime.sendMessage({
                action: 'analyzeOpponent',
                username: username
            });

            if (response && !response.error) {
                displayRiskBadge(response);
            } else {
                removeBadge(); // Remove loading badge on error
            }
        } catch (error) {
            console.error('Chess.com Anti-Cheat: Error analyzing opponent:', error);
            removeBadge();
        }
    }

    /**
     * Display loading badge while analysis is in progress
     */
    function displayLoadingBadge() {
        removeBadge();

        // Find opponent name element
        let opponentEl = document.querySelector(
            '.board-player-default-top .cc-user-username-component, ' +
            '.board-player-default-top .user-username-component, ' +
            '.board-layout-player-top .cc-user-username-component, ' +
            '.board-layout-player-top .user-username-component'
        );

        if (!opponentEl && lastOpponent) {
            const allUsernames = document.querySelectorAll('.cc-user-username-component, .user-username-component');
            for (const el of allUsernames) {
                if (el.textContent?.trim() === lastOpponent) {
                    opponentEl = el;
                    break;
                }
            }
        }

        if (!opponentEl) return;

        // Find insertion point
        let insertTarget = opponentEl;
        let playerContainer = opponentEl.parentElement;
        for (let i = 0; i < 3 && playerContainer; i++) {
            const connectionEl = playerContainer.querySelector('.connection-component, [class*="connection-component"]');
            if (connectionEl) {
                insertTarget = connectionEl;
                break;
            }
            playerContainer = playerContainer.parentElement;
        }

        if (insertTarget === opponentEl && opponentEl.parentElement) {
            const siblings = opponentEl.parentElement.children;
            if (siblings.length > 0) {
                insertTarget = siblings[siblings.length - 1];
            }
        }

        badgeElement = document.createElement('span');
        badgeElement.id = 'chess-anticheat-badge';
        badgeElement.className = 'chess-anticheat-badge under-username loading';

        badgeElement.innerHTML = `
            <span class="risk-score" style="background-color: #888888; animation: pulse 1s infinite;">...</span>
            <span class="risk-label">Analyzing</span>
        `;

        badgeElement.title = 'Analyzing opponent...';
        insertTarget.insertAdjacentElement('afterend', badgeElement);
    }

    /**
     * Display risk badge on the page
     */
    function displayRiskBadge(data) {
        removeBadge();

        // Find opponent name element to attach badge near (support both old and new classes)
        let opponentEl = document.querySelector(
            '.board-player-default-top .cc-user-username-component, ' +
            '.board-player-default-top .user-username-component, ' +
            '.board-layout-player-top .cc-user-username-component, ' +
            '.board-layout-player-top .user-username-component'
        );

        // Fallback: find by matching the opponent's username text
        if (!opponentEl && lastOpponent) {
            const allUsernames = document.querySelectorAll('.cc-user-username-component, .user-username-component');
            for (const el of allUsernames) {
                if (el.textContent?.trim() === lastOpponent) {
                    opponentEl = el;
                    break;
                }
            }
        }

        if (!opponentEl) {
            console.log('Chess.com Anti-Cheat: Could not find opponent element for badge');
            return;
        }

        // Find the best insertion point - after all player info elements
        let insertTarget = opponentEl;

        // Try to find the connection component or the last element in the player row
        // Look up multiple levels to find the player info container
        let playerContainer = opponentEl.parentElement;
        for (let i = 0; i < 3 && playerContainer; i++) {
            // Check if this container has connection component
            const connectionEl = playerContainer.querySelector('.connection-component, [class*="connection-component"]');
            if (connectionEl) {
                insertTarget = connectionEl;
                break;
            }

            // Check for flag (usually the last visible element in player row)
            const flagEl = playerContainer.querySelector('[class*="country-flag"], [class*="flag"], .flag');
            if (flagEl) {
                insertTarget = flagEl;
                break;
            }

            playerContainer = playerContainer.parentElement;
        }

        // If we still have opponentEl as target, find the last sibling
        if (insertTarget === opponentEl && opponentEl.parentElement) {
            const siblings = opponentEl.parentElement.children;
            if (siblings.length > 0) {
                insertTarget = siblings[siblings.length - 1];
            }
        }

        badgeElement = document.createElement('span');
        badgeElement.id = 'chess-anticheat-badge';
        badgeElement.className = 'chess-anticheat-badge under-username';

        const score = data.maxScore.value;
        const riskLevel = data.riskLevel;

        badgeElement.innerHTML = `
            <span class="risk-score" style="background-color: ${riskLevel.color}">${score}</span>
            <span class="risk-label">${riskLevel.label}</span>
        `;

        badgeElement.title = `Risk Score: ${score}\nFormat: ${data.maxScore.format || 'N/A'}\nAccount Age: ${data.accountAgeDays} days`;

        // Insert the badge right after the connection component (or username if not found)
        insertTarget.insertAdjacentElement('afterend', badgeElement);

        console.log('Chess.com Anti-Cheat: Badge displayed for', data.username || 'opponent');
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
