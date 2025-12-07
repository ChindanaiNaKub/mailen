/**
 * Risk Score Calculation
 * Core algorithm for calculating opponent cheat risk
 */

// Cache for weight calculations
const weightCache = new Map();

/**
 * Calculate weighted score based on sample size
 */
function calculateWeight(n) {
    const cacheKey = n;
    if (weightCache.has(cacheKey)) {
        return weightCache.get(cacheKey);
    }
    const { THRESHOLDS } = window.ChessAntiCheat.config;
    const weight = n / (n + THRESHOLDS.WEIGHTING_K);
    weightCache.set(cacheKey, weight);
    return weight;
}

/**
 * Calculate account age factor
 */
function calculateAccountAgeFactor(accountAgeDays) {
    const { THRESHOLDS } = window.ChessAntiCheat.config;
    return accountAgeDays <= THRESHOLDS.ACCOUNT_AGE_DAYS
        ? THRESHOLDS.ACCOUNT_AGE_MULTIPLIER
        : 1;
}

/**
 * Calculate win rate score with weighting
 */
function calculateWinRateScore(winRate, totalGames) {
    const { WINRATE_THRESHOLDS } = window.ChessAntiCheat.config;
    let score = 0;

    if (winRate <= WINRATE_THRESHOLDS.LOW_WINRATE_THRESHOLD) {
        return 0;
    }

    if (winRate > WINRATE_THRESHOLDS.HIGH_WINRATE_THRESHOLD) {
        score = WINRATE_THRESHOLDS.EXTENDED_SCORE +
            ((winRate - WINRATE_THRESHOLDS.HIGH_WINRATE_THRESHOLD) / WINRATE_THRESHOLDS.SCALE_FACTOR) *
            WINRATE_THRESHOLDS.EXTENDED_SCORE;
    } else if (winRate > WINRATE_THRESHOLDS.MEDIUM_WINRATE_THRESHOLD) {
        score = WINRATE_THRESHOLDS.BASE_SCORE +
            ((winRate - WINRATE_THRESHOLDS.MEDIUM_WINRATE_THRESHOLD) /
                (WINRATE_THRESHOLDS.HIGH_WINRATE_THRESHOLD - WINRATE_THRESHOLDS.MEDIUM_WINRATE_THRESHOLD)) *
            WINRATE_THRESHOLDS.BASE_SCORE;
    } else if (winRate > WINRATE_THRESHOLDS.LOW_WINRATE_THRESHOLD) {
        score = ((winRate - WINRATE_THRESHOLDS.LOW_WINRATE_THRESHOLD) /
            (WINRATE_THRESHOLDS.MEDIUM_WINRATE_THRESHOLD - WINRATE_THRESHOLDS.LOW_WINRATE_THRESHOLD)) *
            WINRATE_THRESHOLDS.BASE_SCORE;
    }

    return score * calculateWeight(totalGames);
}

/**
 * Calculate high accuracy games score
 */
function calculateHighAccuracyScore(accuracyData, playerRating) {
    const { HIGH_ACCURACY_THRESHOLDS } = window.ChessAntiCheat.config;
    const { gamesWithAccuracy, highAccuracyPercentage } = accuracyData;

    if (gamesWithAccuracy === 0 || isNaN(highAccuracyPercentage)) {
        return { score: 0, debug: { baseScore: 0, sampleWeight: 0, reason: 'no_accuracy_data' } };
    }

    if (highAccuracyPercentage <= HIGH_ACCURACY_THRESHOLDS.MODERATE_SUSPICION_THRESHOLD) {
        return { score: 0, debug: { baseScore: 0, sampleWeight: 0, reason: 'below_threshold' } };
    }

    const sampleWeight = calculateWeight(gamesWithAccuracy);
    let baseScore;

    if (highAccuracyPercentage > HIGH_ACCURACY_THRESHOLDS.EXTREME_SUSPICION_THRESHOLD) {
        baseScore = HIGH_ACCURACY_THRESHOLDS.HIGH_MAX_SCORE +
            Math.floor((highAccuracyPercentage - HIGH_ACCURACY_THRESHOLDS.EXTREME_SUSPICION_THRESHOLD) /
                HIGH_ACCURACY_THRESHOLDS.EXTREME_SCORE_STEP) *
            HIGH_ACCURACY_THRESHOLDS.EXTREME_SCORE_INCREMENT;
    } else if (highAccuracyPercentage > HIGH_ACCURACY_THRESHOLDS.HIGH_SUSPICION_THRESHOLD) {
        const progressInRange = (highAccuracyPercentage - HIGH_ACCURACY_THRESHOLDS.HIGH_SUSPICION_THRESHOLD) /
            (HIGH_ACCURACY_THRESHOLDS.EXTREME_SUSPICION_THRESHOLD - HIGH_ACCURACY_THRESHOLDS.HIGH_SUSPICION_THRESHOLD);
        baseScore = HIGH_ACCURACY_THRESHOLDS.MODERATE_MAX_SCORE +
            progressInRange * HIGH_ACCURACY_THRESHOLDS.MODERATE_MAX_SCORE;
    } else {
        const progressInRange = (highAccuracyPercentage - HIGH_ACCURACY_THRESHOLDS.MODERATE_SUSPICION_THRESHOLD) /
            (HIGH_ACCURACY_THRESHOLDS.HIGH_SUSPICION_THRESHOLD - HIGH_ACCURACY_THRESHOLDS.MODERATE_SUSPICION_THRESHOLD);
        baseScore = progressInRange * HIGH_ACCURACY_THRESHOLDS.MODERATE_MAX_SCORE;
    }

    return {
        score: baseScore * sampleWeight,
        debug: { baseScore, sampleWeight }
    };
}

/**
 * Calculate format risk score
 */
function calculateFormatRiskScore(formatMetrics, debug = false) {
    const { WEIGHTS } = window.ChessAntiCheat.config;
    const { currentRating, overallWinrate, gamesCounts, recentGames, accuracy } = formatMetrics;

    const overallWinRateScore = calculateWinRateScore(overallWinrate / 100, gamesCounts.total);
    const recentWinRateScore = calculateWinRateScore(recentGames.winrate / 100, recentGames.total);
    const accuracyResult = calculateHighAccuracyScore(accuracy, currentRating);
    const highAccuracyScore = accuracyResult.score;

    const weightedSum = (
        WEIGHTS.OVERALL_WINRATE * overallWinRateScore +
        WEIGHTS.RECENT_WINRATE * recentWinRateScore +
        WEIGHTS.HIGH_ACCURACY * highAccuracyScore
    );

    if (!debug) return weightedSum;

    return {
        score: weightedSum,
        debug: {
            overallWinRate: {
                raw: overallWinrate,
                score: overallWinRateScore,
                weight: WEIGHTS.OVERALL_WINRATE,
                weighted: WEIGHTS.OVERALL_WINRATE * overallWinRateScore,
                games: gamesCounts.total
            },
            recentWinRate: {
                raw: recentGames.winrate,
                score: recentWinRateScore,
                weight: WEIGHTS.RECENT_WINRATE,
                weighted: WEIGHTS.RECENT_WINRATE * recentWinRateScore,
                games: recentGames.total
            },
            accuracy: {
                raw: accuracy.highAccuracyPercentage,
                ...accuracyResult.debug,
                weight: WEIGHTS.HIGH_ACCURACY,
                weighted: WEIGHTS.HIGH_ACCURACY * accuracyResult.score,
                gamesWithAccuracy: accuracy.gamesWithAccuracy,
                highAccuracyGames: accuracy.highAccuracyGames,
                playerRating: currentRating
            },
            weightedSum
        }
    };
}

/**
 * Calculate final risk score for a player
 */
function calculateRiskScore(metrics, debug = false) {
    const { THRESHOLDS } = window.ChessAntiCheat.config;
    const accountAgeFactor = calculateAccountAgeFactor(metrics.accountAge);

    let maxScore = null;
    let maxFormat = null;
    let maxFactors = null;
    const otherFormats = [];
    const formatScores = [];

    for (const [format, formatMetrics] of Object.entries(metrics.formats)) {
        if (formatMetrics.recentGames.total < THRESHOLDS.MIN_GAMES) continue;

        const result = calculateFormatRiskScore(formatMetrics, debug);
        const rawScore = debug ? result.score : result;
        const finalFormatScore = Math.min(100, accountAgeFactor * rawScore);

        formatScores.push({
            format,
            score: finalFormatScore,
            factors: debug ? {
                ...result.debug,
                accountAgeFactor,
                calculation: {
                    weightedSum: rawScore,
                    accountAgeFactor,
                    beforeCap: accountAgeFactor * rawScore,
                    afterCap: finalFormatScore
                }
            } : null
        });
    }

    if (formatScores.length === 0) {
        return {
            maxScore: { value: 0, format: null, factors: null, reason: 'no_rated_games' },
            otherFormats: [],
            accountAgeScore: accountAgeFactor,
            accountAgeDays: metrics.accountAge,
            username: metrics.username,
            timestamp: new Date().toISOString()
        };
    }

    formatScores.sort((a, b) => b.score - a.score);

    const highest = formatScores[0];
    maxScore = highest.score;
    maxFormat = highest.format;
    maxFactors = highest.factors;

    otherFormats.push(...formatScores.slice(1));

    return {
        maxScore: {
            value: Math.round(maxScore),
            format: maxFormat,
            factors: maxFactors
        },
        otherFormats,
        accountAgeScore: accountAgeFactor,
        accountAgeDays: metrics.accountAge,
        username: metrics.username,
        timestamp: new Date().toISOString()
    };
}

/**
 * Calculate risk score from username (main entry point)
 */
async function calculateRiskScoreFromUsername(username, debug = false) {
    const { gatherPlayerData } = window.ChessAntiCheat.utils;
    const { calculatePlayerMetrics } = window.ChessAntiCheat.metrics;

    const playerData = await gatherPlayerData(username);
    const metrics = await calculatePlayerMetrics(playerData);

    return calculateRiskScore(metrics, debug);
}

/**
 * Get risk level from score
 */
function getRiskLevel(score) {
    const { RISK_LEVELS } = window.ChessAntiCheat.config;

    if (score <= RISK_LEVELS.LOW.max) return RISK_LEVELS.LOW;
    if (score <= RISK_LEVELS.MODERATE.max) return RISK_LEVELS.MODERATE;
    if (score <= RISK_LEVELS.HIGH.max) return RISK_LEVELS.HIGH;
    return RISK_LEVELS.VERY_HIGH;
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ChessAntiCheat = window.ChessAntiCheat || {};
    window.ChessAntiCheat.riskScore = {
        calculateWeight,
        calculateAccountAgeFactor,
        calculateWinRateScore,
        calculateHighAccuracyScore,
        calculateFormatRiskScore,
        calculateRiskScore,
        calculateRiskScoreFromUsername,
        getRiskLevel
    };
}
