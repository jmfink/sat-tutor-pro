// SAT Tutor Pro — Core Types

export type Section = 'math' | 'reading_writing';

export type SubSkillId =
  | 'RW-01' | 'RW-02' | 'RW-03' | 'RW-04' | 'RW-05'
  | 'RW-06' | 'RW-07' | 'RW-08' | 'RW-09' | 'RW-10' | 'RW-11'
  | 'M-01' | 'M-02' | 'M-03' | 'M-04' | 'M-05' | 'M-06' | 'M-07'
  | 'M-08' | 'M-09' | 'M-10' | 'M-11' | 'M-12' | 'M-13' | 'M-14'
  | 'M-15' | 'M-16' | 'M-17' | 'M-18' | 'M-19';

export interface SubSkill {
  id: SubSkillId;
  name: string;
  domain: string;
  section: Section;
  prerequisites?: SubSkillId[];
}

export type MasteryLevel = 'developing' | 'progressing' | 'proficient' | 'mastered';

export interface SkillRating {
  sub_skill_id: SubSkillId;
  elo_rating: number;
  questions_attempted: number;
  questions_correct: number;
  is_calibrated: boolean;
  last_updated: string;
}

export interface Question {
  id: string;
  question_id: string;
  source: string;
  section: Section;
  sub_skill_id: SubSkillId;
  difficulty: 1 | 2 | 3 | 4 | 5;
  question_text: string;
  passage_id?: string | null;
  answer_choices: Record<string, string>; // { A: "...", B: "...", C: "...", D: "..." }
  correct_answer: string;
  distractor_analysis?: Record<string, string> | null;
  is_ai_generated: boolean;
  tags: string[];
  /** Set to true when PDF extraction has produced corrupted notation (e.g. x^2).
   *  Questions with this flag are excluded from study sessions until reviewed.
   *  Populated by the 002_add_formatting_issues_flag.sql migration. */
  has_formatting_issues?: boolean;
}

export interface Passage {
  passage_id: string;
  passage_text: string;
  passage_type?: 'literary_fiction' | 'social_science' | 'natural_science' | 'humanities';
  word_count?: number;
  source?: string;
}

export type SessionType = 'quick_drill' | 'study_session' | 'timed_section' | 'full_practice_test' | 'review';

export interface Session {
  id: string;
  student_id: string;
  session_type: SessionType;
  started_at: string;
  ended_at?: string;
  questions_answered: number;
  questions_correct: number;
  accuracy?: number;
  summary?: string;
  mood_signals: MoodSignal[];
  sub_skills_practiced: SubSkillId[];
  sub_skill_focus?: SubSkillId;
  metadata: Record<string, unknown>;
}

export type ConfidenceLevel = 'guessing' | 'okay' | 'confident';

export type ErrorType =
  | 'conceptual_gap'
  | 'procedural_error'
  | 'careless_rush'
  | 'misread_comprehension'
  | 'trap_answer'
  | 'time_pressure'
  | 'knowledge_gap';

export type DistractorType =
  | 'partial_answer'
  | 'sign_error'
  | 'misapplied_formula'
  | 'scope_error'
  | 'sounds_right'
  | 'wrong_variable'
  | 'other';

export interface QuestionAttempt {
  id: string;
  student_id: string;
  session_id: string;
  question_id: string;
  student_answer: string;
  is_correct: boolean;
  time_spent_seconds?: number;
  confidence_level?: ConfidenceLevel;
  error_type?: ErrorType;
  distractor_type?: DistractorType;
  error_explanation?: string;
  explanation_strategy_used?: string;
  attempted_at: string;
}

export type MoodSignal = 'consecutive_wrong' | 'rushing' | 'shutting_down' | 'terse_response' | 'skip_request';

export interface StudentProfile {
  id: string;
  name: string;
  email?: string;
  parent_email?: string;
  created_at: string;
  settings: {
    preferred_explanation_style?: 'visual' | 'algebraic' | 'analogy' | 'elimination';
    socratic_mode?: boolean;
    dark_mode?: boolean;
  };
}

export interface SessionState {
  questions_answered: number;
  accuracy_this_session: number;
  current_mood_signal: 'neutral' | 'frustrated' | 'confident';
  consecutive_wrong: number;
  time_in_session_minutes: number;
}

export interface StudentContextProfile {
  student_id: string;
  session_number: number;
  current_predicted_score: {
    total: number;
    rw: number;
    math: number;
  };
  skill_ratings: Record<SubSkillId, { elo: number; trend: 'improving' | 'stagnant' | 'worsening'; calibrated: boolean }>;
  top_3_weaknesses: SubSkillId[];
  recent_wrong_answers: {
    question_id: string;
    error_type: ErrorType;
    sub_skill: SubSkillId;
    time_spent_seconds: number;
    confidence: ConfidenceLevel;
  }[];
  session_state: SessionState;
  learning_preferences: {
    preferred_explanation_style: string;
    socratic_mode: boolean;
  };
}

export interface InsightDimension {
  finding: string;
  evidence_question_ids: string[];
  severity: 'high' | 'medium' | 'low';
  trend: 'improving' | 'stagnant' | 'worsening';
  recommendation: string;
}

export interface WrongAnswerInsight {
  id: string;
  student_id: string;
  generated_at: string;
  total_wrong_answers_analyzed: number;
  top_insights: InsightDimension[];
  dimension_details: Record<string, InsightDimension>;
  raw_analysis?: string;
}

export interface ScorePrediction {
  id: string;
  student_id: string;
  predicted_at: string;
  total_score_low: number;
  total_score_mid: number;
  total_score_high: number;
  rw_score: number;
  math_score: number;
  confidence: number;
}

export interface ReviewQueueItem {
  id: string;
  student_id: string;
  question_id: string;
  next_review_date: string;
  review_count: number;
  last_review_result?: boolean;
  interval_days: number;
}

export interface DailyActivity {
  id: string;
  student_id: string;
  activity_date: string;
  questions_answered: number;
  streak_qualifying: boolean;
}

export type TutorMode = 'socratic' | 'direct';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ErrorClassification {
  error_type: ErrorType;
  explanation: string;
  distractor_type: DistractorType;
  what_student_likely_thought: string;
}
