import type { SubSkillId } from '@/types';
import type { SkillRating, Question } from '@/types';
import { SUB_SKILLS } from '@/lib/constants';

export interface SelectionContext {
  skillRatings: SkillRating[];
  dueForReview: string[]; // question_ids due for spaced repetition
  sessionState: {
    questionsAnswered: number;
    sessionDurationMinutes: number;
    isFrustrated: boolean;
  };
  recentlyAnswered: string[]; // question_ids answered in this session
}

// Get 3 lowest-rated calibrated sub-skills
function getLowestRatedSkills(ratings: SkillRating[], count: number): SubSkillId[] {
  return ratings
    .filter(r => r.is_calibrated)
    .sort((a, b) => a.elo_rating - b.elo_rating)
    .slice(0, count)
    .map(r => r.sub_skill_id as SubSkillId);
}

// Get sub-skills most due for spaced repetition (lowest last_updated)
function getSpacedRepetitionSkills(ratings: SkillRating[], count: number): SubSkillId[] {
  return ratings
    .filter(r => r.is_calibrated)
    .sort((a, b) => new Date(a.last_updated).getTime() - new Date(b.last_updated).getTime())
    .slice(0, count)
    .map(r => r.sub_skill_id as SubSkillId);
}

// Weighted random selection
function weightedRandom<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

// Select next sub-skill to practice
export function selectNextSubSkill(context: SelectionContext): SubSkillId | null {
  const { skillRatings } = context;

  // New student with no history: pick a random sub-skill from the full list
  if (skillRatings.length === 0) {
    return SUB_SKILLS[Math.floor(Math.random() * SUB_SKILLS.length)].id as SubSkillId;
  }

  // Get candidate skill pools
  const lowestRated = getLowestRatedSkills(skillRatings, 3);
  const spacedRep = getSpacedRepetitionSkills(skillRatings, 2);

  // All sub-skills for random exposure
  const allSkills = skillRatings.map(r => r.sub_skill_id as SubSkillId);

  // Build weighted pool: 50% lowest-rated, 30% spaced rep, 20% random
  const candidates: SubSkillId[] = [];
  const weights: number[] = [];

  for (const skill of lowestRated) {
    candidates.push(skill);
    weights.push(50 / lowestRated.length);
  }

  for (const skill of spacedRep) {
    if (!candidates.includes(skill)) {
      candidates.push(skill);
      weights.push(30 / spacedRep.length);
    }
  }

  // Add random skills not already in pool
  const remainingSkills = allSkills.filter(s => !candidates.includes(s));
  const randomCount = Math.min(3, remainingSkills.length);
  for (let i = 0; i < randomCount; i++) {
    const idx = Math.floor(Math.random() * remainingSkills.length);
    candidates.push(remainingSkills[idx]);
    weights.push(20 / randomCount);
    remainingSkills.splice(idx, 1);
  }

  if (candidates.length === 0) return allSkills[Math.floor(Math.random() * allSkills.length)] || null;

  return weightedRandom(candidates, weights);
}

// Determine target difficulty for a sub-skill
export function selectTargetDifficulty(params: {
  currentElo: number;
  isFrustrated: boolean;
  questionsAnswered: number;
  sessionDurationMinutes: number;
}): 1 | 2 | 3 | 4 | 5 {
  const { currentElo, isFrustrated, sessionDurationMinutes } = params;

  // Session energy management: ease off near end
  let eloAdjustment = 0;

  if (sessionDurationMinutes < 5) {
    eloAdjustment = -75; // warm up: medium
  } else if (sessionDurationMinutes < 15) {
    eloAdjustment = 0; // ramp to challenging
  } else if (sessionDurationMinutes < 25) {
    eloAdjustment = 75; // peak: hardest
  } else if (sessionDurationMinutes < 35) {
    eloAdjustment = -25; // consolidation
  } else {
    eloAdjustment = -150; // end on a win
  }

  // Frustration: make easier
  if (isFrustrated) eloAdjustment -= 100;

  const targetElo = currentElo + eloAdjustment;

  // Map target Elo to difficulty
  if (targetElo >= 1400) return 5;
  if (targetElo >= 1200) return 4;
  if (targetElo >= 1000) return 3;
  if (targetElo >= 850) return 2;
  return 1;
}

// Select a question from the bank for a given sub-skill and difficulty
export function selectQuestion(params: {
  questions: Question[];
  subSkillId: SubSkillId;
  targetDifficulty: 1 | 2 | 3 | 4 | 5;
  excludeIds: string[];
}): Question | null {
  const { questions, subSkillId, targetDifficulty, excludeIds } = params;

  const candidates = questions.filter(
    q => q.sub_skill_id === subSkillId && !excludeIds.includes(q.question_id)
  );

  if (candidates.length === 0) return null;

  // First try exact difficulty match
  const exact = candidates.filter(q => q.difficulty === targetDifficulty);
  if (exact.length > 0) {
    return exact[Math.floor(Math.random() * exact.length)];
  }

  // Fall back to closest difficulty — pick randomly among equal-distance candidates
  const sorted = [...candidates].sort(
    (a, b) => Math.abs(a.difficulty - targetDifficulty) - Math.abs(b.difficulty - targetDifficulty)
  );
  const minDist = Math.abs(sorted[0].difficulty - targetDifficulty);
  const closest = sorted.filter(q => Math.abs(q.difficulty - targetDifficulty) === minDist);
  return closest[Math.floor(Math.random() * closest.length)];
}
