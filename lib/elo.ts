// Elo-style rating system for SAT skill tracking

export const ELO_STARTING_RATING = 1000;
export const CALIBRATION_THRESHOLD = 5; // questions before rating is "calibrated"

// Question difficulty is 1-5, mapped to Elo range
export function difficultyToElo(difficulty: 1 | 2 | 3 | 4 | 5): number {
  const map = { 1: 800, 2: 950, 3: 1100, 4: 1300, 5: 1500 };
  return map[difficulty];
}

// Calculate expected outcome (probability of getting question correct)
function expectedOutcome(studentElo: number, questionElo: number): number {
  return 1 / (1 + Math.pow(10, (questionElo - studentElo) / 400));
}

// Calculate new Elo rating after answering a question
export function calculateNewElo(params: {
  currentElo: number;
  questionDifficulty: 1 | 2 | 3 | 4 | 5;
  isCorrect: boolean;
  questionsAttempted: number;
}): number {
  const { currentElo, questionDifficulty, isCorrect, questionsAttempted } = params;
  const questionElo = difficultyToElo(questionDifficulty);

  // K-factor: higher K early on (more volatile), stabilizes after calibration
  const K = questionsAttempted < CALIBRATION_THRESHOLD ? 40 : 20;

  const expected = expectedOutcome(currentElo, questionElo);
  const actual = isCorrect ? 1 : 0;

  const delta = Math.round(K * (actual - expected));

  // Clamp delta to ±40
  const clampedDelta = Math.max(-40, Math.min(40, delta));

  // Rating bounds: 400-1800
  return Math.max(400, Math.min(1800, currentElo + clampedDelta));
}

// Calculate Elo delta for display purposes
export function calculateEloDelta(params: {
  currentElo: number;
  questionDifficulty: 1 | 2 | 3 | 4 | 5;
  isCorrect: boolean;
  questionsAttempted: number;
}): number {
  const newElo = calculateNewElo(params);
  return newElo - params.currentElo;
}

// Determine trend based on recent ratings history
export function determineTrend(ratingHistory: number[]): 'improving' | 'stagnant' | 'worsening' {
  if (ratingHistory.length < 3) return 'stagnant';
  const recent = ratingHistory.slice(-5);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const diff = last - first;
  if (diff > 30) return 'improving';
  if (diff < -30) return 'worsening';
  return 'stagnant';
}

