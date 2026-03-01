import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { StudentContextProfile, ConversationMessage, ErrorClassification } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Module-level prompt cache — files are read once per process lifetime
const promptCache = new Map<string, string>();

export function loadPrompt(filename: string): string {
  if (promptCache.has(filename)) return promptCache.get(filename)!;
  try {
    const content = readFileSync(join(process.cwd(), 'prompts', filename), 'utf-8');
    promptCache.set(filename, content);
    return content;
  } catch {
    return '';
  }
}

export function injectPromptVars(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (str, [key, val]) => str.replace(new RegExp(`\\{${key}\\}`, 'g'), val),
    template
  );
}

// Streaming tutoring explanation
export async function streamTutoringExplanation(params: {
  mode: 'socratic' | 'direct';
  question: Record<string, unknown>;
  studentAnswer: string;
  studentProfile: StudentContextProfile;
  conversationHistory: ConversationMessage[];
  userMessage: string;
  onChunk: (text: string) => void;
}): Promise<string> {
  const { mode, question, studentAnswer, studentProfile, conversationHistory, userMessage, onChunk } = params;

  const promptFile = mode === 'socratic' ? 'tutor-socratic.md' : 'tutor-direct.md';
  const systemTemplate = loadPrompt(promptFile);
  const systemPrompt = injectPromptVars(systemTemplate, {
    student_profile_json: JSON.stringify(studentProfile, null, 2),
    question_json: JSON.stringify(question, null, 2),
    student_answer: studentAnswer,
  });

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  let fullText = '';
  const stream = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      onChunk(event.delta.text);
      fullText += event.delta.text;
    }
  }

  return fullText;
}

// Classify a wrong answer error type
export async function classifyError(params: {
  question: Record<string, unknown>;
  correctAnswer: string;
  studentAnswer: string;
  timeSpentSeconds: number;
  confidenceLevel: string;
}): Promise<ErrorClassification> {
  const { question, correctAnswer, studentAnswer, timeSpentSeconds, confidenceLevel } = params;

  const systemPrompt = loadPrompt('error-classifier.md');
  const userMessage = injectPromptVars(
    `Question: {question_json}\nCorrect answer: {correct_answer}\nStudent answer: {student_answer}\nTime spent: {time_seconds}s\nStudent confidence: {confidence_level}`,
    {
      question_json: JSON.stringify(question),
      correct_answer: correctAnswer,
      student_answer: studentAnswer,
      time_seconds: String(timeSpentSeconds),
      confidence_level: confidenceLevel,
    }
  );

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in error classification response');
  return JSON.parse(jsonMatch[0]) as ErrorClassification;
}

// Extract the first balanced JSON object from a string.
// Strips markdown code fences (```json ... ``` or ``` ... ```) before searching,
// then uses bracket-depth counting so it stops at the correct closing brace.
function extractFirstJSONObject(text: string): string | null {
  // Remove markdown code fences so the extractor sees raw JSON
  const stripped = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();
  const start = stripped.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === '{') depth++;
    else if (stripped[i] === '}') {
      depth--;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }
  return null;
}

// Pattern recognition analysis (Opus)
export async function analyzePatterns(params: {
  wrongAnswerHistory: Record<string, unknown>[];
  previousInsights?: Record<string, unknown> | null;
}): Promise<Record<string, unknown>> {
  const { wrongAnswerHistory, previousInsights } = params;

  const systemPrompt = loadPrompt('pattern-analyzer.md');
  const userMessage = `WRONG ANSWER HISTORY:\n${JSON.stringify(wrongAnswerHistory, null, 2)}\n\nPREVIOUS INSIGHTS:\n${JSON.stringify(previousInsights || null, null, 2)}\n\nIMPORTANT: Respond with ONLY the JSON object. No explanation, no markdown, no code fences.`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonStr = extractFirstJSONObject(text);
  if (!jsonStr) throw new Error(`No JSON object found in pattern analysis response. Raw: ${text.slice(0, 200)}`);
  return JSON.parse(jsonStr);
}

// Generate session summary
export async function generateSessionSummary(params: {
  session: Record<string, unknown>;
  attempts: Record<string, unknown>[];
  studentProfile: StudentContextProfile;
}): Promise<string> {
  const { session, attempts, studentProfile } = params;

  const systemPrompt = loadPrompt('session-summary.md');
  const userMessage = `Session: ${JSON.stringify(session, null, 2)}\nAttempts: ${JSON.stringify(attempts, null, 2)}\nStudent: ${JSON.stringify(studentProfile, null, 2)}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// Predict score (Opus)
export async function predictScore(params: {
  skillRatings: Record<string, unknown>;
  recentAttempts: Record<string, unknown>[];
}): Promise<{ total_low: number; total_mid: number; total_high: number; rw_score: number; math_score: number; confidence: number }> {
  const { skillRatings, recentAttempts } = params;

  const systemPrompt = `You are an SAT score prediction model. Given a student's skill ratings (Elo scores per sub-skill) and recent attempt history, predict their SAT score range. Return JSON only with fields: total_low, total_mid, total_high, rw_score, math_score, confidence (0-1). Base your prediction on the correlation between Elo ratings and SAT performance. SAT total range is 400-1600. RW and Math each range 200-800.`;

  const userMessage = `Skill Ratings: ${JSON.stringify(skillRatings, null, 2)}\nRecent Attempts (last 50): ${JSON.stringify(recentAttempts.slice(-50), null, 2)}`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { total_low: 1000, total_mid: 1100, total_high: 1200, rw_score: 550, math_score: 550, confidence: 0.5 };
  return JSON.parse(jsonMatch[0]);
}

// ─── PDF parsing helpers ─────────────────────────────────────────────────────

// Standard SAT digital test module layout:
//   R&W Module 1 (Q 1–33), R&W Module 2 (Q 34–66),
//   Math Module 1 (Q 67–93), Math Module 2 (Q 94–120)
const MODULE_META = [
  { offset: 0,  count: 33, section: 'reading_writing' },
  { offset: 33, count: 33, section: 'reading_writing' },
  { offset: 66, count: 27, section: 'math' },
  { offset: 93, count: 27, section: 'math' },
] as const;

/**
 * Regex-parse the scoring-guide answer key (no Claude needed).
 * The guide has exactly 4 "QUESTION #" blocks in module order.
 * Lines inside each block look like:  "1 B"  "6 9"  "13 1/5; .2"
 */
function parseAnswerKey(text: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];

  // Split on the repeating "QUESTION #" marker that heads each answer block
  const blocks = text.split(/QUESTION\s*#/i).slice(1); // skip preamble

  blocks.slice(0, 4).forEach((block, blockIdx) => {
    const { offset, section } = MODULE_META[blockIdx];
    const lineRe = /^(\d+)\s+([A-D][\w./;: -]*)$/gm;
    let m: RegExpExecArray | null;
    while ((m = lineRe.exec(block)) !== null) {
      results.push({
        question_number: parseInt(m[1]) + offset,
        correct_answer: m[2].split(';')[0].trim(), // keep first accepted value
        section,
      });
    }
    // Grid-in answers are numbers, not letters — need a separate pattern
    const gridRe = /^(\d+)\s+(\d[\d./;: -]*)$/gm;
    while ((m = gridRe.exec(block)) !== null) {
      // Avoid duplicating letter answers already captured above
      const qn = parseInt(m[1]) + offset;
      if (!results.find(r => r.question_number === qn)) {
        results.push({
          question_number: qn,
          correct_answer: m[2].split(';')[0].trim(),
          section,
        });
      }
    }
  });

  return results;
}

/**
 * Regex-parse the explanations PDF (no Claude needed).
 * Each module section is headed by "Reading and Writing\nModule N\n(N questions)"
 * or "Math\nModule N\n(N questions)".  Inside each section every question's
 * explanation begins with "QUESTION N".
 */
function parseExplanations(text: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];

  // Find the start position of each module section
  const sectionRe = /(?:Reading and Writing|Math)\s*\nModule\s*\d+\s*\n\(\d+ questions\)/gi;
  const sectionStarts: number[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = sectionRe.exec(text)) !== null) {
    sectionStarts.push(sm.index);
  }

  sectionStarts.forEach((start, sectionIdx) => {
    const end = sectionStarts[sectionIdx + 1] ?? text.length;
    const sectionText = text.slice(start, end);
    const { offset } = MODULE_META[sectionIdx] ?? { offset: 0 };

    const qRe = /QUESTION\s+(\d+)\n([\s\S]+?)(?=QUESTION\s+\d+|\n{4,}|$)/gi;
    let qm: RegExpExecArray | null;
    while ((qm = qRe.exec(sectionText)) !== null) {
      const explanation = qm[2]
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 2000);
      results.push({
        question_number: parseInt(qm[1]) + offset,
        explanation,
      });
    }
  });

  return results;
}

/**
 * Detect the four module boundaries in the questions PDF and return
 * [{start, end, section, offset}] sorted by position.
 */
function detectModuleBoundaries(text: string): Array<{
  start: number; end: number; section: 'reading_writing' | 'math'; offset: number;
}> {
  const boundaries: Array<{ pos: number; section: 'reading_writing' | 'math' }> = [];

  const rwRe = /Reading and Writing\n\d+ QUESTIONS\nDIRECTIONS/g;
  const mathRe = /Math\n\d+ QUESTIONS\nDIRECTIONS/g;
  let m: RegExpExecArray | null;
  while ((m = rwRe.exec(text)) !== null)   boundaries.push({ pos: m.index, section: 'reading_writing' });
  while ((m = mathRe.exec(text)) !== null) boundaries.push({ pos: m.index, section: 'math' });

  boundaries.sort((a, b) => a.pos - b.pos);

  return boundaries.map((b, i) => ({
    start: b.pos,
    end: boundaries[i + 1]?.pos ?? text.length,
    section: b.section,
    offset: MODULE_META[i]?.offset ?? i * 33,
  }));
}

/**
 * Call Claude to extract questions from a single module chunk.
 * Claude numbers questions 1-N locally; we apply `offset` afterwards.
 */
async function parseQuestionChunk(
  chunkText: string,
  section: 'reading_writing' | 'math',
  offset: number,
): Promise<Record<string, unknown>[]> {
  const systemPrompt = loadPrompt('pdf-parser.md');
  const userMessage =
    `Section: ${section}\nPDF Type: questions\n\n` +
    `PDF Text:\n${chunkText.slice(0, 40_000)}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16_000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]';
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  let parsed: Record<string, unknown>[];
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }

  // Apply sequential offset so question numbers are globally unique
  return parsed.map(q => ({
    ...q,
    question_number: (q.question_number as number) + offset,
    section,
  }));
}

// Parse questions from PDF text
export async function parsePDFQuestions(pdfText: string, pdfType: 'questions' | 'answers' | 'explanations'): Promise<Record<string, unknown>[]> {
  if (pdfType === 'answers') {
    return parseAnswerKey(pdfText);
  }

  if (pdfType === 'explanations') {
    return parseExplanations(pdfText);
  }

  // questions: detect module boundaries and parse in parallel
  const modules = detectModuleBoundaries(pdfText);

  if (modules.length === 0) {
    // Fallback: single-pass for non-standard PDFs
    return parseQuestionChunk(pdfText, 'reading_writing', 0);
  }

  const results = await Promise.all(
    modules.map(mod =>
      parseQuestionChunk(
        pdfText.slice(mod.start, mod.end),
        mod.section,
        mod.offset,
      )
    )
  );

  return results.flat();
}

// Generate AI questions for a sub-skill
export async function generateQuestion(subSkillId: string, difficulty: number): Promise<Record<string, unknown>> {
  const systemPrompt = `You are an expert SAT question writer. Generate one SAT-style question that:
- Tests sub-skill: ${subSkillId}
- Has difficulty level: ${difficulty}/5
- Matches real SAT format exactly (4 answer choices A-D for multiple choice)
- Includes a passage if required for reading/writing questions
- Has realistic distractors with clear distractor types

Return as JSON with fields: question_id, question_text, answer_choices (object with A/B/C/D), correct_answer, distractor_analysis, passage_text (if needed), explanation.`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Generate a question for sub-skill ${subSkillId} at difficulty ${difficulty}` }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in question generation response');
  return JSON.parse(jsonMatch[0]);
}

export { anthropic };
