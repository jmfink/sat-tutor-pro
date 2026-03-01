import type { SkillRating } from '@/types';
import { SUB_SKILLS } from './constants';

// Estimate SAT section score from skill ratings
export function estimateSectionScore(
  ratings: SkillRating[],
  section: 'math' | 'reading_writing'
): number {
  const sectionSkills = SUB_SKILLS.filter(s => s.section === section);

  const relevantRatings = ratings.filter(r =>
    sectionSkills.some(s => s.id === r.sub_skill_id)
  );

  if (relevantRatings.length === 0) return 500; // Default mid-range

  // Weight by calibration
  const weightedSum = relevantRatings.reduce((sum, r) => {
    const weight = r.is_calibrated ? 1 : 0.5;
    return sum + r.elo_rating * weight;
  }, 0);

  const totalWeight = relevantRatings.reduce((sum, r) => {
    return sum + (r.is_calibrated ? 1 : 0.5);
  }, 0);

  const avgElo = weightedSum / totalWeight;

  // Map average Elo (400-1800) to SAT section score (200-800)
  const normalized = Math.max(0, Math.min(1, (avgElo - 400) / 1400));
  const rawScore = 200 + normalized * 600;

  // Round to nearest 10 (SAT scores are in increments of 10)
  return Math.round(rawScore / 10) * 10;
}

export interface ScorePrediction {
  total_score_low: number;
  total_score_mid: number;
  total_score_high: number;
  rw_score: number;
  math_score: number;
  confidence: number;
}

export function predictScoreLocally(ratings: SkillRating[]): ScorePrediction {
  const rwScore = estimateSectionScore(ratings, 'reading_writing');
  const mathScore = estimateSectionScore(ratings, 'math');
  const totalMid = rwScore + mathScore;

  // Confidence based on how many skills are calibrated
  const calibratedCount = ratings.filter(r => r.is_calibrated).length;
  const totalSkills = 30; // 11 RW + 19 math
  const confidence = Math.min(1, calibratedCount / totalSkills);

  // Score range: ±30-60 depending on confidence
  const rangeWidth = Math.round((1 - confidence) * 80 + 20);

  return {
    total_score_low: Math.max(400, totalMid - rangeWidth),
    total_score_mid: totalMid,
    total_score_high: Math.min(1600, totalMid + rangeWidth),
    rw_score: rwScore,
    math_score: mathScore,
    confidence,
  };
}

// Get score trend description
export function getScoreTrend(predictions: ScorePrediction[]): 'up' | 'down' | 'flat' {
  if (predictions.length < 2) return 'flat';
  const recent = predictions[predictions.length - 1].total_score_mid;
  const previous = predictions[predictions.length - 2].total_score_mid;
  if (recent > previous + 10) return 'up';
  if (recent < previous - 10) return 'down';
  return 'flat';
}
