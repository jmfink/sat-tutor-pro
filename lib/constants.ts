import type { SubSkill } from '@/types';

// Maps friendly student IDs (used in .env.local) to stable UUIDs.
// The students table requires a UUID primary key, so each person gets a fixed UUID.
// To add a new student, add an entry here and set NEXT_PUBLIC_DEFAULT_STUDENT_ID in .env.local.
const STUDENT_UUID_MAP: Record<string, string> = {
  ethan_001: '00000000-0000-0000-0000-000000000001',
  dad_001:   '00000000-0000-0000-0000-000000000002',
};

const _rawStudentId = process.env.NEXT_PUBLIC_DEFAULT_STUDENT_ID ?? 'ethan_001';
export const DEMO_STUDENT_ID: string = STUDENT_UUID_MAP[_rawStudentId] ?? _rawStudentId;

// Shared session type display helpers
export const SESSION_TYPE_LABELS: Record<string, string> = {
  quick_drill: 'Quick Drill',
  study_session: 'Study Session',
  timed_section: 'Timed Section',
  full_practice_test: 'Practice Test',
  review: 'Review',
};

export const SESSION_TYPE_COLORS: Record<string, string> = {
  quick_drill: 'bg-green-100 text-green-700 border-green-200',
  study_session: 'bg-blue-100 text-blue-700 border-blue-200',
  timed_section: 'bg-orange-100 text-orange-700 border-orange-200',
  full_practice_test: 'bg-purple-100 text-purple-700 border-purple-200',
  review: 'bg-amber-100 text-amber-700 border-amber-200',
};

// Question difficulty display helpers
export function getDifficultyLabel(d: number): string {
  if (d <= 1) return 'Easy';
  if (d <= 2) return 'Medium-Easy';
  if (d <= 3) return 'Medium';
  if (d <= 4) return 'Medium-Hard';
  return 'Hard';
}

export function getDifficultyColor(d: number): string {
  if (d <= 1) return 'bg-green-100 text-green-700 border-green-200';
  if (d <= 2) return 'bg-lime-100 text-lime-700 border-lime-200';
  if (d <= 3) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  if (d <= 4) return 'bg-orange-100 text-orange-700 border-orange-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

// Reusable accuracy percentage helper
export function calcAccuracy(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

// MM:SS formatting for elapsed time
export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const SUB_SKILLS: SubSkill[] = [
  // Reading & Writing
  { id: 'RW-01', name: 'Central Ideas & Details', domain: 'Information and Ideas', section: 'reading_writing' },
  { id: 'RW-02', name: 'Command of Evidence (Textual)', domain: 'Information and Ideas', section: 'reading_writing' },
  { id: 'RW-03', name: 'Command of Evidence (Quantitative)', domain: 'Information and Ideas', section: 'reading_writing' },
  { id: 'RW-04', name: 'Inferences', domain: 'Information and Ideas', section: 'reading_writing' },
  { id: 'RW-05', name: 'Words in Context', domain: 'Craft and Structure', section: 'reading_writing' },
  { id: 'RW-06', name: 'Text Structure and Purpose', domain: 'Craft and Structure', section: 'reading_writing' },
  { id: 'RW-07', name: 'Cross-Text Connections', domain: 'Craft and Structure', section: 'reading_writing' },
  { id: 'RW-08', name: 'Rhetorical Synthesis', domain: 'Craft and Structure', section: 'reading_writing' },
  { id: 'RW-09', name: 'Transitions', domain: 'Expression of Ideas', section: 'reading_writing' },
  { id: 'RW-10', name: 'Boundaries (Sentences)', domain: 'Standard English Conventions', section: 'reading_writing' },
  { id: 'RW-11', name: 'Form, Structure, and Sense', domain: 'Standard English Conventions', section: 'reading_writing' },
  // Math
  { id: 'M-01', name: 'Linear Equations (one variable)', domain: 'Algebra', section: 'math' },
  { id: 'M-02', name: 'Linear Equations (two variables)', domain: 'Algebra', section: 'math' },
  { id: 'M-03', name: 'Linear Functions', domain: 'Algebra', section: 'math' },
  { id: 'M-04', name: 'Systems of Linear Equations', domain: 'Algebra', section: 'math', prerequisites: ['M-01', 'M-02'] },
  { id: 'M-05', name: 'Linear Inequalities', domain: 'Algebra', section: 'math', prerequisites: ['M-01'] },
  { id: 'M-06', name: 'Nonlinear Equations & Functions', domain: 'Advanced Math', section: 'math' },
  { id: 'M-07', name: 'Equivalent Expressions', domain: 'Advanced Math', section: 'math' },
  { id: 'M-08', name: 'Quadratics', domain: 'Advanced Math', section: 'math', prerequisites: ['M-01'] },
  { id: 'M-09', name: 'Exponential Functions', domain: 'Advanced Math', section: 'math' },
  { id: 'M-10', name: 'Ratios, Rates, Proportions', domain: 'Problem Solving & Data', section: 'math' },
  { id: 'M-11', name: 'Percentages', domain: 'Problem Solving & Data', section: 'math' },
  { id: 'M-12', name: 'One-Variable Data (Statistics)', domain: 'Problem Solving & Data', section: 'math' },
  { id: 'M-13', name: 'Two-Variable Data (Scatterplots)', domain: 'Problem Solving & Data', section: 'math' },
  { id: 'M-14', name: 'Probability & Conditional Probability', domain: 'Problem Solving & Data', section: 'math' },
  { id: 'M-15', name: 'Inference from Sample Statistics', domain: 'Problem Solving & Data', section: 'math' },
  { id: 'M-16', name: 'Area and Volume', domain: 'Geometry & Trig', section: 'math' },
  { id: 'M-17', name: 'Lines, Angles, Triangles', domain: 'Geometry & Trig', section: 'math' },
  { id: 'M-18', name: 'Right Triangles & Trigonometry', domain: 'Geometry & Trig', section: 'math', prerequisites: ['M-17'] },
  { id: 'M-19', name: 'Circles', domain: 'Geometry & Trig', section: 'math' },
];

export const SUB_SKILL_MAP = Object.fromEntries(SUB_SKILLS.map(s => [s.id, s]));

export const MASTERY_THRESHOLDS = {
  developing: 0,
  progressing: 1100,
  proficient: 1300,
  mastered: 1500,
} as const;

export function getMasteryLevel(elo: number): 'developing' | 'progressing' | 'proficient' | 'mastered' {
  if (elo >= 1500) return 'mastered';
  if (elo >= 1300) return 'proficient';
  if (elo >= 1100) return 'progressing';
  return 'developing';
}

export const MASTERY_COLORS = {
  developing: 'bg-red-100 text-red-800 border-red-200',
  progressing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  proficient: 'bg-green-100 text-green-800 border-green-200',
  mastered: 'bg-amber-100 text-amber-800 border-amber-200',
} as const;

export const ERROR_TYPE_LABELS: Record<string, string> = {
  conceptual_gap: 'Conceptual Gap',
  procedural_error: 'Procedural Error',
  careless_rush: 'Careless/Rush Error',
  misread_comprehension: 'Misread/Comprehension',
  trap_answer: 'Trap Answer',
  time_pressure: 'Time Pressure',
  knowledge_gap: 'Knowledge Gap',
};

export const SESSION_DURATIONS: Record<string, number> = {
  quick_drill: 10,
  study_session: 35,
  timed_section: 35,
  full_practice_test: 134,
  review: 20,
};

// Timed section question counts and durations
export const SAT_TEST_STRUCTURE = {
  reading_writing: {
    module1: { questions: 27, minutes: 32 },
    module2: { questions: 27, minutes: 32 },
  },
  math: {
    module1: { questions: 22, minutes: 35 },
    module2: { questions: 22, minutes: 35 },
  },
  break_minutes: 10,
};

export const INSIGHT_DIMENSIONS = [
  { id: 'error_types', label: 'Error Types', icon: '🎯' },
  { id: 'topic_clusters', label: 'Topic Clusters', icon: '📚' },
  { id: 'distractor_traps', label: 'Distractor Traps', icon: '🪤' },
  { id: 'question_format', label: 'Question Format', icon: '📝' },
  { id: 'timing_patterns', label: 'Timing Patterns', icon: '⏱️' },
  { id: 'tilt_effect', label: 'Tilt Effect', icon: '🌊' },
  { id: 'reading_breakdown', label: 'Reading Breakdown', icon: '📖' },
  { id: 'confidence_calibration', label: 'Confidence Calibration', icon: '🎲' },
] as const;
