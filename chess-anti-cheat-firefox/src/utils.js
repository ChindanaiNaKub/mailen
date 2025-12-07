/**
 * Chess.com API Utilities
 * Functions for fetching player data from Chess.com public API
 */

const API_BASE_URL = 'https://api.chess.com/pub';

/**
 * Fetch with retry and exponential backoff
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Accept': 'application/json',
                    ...options.headers
                }
            });

            if (response.status >= 500 || response.status === 429) {
                throw new Error(`Retryable error: ${response.status}`);
            }

            return response;
        } catch (error) {
            lastError = error;

            if (!error.message.includes('Retryable error') && !error.message.includes('Failed to fetch')) {
                throw error;
            }

            if (attempt === maxRetries) break;

            const delay = baseDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Fetch player profile information
 */
async function fetchPlayerProfile(username) {
    try {
        const response = await fetchWithRetry(`${API_BASE_URL}/player/${username}`);
        if (!response.ok) throw new Error('Failed to fetch player profile');
        const data = await response.json();

        if (!data || typeof data.joined !== 'number') {
            throw new Error('Invalid profile data structure');
        }

        return {
            joined: data.joined,
            username: data.username,
            country: data.country,
            status: data.status
        };
    } catch (error) {
        console.error('Error fetching player profile:', error);
        throw error;
    }
}

/**
 * Fetch player statistics
 */
async function fetchPlayerStats(username) {
    try {
        const response = await fetchWithRetry(`${API_BASE_URL}/player/${username}/stats`);
        if (!response.ok) throw new Error('Failed to fetch player stats');
        const data = await response.json();

        const { GAME_FORMATS } = window.ChessAntiCheat.config;
        const stats = {};

        GAME_FORMATS.forEach(format => {
            if (data[format]) {
                stats[format] = {
                    rating: data[format].last?.rating || 0,
                    wins: data[format].record?.win || 0,
                    losses: data[format].record?.loss || 0,
                    draws: data[format].record?.draw || 0
                };
            }
        });

        return stats;
    } catch (error) {
        console.error('Error fetching player stats:', error);
        throw error;
    }
}

/**
 * Fetch recent games for a player
 */
async function fetchRecentGames(username) {
    try {
        const { GAME_RESULTS, DEFAULT_SETTINGS } = window.ChessAntiCheat.config;

        // Get user settings
        let userSettings = DEFAULT_SETTINGS;
        try {
            const stored = await browser.storage.local.get('settings');
            if (stored.settings) {
                userSettings = { ...DEFAULT_SETTINGS, ...stored.settings };
            }
        } catch (e) {
            console.debug('Using default settings');
        }

        const date = new Date();
        const currentYear = date.getFullYear();
        const currentMonth = date.getMonth() + 1;

        // Fetch current month and previous month if early in month
        const monthsToFetch = [];
        if (date.getDate() < 15) {
            const prevDate = new Date(date);
            prevDate.setMonth(prevDate.getMonth() - 1);
            monthsToFetch.push({
                year: prevDate.getFullYear(),
                month: String(prevDate.getMonth() + 1).padStart(2, '0')
            });
        }
        monthsToFetch.push({
            year: currentYear,
            month: String(currentMonth).padStart(2, '0')
        });

        const gamesPromises = monthsToFetch.map(({ year, month }) =>
            fetchWithRetry(`${API_BASE_URL}/player/${username}/games/${year}/${month}`)
                .then(response => response.json())
                .catch(() => ({ games: [] }))
        );

        const responses = await Promise.all(gamesPromises);

        const games = responses.flatMap(response => response.games || [])
            .filter(game =>
                game?.rules === 'chess' &&
                ['rapid', 'bullet', 'blitz'].includes(game?.time_class) &&
                (userSettings.RATED_ONLY ? game?.rated === true : true)
            )
            .map(game => {
                const playerColor = game.white.username.toLowerCase() === username.toLowerCase() ? 'white' : 'black';
                const rawResult = game[playerColor].result;

                return {
                    timeClass: game.time_class,
                    playerColor,
                    playerRating: game[playerColor].rating,
                    result: GAME_RESULTS[rawResult] || 'unknown',
                    accuracy: game.accuracies?.[playerColor],
                    timestamp: game.end_time,
                    rated: game.rated
                };
            })
            .filter(game => game.result !== 'unknown');

        return games;
    } catch (error) {
        console.error('Error fetching recent games:', error);
        throw error;
    }
}

/**
 * Main function to gather all player data
 */
async function gatherPlayerData(username) {
    try {
        const [profile, stats, recentGames] = await Promise.all([
            fetchPlayerProfile(username),
            fetchPlayerStats(username),
            fetchRecentGames(username)
        ]);

        return {
            profile,
            stats,
            recentGames
        };
    } catch (error) {
        console.error('Error gathering player data:', error);
        throw error;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ChessAntiCheat = window.ChessAntiCheat || {};
    window.ChessAntiCheat.utils = {
        fetchPlayerProfile,
        fetchPlayerStats,
        fetchRecentGames,
        gatherPlayerData
    };
}
