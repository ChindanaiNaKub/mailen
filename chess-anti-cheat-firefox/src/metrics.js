/**
 * Player Metrics Calculation
 * Functions for calculating player statistics and metrics
 */

/**
 * Calculate account age in days
 */
function calculateAccountAge(joinedTimestamp) {
    const now = Date.now();
    const joinedDate = new Date(joinedTimestamp * 1000);
    return Math.floor((now - joinedDate) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate winrate from game record
 */
function calculateWinrate(record) {
    const { wins = 0, losses = 0, draws = 0 } = record;
    const total = wins + losses + draws;
    return total > 0 ? ((wins / total) * 100) : 0;
}

/**
 * Calculate metrics for a specific game format
 */
async function calculateFormatMetrics(stats, recentGames) {
    const { ACCURACY_THRESHOLDS, DEFAULT_SETTINGS } = window.ChessAntiCheat.config;

    let userSettings = DEFAULT_SETTINGS;
    try {
        const stored = await browser.storage.local.get('settings');
        if (stored.settings) {
            userSettings = { ...DEFAULT_SETTINGS, ...stored.settings };
        }
    } catch (e) {
        console.debug('Using default settings');
    }

    const formatGames = recentGames.filter(game =>
        game.timeClass === stats.timeClass &&
        (userSettings.RATED_ONLY ? game.rated === true : true)
    );

    // Count recent games results
    const recentStats = formatGames.reduce((acc, game) => {
        switch (game.result) {
            case 'win':
                acc.wins++;
                break;
            case 'loss':
                acc.losses++;
                break;
            case 'draw':
                acc.draws++;
                break;
        }
        return acc;
    }, { wins: 0, losses: 0, draws: 0 });

    // Calculate accuracy metrics
    const gamesWithAccuracy = formatGames.filter(game => game.accuracy != null);

    if (gamesWithAccuracy.length === 0) {
        return {
            currentRating: stats.rating || 0,
            overallWinrate: calculateWinrate({
                wins: stats.wins,
                losses: stats.losses,
                draws: stats.draws
            }),
            gamesCounts: {
                total: stats.wins + stats.losses + stats.draws,
                wins: stats.wins,
                losses: stats.losses,
                draws: stats.draws
            },
            recentGames: {
                total: recentStats.wins + recentStats.losses + recentStats.draws,
                wins: recentStats.wins,
                losses: recentStats.losses,
                draws: recentStats.draws,
                winrate: calculateWinrate(recentStats)
            },
            accuracy: {
                gamesWithAccuracy: 0,
                highAccuracyGames: 0,
                highAccuracyPercentage: 0
            }
        };
    }

    const highAccuracyGames = gamesWithAccuracy.filter(game => {
        const threshold = game.playerRating < ACCURACY_THRESHOLDS.LOW_RATING.threshold
            ? ACCURACY_THRESHOLDS.LOW_RATING.requiredAccuracy
            : ACCURACY_THRESHOLDS.HIGH_RATING.requiredAccuracy;
        return game.accuracy >= threshold;
    });

    return {
        currentRating: stats.rating || 0,
        overallWinrate: calculateWinrate({
            wins: stats.wins,
            losses: stats.losses,
            draws: stats.draws
        }),
        gamesCounts: {
            total: stats.wins + stats.losses + stats.draws,
            wins: stats.wins,
            losses: stats.losses,
            draws: stats.draws
        },
        recentGames: {
            total: recentStats.wins + recentStats.losses + recentStats.draws,
            wins: recentStats.wins,
            losses: recentStats.losses,
            draws: recentStats.draws,
            winrate: calculateWinrate(recentStats)
        },
        accuracy: {
            gamesWithAccuracy: gamesWithAccuracy.length,
            highAccuracyGames: highAccuracyGames.length,
            highAccuracyPercentage: gamesWithAccuracy.length > 0
                ? (highAccuracyGames.length / gamesWithAccuracy.length) * 100
                : 0
        }
    };
}

/**
 * Calculate all metrics for a player
 */
async function calculatePlayerMetrics(playerData) {
    try {
        const { profile, stats, recentGames } = playerData;
        const { GAME_FORMATS } = window.ChessAntiCheat.config;

        const accountAge = calculateAccountAge(profile.joined);
        const formatMetrics = {};

        const formats = GAME_FORMATS;

        await Promise.all(formats.map(async format => {
            if (stats[format]) {
                const formatStats = {
                    timeClass: format.replace('chess_', ''),
                    rating: stats[format].rating,
                    wins: stats[format].wins,
                    losses: stats[format].losses,
                    draws: stats[format].draws
                };

                formatMetrics[format] = await calculateFormatMetrics(formatStats, recentGames);
            }
        }));

        return {
            accountAge,
            formats: formatMetrics,
            username: profile.username,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error calculating player metrics:', error);
        throw new Error('Failed to calculate player metrics');
    }
}

/**
 * Validate calculated metrics
 */
function validateMetrics(metrics) {
    try {
        if (!metrics.accountAge || metrics.accountAge < 0) return false;
        if (!metrics.formats || Object.keys(metrics.formats).length === 0) return false;

        for (const format in metrics.formats) {
            const formatMetrics = metrics.formats[format];

            if (typeof formatMetrics.currentRating !== 'number') return false;
            if (typeof formatMetrics.overallWinrate !== 'number') return false;
            if (formatMetrics.overallWinrate < 0 || formatMetrics.overallWinrate > 100) return false;

            const counts = formatMetrics.gamesCounts;
            if (counts.total !== counts.wins + counts.losses + counts.draws) return false;

            const acc = formatMetrics.accuracy;
            if (acc.highAccuracyGames > acc.gamesWithAccuracy) return false;
            if (acc.highAccuracyPercentage < 0 || acc.highAccuracyPercentage > 100) return false;
        }

        return true;
    } catch (error) {
        console.error('Error validating metrics:', error);
        return false;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ChessAntiCheat = window.ChessAntiCheat || {};
    window.ChessAntiCheat.metrics = {
        calculateAccountAge,
        calculateWinrate,
        calculateFormatMetrics,
        calculatePlayerMetrics,
        validateMetrics
    };
}
