/**
 * Chess.com Anti-Cheat Extension Configuration
 * Thresholds and constants for risk score calculation
 */

// Game result mappings from Chess.com API
const GAME_RESULTS = {
    // Wins
    'win': 'win',

    // Draws
    'agreed': 'draw',
    'repetition': 'draw',
    'stalemate': 'draw',
    'insufficient': 'draw',
    '50move': 'draw',
    'timevsinsufficient': 'draw',

    // Losses
    'checkmated': 'loss',
    'timeout': 'loss',
    'resigned': 'loss',
    'lose': 'loss',
    'abandoned': 'loss'
};

// Supported game formats
const GAME_FORMATS = ['chess_rapid', 'chess_bullet', 'chess_blitz'];

// Accuracy thresholds based on rating
const ACCURACY_THRESHOLDS = {
    LOW_RATING: {
        threshold: 1500,
        requiredAccuracy: 80
    },
    HIGH_RATING: {
        threshold: 1500,
        requiredAccuracy: 90
    }
};

// Weights for risk score components
const WEIGHTS = {
    OVERALL_WINRATE: 0.35,
    RECENT_WINRATE: 0.35,
    HIGH_ACCURACY: 0.30
};

// General thresholds
const THRESHOLDS = {
    ACCOUNT_AGE_DAYS: 60,
    WINRATE: {
        BASELINE: 50,
        SUSPICIOUS: 55,
        HIGH_RISK: 70
    },
    WEIGHTING_K: 20,
    MIN_GAMES: 5,
    ACCOUNT_AGE_MULTIPLIER: 1.5
};

// Win rate scoring thresholds
const WINRATE_THRESHOLDS = {
    LOW_WINRATE_THRESHOLD: 0.5,
    MEDIUM_WINRATE_THRESHOLD: 0.6,
    HIGH_WINRATE_THRESHOLD: 0.7,
    HIGH_WINRATE_MULTIPLIER: 2,
    MEDIUM_WINRATE_MULTIPLIER: 1,
    BASE_SCORE: 50,
    EXTENDED_SCORE: 100,
    SCALE_FACTOR: 0.1,
    SIGNIFICANT_DIFF: 0.15,
    MAX_SCORE: 100,
    COMBINED_WEIGHT_FACTOR: 2
};

// High accuracy scoring thresholds
const HIGH_ACCURACY_THRESHOLDS = {
    MODERATE_SUSPICION_THRESHOLD: 10,
    HIGH_SUSPICION_THRESHOLD: 20,
    EXTREME_SUSPICION_THRESHOLD: 30,
    SUSPICION_SCALE_FACTOR: 1.5,
    MODERATE_MAX_SCORE: 50,
    HIGH_MAX_SCORE: 100,
    EXTREME_SCORE_INCREMENT: 50,
    EXTREME_SCORE_STEP: 5
};

// User-configurable settings (defaults)
const DEFAULT_SETTINGS = {
    RATED_ONLY: true,
    AUTO_OPEN_POPUP: true,
    SHOW_IN_PAGE_BADGE: true,
    HIGH_RISK_THRESHOLD: 70,
    MODERATE_RISK_THRESHOLD: 50
};

// Risk level definitions
const RISK_LEVELS = {
    LOW: { min: 0, max: 30, color: '#4CAF50', label: 'Low Risk' },
    MODERATE: { min: 31, max: 50, color: '#FFC107', label: 'Moderate Risk' },
    HIGH: { min: 51, max: 70, color: '#FF9800', label: 'High Risk' },
    VERY_HIGH: { min: 71, max: 100, color: '#F44336', label: 'Very High Risk' }
};

// Export for use in other modules (Firefox compatible)
if (typeof window !== 'undefined') {
    window.ChessAntiCheat = window.ChessAntiCheat || {};
    window.ChessAntiCheat.config = {
        GAME_RESULTS,
        GAME_FORMATS,
        ACCURACY_THRESHOLDS,
        WEIGHTS,
        THRESHOLDS,
        WINRATE_THRESHOLDS,
        HIGH_ACCURACY_THRESHOLDS,
        DEFAULT_SETTINGS,
        RISK_LEVELS
    };
}
