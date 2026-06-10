/**
 * gamification.js
 * CarbonMirror — Challenges, Streaks, Badges, Leaderboard
 * All persistence via localStorage. No server required.
 */

// ─── STORAGE KEY ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'carbonmirror_gamification';

// ─── CHALLENGE DEFINITIONS ───────────────────────────────────────────────────
export const CHALLENGES = [
  {
    id:          'walk_it',
    icon:        '🚶',
    name:        'Walk It',
    duration:    7,
    points:      50,
    description: 'No motorized transport for any journey under 2 km. Walk, cycle, skate.',
    category:    'transport',
    co2SaveKg:   12,
    color:       '#27AE60',
  },
  {
    id:          'meatless_week',
    icon:        '🌱',
    name:        'Meatless Week',
    duration:    7,
    points:      70,
    description: 'Go fully vegetarian for 7 days. Dal, paneer, tofu — you\'ve got options.',
    category:    'food',
    co2SaveKg:   18,
    color:       '#52BE80',
  },
  {
    id:          'lights_out',
    icon:        '💡',
    name:        'Lights Out',
    duration:    7,
    points:      40,
    description: 'Cut electricity use by 20%. Switch off standby devices. Fan > AC.',
    category:    'energy',
    co2SaveKg:   8,
    color:       '#F39C12',
  },
  {
    id:          'metro_month',
    icon:        '🚇',
    name:        'Metro Month',
    duration:    30,
    points:      200,
    description: 'Use only public transport (metro, bus, train) for 30 days. Zero private cab days.',
    category:    'transport',
    co2SaveKg:   80,
    color:       '#2980B9',
  },
  {
    id:          'no_fast_fashion',
    icon:        '👕',
    name:        'No Fast Fashion',
    duration:    30,
    points:      150,
    description: 'Zero new clothing purchases for 30 days. Swap, repair, or thrift instead.',
    category:    'shopping',
    co2SaveKg:   30,
    color:       '#8E44AD',
  },
  {
    id:          'plant_pioneer',
    icon:        '🥗',
    name:        'Plant Pioneer',
    duration:    30,
    points:      250,
    description: 'Fully vegan diet for 30 days. India\'s cuisine makes this easier than you think.',
    category:    'food',
    co2SaveKg:   120,
    color:       '#1B4332',
  },
];

// ─── BADGE DEFINITIONS ───────────────────────────────────────────────────────
export const BADGES = [
  {
    id:          'carbon_rookie',
    icon:        '🌱',
    name:        'Carbon Rookie',
    description: 'Calculated your carbon footprint for the first time.',
    unlockCheck: (state) => state.calculatorCompleted,
  },
  {
    id:          'eco_commuter',
    icon:        '🚲',
    name:        'Eco Commuter',
    description: 'Completed a 7-day transport challenge streak.',
    unlockCheck: (state) => state.challenges?.walk_it?.streak >= 7 || state.challenges?.metro_month?.streak >= 7,
  },
  {
    id:          'plant_based_pioneer',
    icon:        '🥗',
    name:        'Plant-Based Pioneer',
    description: 'Completed the Meatless Week challenge.',
    unlockCheck: (state) => state.challenges?.meatless_week?.completed,
  },
  {
    id:          'energy_guardian',
    icon:        '⚡',
    name:        'Energy Guardian',
    description: 'Completed the Lights Out challenge.',
    unlockCheck: (state) => state.challenges?.lights_out?.completed,
  },
  {
    id:          'carbon_champion',
    icon:        '🏆',
    name:        'Carbon Champion',
    description: 'Earned over 500 eco points.',
    unlockCheck: (state) => state.totalPoints >= 500,
  },
  {
    id:          'pledge_maker',
    icon:        '📣',
    name:        'Pledge Maker',
    description: 'Shared your carbon story on social media.',
    unlockCheck: (state) => state.hasShared,
  },
  {
    id:          'climate_warrior',
    icon:        '🌍',
    name:        'Climate Warrior',
    description: 'Completed all 6 eco challenges.',
    unlockCheck: (state) => CHALLENGES.every(c => state.challenges?.[c.id]?.completed),
  },
  {
    id:          'streak_master',
    icon:        '🔥',
    name:        'Streak Master',
    description: 'Maintained a 7-day streak on any challenge.',
    unlockCheck: (state) => Object.values(state.challenges ?? {}).some(c => (c.streak ?? 0) >= 7),
  },
];

// ─── SEEDED LEADERBOARD PERSONAS ─────────────────────────────────────────────
export const SEEDED_PERSONAS = [
  { id: 'ananya_pune',   name: 'Ananya from Pune',      city: 'Pune',      points: 560, kg: 950  },
  { id: 'priya_blr',    name: 'Priya from Bengaluru',   city: 'Bengaluru', points: 480, kg: 1200 },
  { id: 'kavya_kol',    name: 'Kavya from Kolkata',     city: 'Kolkata',   points: 420, kg: 1650 },
  { id: 'meera_che',    name: 'Meera from Chennai',     city: 'Chennai',   points: 390, kg: 1800 },
  { id: 'rohan_mum',    name: 'Rohan from Mumbai',      city: 'Mumbai',    points: 310, kg: 2400 },
  { id: 'dev_jai',      name: 'Dev from Jaipur',        city: 'Jaipur',    points: 260, kg: 3100 },
  { id: 'arjun_del',    name: 'Arjun from Delhi',       city: 'Delhi',     points: 220, kg: 3800 },
  { id: 'vikram_hyd',   name: 'Vikram from Hyderabad',  city: 'Hyderabad', points: 175, kg: 4200 },
];

// ─── STATE MANAGEMENT ────────────────────────────────────────────────────────

/**
 * Load gamification state from localStorage.
 * @returns {GamificationState}
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

/**
 * Save gamification state to localStorage.
 * @param {GamificationState} state
 */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[CarbonMirror] Could not save gamification state:', e);
  }
}

/**
 * Default empty state.
 * @returns {GamificationState}
 */
function defaultState() {
  const challenges = {};
  CHALLENGES.forEach(c => {
    challenges[c.id] = {
      active:    false,
      completed: false,
      streak:    0,
      startDate: null,
      lastCheckIn: null,
      totalPoints: 0,
    };
  });

  return {
    totalPoints:          0,
    calculatorCompleted:  false,
    hasShared:            false,
    unlockedBadges:       [],
    challenges,
    userName:             '',
    userCity:             '',
    userKg:               0,
  };
}

// ─── CHALLENGE ACTIONS ───────────────────────────────────────────────────────

/**
 * Join a challenge (set it active).
 * @param {string} challengeId
 * @param {GamificationState} state
 * @returns {{ state: GamificationState, message: string }}
 */
export function joinChallenge(challengeId, state) {
  const challenge = CHALLENGES.find(c => c.id === challengeId);
  if (!challenge) return { state, message: 'Challenge not found.' };

  if (state.challenges[challengeId]?.active) {
    return { state, message: `You're already on the ${challenge.name} challenge!` };
  }
  if (state.challenges[challengeId]?.completed) {
    return { state, message: `You've already completed ${challenge.name}! 🎉` };
  }

  const newState = { ...state };
  newState.challenges = { ...state.challenges };
  newState.challenges[challengeId] = {
    ...newState.challenges[challengeId],
    active:      true,
    completed:   false,
    streak:      0,
    startDate:   new Date().toISOString().split('T')[0],
    lastCheckIn: null,
  };

  const updated = checkBadges(saveStateReturn(newState));
  return { state: updated, message: `🌱 You've joined the "${challenge.name}" challenge!` };
}

/**
 * Daily check-in for a challenge.
 * @param {string} challengeId
 * @param {GamificationState} state
 * @returns {{ state: GamificationState, message: string, pointsEarned: number, newBadges: string[] }}
 */
export function dailyCheckIn(challengeId, state) {
  const challenge = CHALLENGES.find(c => c.id === challengeId);
  if (!challenge) return { state, message: 'Challenge not found.', pointsEarned: 0, newBadges: [] };

  const cState = state.challenges[challengeId];
  if (!cState?.active) {
    return { state, message: 'Join this challenge first!', pointsEarned: 0, newBadges: [] };
  }

  const today    = new Date().toISOString().split('T')[0];
  const lastCI   = cState.lastCheckIn;

  if (lastCI === today) {
    return { state, message: 'You\'ve already checked in today! Come back tomorrow. 💪', pointsEarned: 0, newBadges: [] };
  }

  // Check if streak is broken (more than 1 day gap)
  const yesterday = getPreviousDay(today);
  const streakBroken = lastCI && lastCI !== yesterday && lastCI !== today;

  let newStreak     = streakBroken ? 1 : (cState.streak + 1);
  let pointsEarned  = Math.round(challenge.points / challenge.duration); // daily point slice

  // Streak bonuses
  if (newStreak === 3) pointsEarned += 5;
  if (newStreak === 7) pointsEarned += 15;
  if (newStreak === 14) pointsEarned += 30;
  if (newStreak === 30) pointsEarned += 80;

  const completed = newStreak >= challenge.duration;
  if (completed) pointsEarned += Math.round(challenge.points * 0.5); // completion bonus

  const newState = { ...state };
  newState.challenges = { ...state.challenges };
  newState.challenges[challengeId] = {
    ...cState,
    streak:      newStreak,
    lastCheckIn: today,
    completed:   completed || cState.completed,
    active:      !completed,
  };
  newState.totalPoints = (state.totalPoints || 0) + pointsEarned;

  const previousBadges = [...(state.unlockedBadges || [])];
  const finalState     = checkBadges(saveStateReturn(newState));
  const newBadges      = finalState.unlockedBadges.filter(b => !previousBadges.includes(b));

  let message = streakBroken
    ? `Streak reset. Starting fresh at Day 1! 💪`
    : completed
      ? `🏆 Challenge complete! You earned ${pointsEarned} bonus points!`
      : `✅ Day ${newStreak}/${challenge.duration} checked in! +${pointsEarned} pts`;

  return { state: finalState, message, pointsEarned, newBadges, streakBroken };
}

/**
 * Abandon an active challenge.
 * @param {string} challengeId
 * @param {GamificationState} state
 * @returns {GamificationState}
 */
export function abandonChallenge(challengeId, state) {
  const newState = { ...state };
  newState.challenges = { ...state.challenges };
  newState.challenges[challengeId] = {
    ...newState.challenges[challengeId],
    active:      false,
    streak:      0,
    lastCheckIn: null,
  };
  return saveStateReturn(newState);
}

// ─── BADGE SYSTEM ─────────────────────────────────────────────────────────────

/**
 * Check and unlock any newly earned badges.
 * @param {GamificationState} state
 * @returns {GamificationState}
 */
export function checkBadges(state) {
  const currentUnlocked = new Set(state.unlockedBadges || []);
  let changed = false;

  for (const badge of BADGES) {
    if (!currentUnlocked.has(badge.id)) {
      try {
        if (badge.unlockCheck(state)) {
          currentUnlocked.add(badge.id);
          changed = true;
        }
      } catch { /* silent */ }
    }
  }

  if (!changed) return state;

  const newState = { ...state, unlockedBadges: [...currentUnlocked] };
  return saveStateReturn(newState);
}

/**
 * Mark calculator as completed (triggers Carbon Rookie badge).
 * @param {GamificationState} state
 * @param {number} userKg
 * @returns {GamificationState}
 */
export function markCalculatorComplete(state, userKg) {
  const newState = { ...state, calculatorCompleted: true, userKg };
  return checkBadges(saveStateReturn(newState));
}

/**
 * Mark social share as done.
 * @param {GamificationState} state
 * @returns {GamificationState}
 */
export function markShared(state) {
  const newState = { ...state, hasShared: true };
  return checkBadges(saveStateReturn(newState));
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────

/**
 * Get the full leaderboard (seeded + user if they have points).
 * @param {GamificationState} state
 * @param {string} userName
 * @returns {Array<LeaderboardEntry>}
 */
export function getLeaderboard(state, userName) {
  const entries = [...SEEDED_PERSONAS.map(p => ({ ...p, isUser: false }))];

  // Add the user if they have points
  if (state.totalPoints > 0) {
    entries.push({
      id:      'current_user',
      name:    userName || 'You',
      city:    state.userCity || 'Your City',
      points:  state.totalPoints,
      kg:      state.userKg || 0,
      isUser:  true,
    });
  }

  // Sort by points descending
  entries.sort((a, b) => b.points - a.points);

  // Assign ranks
  return entries.map((e, i) => ({ ...e, rank: i + 1 }));
}

/**
 * Get the user's rank in the leaderboard.
 * @param {GamificationState} state
 * @param {string} userName
 * @returns {number|null}
 */
export function getUserRank(state, userName) {
  const board = getLeaderboard(state, userName);
  const user  = board.find(e => e.isUser);
  return user?.rank ?? null;
}

// ─── STREAK UTILITIES ────────────────────────────────────────────────────────

/**
 * Get the streak indicator emoji for a given streak count.
 * @param {number} streak
 * @returns {string}
 */
export function getStreakEmoji(streak) {
  if (streak >= 30) return '🏆';
  if (streak >= 7)  return '🌿';
  if (streak >= 3)  return '🔥';
  return '✅';
}

/**
 * Generate streak dots array for visualization.
 * @param {number} streak  - Current streak
 * @param {number} total   - Total days in challenge
 * @returns {Array<'empty'|'filled'|'fire'>}
 */
export function getStreakDots(streak, total) {
  const dotsCount = Math.min(total, 14); // Max 14 visible dots
  return Array.from({ length: dotsCount }, (_, i) => {
    if (i >= streak) return 'empty';
    if (i >= streak - 3 && streak >= 3) return 'fire';
    return 'filled';
  });
}

/**
 * Check if a streak is currently broken (missed a day).
 * @param {string|null} lastCheckIn - ISO date string
 * @returns {boolean}
 */
export function isStreakBroken(lastCheckIn) {
  if (!lastCheckIn) return false;
  const today     = new Date().toISOString().split('T')[0];
  const yesterday = getPreviousDay(today);
  return lastCheckIn !== today && lastCheckIn !== yesterday;
}

// ─── POINTS UTILS ─────────────────────────────────────────────────────────────

/**
 * Get total CO₂ saved from completed challenges.
 * @param {GamificationState} state
 * @returns {number}
 */
export function getTotalCO2Saved(state) {
  return CHALLENGES.reduce((acc, c) => {
    if (state.challenges?.[c.id]?.completed) {
      return acc + c.co2SaveKg;
    }
    return acc;
  }, 0);
}

/**
 * Get total active challenges count.
 * @param {GamificationState} state
 * @returns {number}
 */
export function getActiveChallengeCount(state) {
  return CHALLENGES.filter(c => state.challenges?.[c.id]?.active).length;
}

/**
 * Get best streak across all challenges.
 * @param {GamificationState} state
 * @returns {number}
 */
export function getBestStreak(state) {
  return CHALLENGES.reduce((best, c) => {
    const streak = state.challenges?.[c.id]?.streak ?? 0;
    return Math.max(best, streak);
  }, 0);
}

// ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

function saveStateReturn(state) {
  saveState(state);
  return state;
}

function getPreviousDay(isoDate) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * @typedef {Object} GamificationState
 * @property {number}   totalPoints
 * @property {boolean}  calculatorCompleted
 * @property {boolean}  hasShared
 * @property {string[]} unlockedBadges
 * @property {Object}   challenges
 * @property {string}   userName
 * @property {string}   userCity
 * @property {number}   userKg
 *
 * @typedef {Object} LeaderboardEntry
 * @property {string}  id
 * @property {string}  name
 * @property {string}  city
 * @property {number}  points
 * @property {number}  kg
 * @property {boolean} isUser
 * @property {number}  rank
 */
