# SAT Tutor Pro — Product & Technical Specification

## Document Info

| Field | Value |
|---|---|
| Author | Tim |
| Version | 1.1 |
| Date | February 23, 2026 |
| Target User | Oren (16, rising junior) |
| Tech Stack | Claude API (Sonnet 4.6 + Opus 4.6), Next.js, Supabase |
| Build Tool | Claude Code |

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Phase Overview](#2-phase-overview)
3. [Information Architecture](#3-information-architecture)
4. [Module 1: Adaptive Learning Engine](#4-module-1-adaptive-learning-engine)
5. [Module 2: Practice & Test Simulation](#5-module-2-practice--test-simulation)
6. [Module 3: Wrong Answer Intelligence (Pattern Recognition)](#6-module-3-wrong-answer-intelligence-pattern-recognition)
7. [Module 4: Analytics & Progress Dashboard](#7-module-4-analytics--progress-dashboard)
8. [Module 5: Emotional Intelligence Layer](#8-module-5-emotional-intelligence-layer)
9. [Module 6: Engagement & Gamification](#9-module-6-engagement--gamification)
10. [Claude API Architecture](#10-claude-api-architecture)
11. [Data Model](#11-data-model)
12. [Technical Architecture](#12-technical-architecture)
13. [Phase 1 Scope (Desktop Web)](#13-phase-1-scope-desktop-web)
14. [Phase 2 Scope (Mobile Web)](#14-phase-2-scope-mobile-web)
15. [Cost Estimates](#15-cost-estimates)

---

## 1. Product Vision

Build an AI-powered SAT tutoring app that is measurably better than a $150/hr human tutor by leveraging three structural advantages that no human can replicate:

1. **Perfect memory** — Every wrong answer, every hesitation, every pattern is logged and recalled.
2. **Algorithmic adaptation** — Difficulty, topic selection, and explanation style adjust in real-time based on hundreds of data points, not intuition.
3. **Pattern recognition at scale** — The AI analyzes wrong answers across dimensions no human tutor would track: answer choice patterns, error type clustering, time-of-day performance, topic interaction effects, and linguistic traps the student falls for repeatedly.

The app should feel like a patient, endlessly available tutor who knows exactly what the student struggles with, why they struggle with it, and what to do next — and who can prove it with data.

---

## 2. Phase Overview

### Phase 1 — Desktop Web App

- **Target**: Full-featured tutoring experience optimized for desktop/laptop (1024px+ viewport)
- **Timeline**: 4-6 weeks
- **Scope**: All 6 modules, full Claude API integration, Supabase backend, parent dashboard
- **Why desktop first**: Full practice tests and reading passages require screen real estate; Desmos calculator integration works best on desktop; this is the "serious study" environment

### Phase 2 — Mobile Web App (iPhone-Optimized)

- **Target**: Responsive mobile web app optimized for iPhone screen sizes (375px-430px viewport)
- **Timeline**: 2-3 weeks after Phase 1
- **Scope**: All Phase 1 features adapted for mobile + mobile-specific additions (quick drill mode, push notifications via PWA, swipe-based interactions)
- **Why mobile second**: Quick 10-minute drill sessions, review wrong answer insights on the go, check streaks and stats between classes

---

## 3. Information Architecture

### Primary Navigation (Desktop)

```
Home (Dashboard)
├── Study Session (start adaptive practice)
├── Practice Test (timed full test simulation)
├── Wrong Answer Insights ★ (pattern recognition module)
├── My Progress (analytics & score tracking)
├── Review Queue (spaced repetition)
└── Settings (preferences, parent access)
```

### Primary Navigation (Mobile — Phase 2)

```
Bottom Tab Bar:
[Study] [Insights ★] [Progress] [Review]

Study tab → Quick Drill (10 questions) or Full Session
Insights tab → Wrong Answer Intelligence dashboard
Progress tab → Score trend, streaks, skill map
Review tab → Spaced repetition queue
```

---

## 4. Module 1: Adaptive Learning Engine

### 4.1 Skill Taxonomy

The SAT is organized into two sections, each with measurable sub-skills. The app tracks mastery at the sub-skill level.

**Reading & Writing Section:**

| Sub-Skill ID | Sub-Skill | SAT Domain |
|---|---|---|
| RW-01 | Central Ideas & Details | Information and Ideas |
| RW-02 | Command of Evidence (Textual) | Information and Ideas |
| RW-03 | Command of Evidence (Quantitative) | Information and Ideas |
| RW-04 | Inferences | Information and Ideas |
| RW-05 | Words in Context | Craft and Structure |
| RW-06 | Text Structure and Purpose | Craft and Structure |
| RW-07 | Cross-Text Connections | Craft and Structure |
| RW-08 | Rhetorical Synthesis | Craft and Structure |
| RW-09 | Transitions | Expression of Ideas |
| RW-10 | Boundaries (Sentences) | Standard English Conventions |
| RW-11 | Form, Structure, and Sense | Standard English Conventions |

**Math Section:**

| Sub-Skill ID | Sub-Skill | SAT Domain |
|---|---|---|
| M-01 | Linear Equations (one variable) | Algebra |
| M-02 | Linear Equations (two variables) | Algebra |
| M-03 | Linear Functions | Algebra |
| M-04 | Systems of Linear Equations | Algebra |
| M-05 | Linear Inequalities | Algebra |
| M-06 | Nonlinear Equations & Functions | Advanced Math |
| M-07 | Equivalent Expressions | Advanced Math |
| M-08 | Quadratics | Advanced Math |
| M-09 | Exponential Functions | Advanced Math |
| M-10 | Ratios, Rates, Proportions | Problem Solving & Data |
| M-11 | Percentages | Problem Solving & Data |
| M-12 | One-Variable Data (Statistics) | Problem Solving & Data |
| M-13 | Two-Variable Data (Scatterplots) | Problem Solving & Data |
| M-14 | Probability & Conditional Probability | Problem Solving & Data |
| M-15 | Inference from Sample Statistics | Problem Solving & Data |
| M-16 | Area and Volume | Geometry & Trig |
| M-17 | Lines, Angles, Triangles | Geometry & Trig |
| M-18 | Right Triangles & Trigonometry | Geometry & Trig |
| M-19 | Circles | Geometry & Trig |

### 4.2 Elo-Style Skill Rating

Each sub-skill has an independent rating:

- **Starting rating**: 1000 (unknown skill level)
- **Rating adjustment per question**: +/- 15-40 points depending on question difficulty vs. current rating
- **Confidence threshold**: After 5+ questions on a sub-skill, the rating is considered "calibrated"
- **Mastery levels**: Developing (<1100), Progressing (1100-1300), Proficient (1300-1500), Mastered (1500+)

### 4.3 Question Selection Algorithm

```
For each question to serve:
1. Identify the 3 lowest-rated sub-skills with calibrated ratings
2. Identify the 2 sub-skills most due for spaced repetition review
3. Weighted random selection: 50% lowest-rated, 30% spaced repetition, 20% random (exposure)
4. Within the chosen sub-skill, select a question at difficulty = current Elo ± 50
5. If the student is in "frustrated" state (see Module 5), bias toward Elo - 100 (easier)
```

### 4.4 Multi-Strategy Explanations

When a student answers incorrectly, Claude generates explanations using multiple approaches. The student can cycle through them with a "Try a different explanation" button.

**Math explanation strategies:**
1. Algebraic/procedural (step-by-step)
2. Visual/geometric (diagram or graph-based reasoning)
3. Plug-in/backsolve (work backward from answer choices)
4. Real-world analogy (connect to something concrete)

**Reading/Writing explanation strategies:**
1. Textual evidence walkthrough (point to specific lines)
2. Elimination reasoning (why each wrong answer fails)
3. Paraphrase method (restate the passage/question in simpler terms)
4. Pattern recognition (this is a classic "X type" question, here's how they always work)

### 4.5 Interactive Help Buttons

After answering a question, the explanation panel displays contextual help buttons that send pre-written prompts to Claude. Each button triggers a streamed response using the existing multi-turn conversation history — no separate API routes needed.

| Button Label | Prompt to Claude | Shown For |
|---|---|---|
| Strategy for this question | "What's the best strategy for this type of question? Walk me through a step-by-step method." | Math + RW |
| Break down the passage | "Break down the passage for me. What are the key points, structure, and author's main argument?" | RW only |
| Keywords to look for | "What key words or phrases in the question and answer choices should I focus on? What clues do they give?" | RW only |
| I'm stuck | "I'm completely stuck. Give me a strong hint without telling me the answer directly." | Math + RW |
| Help me eliminate wrong answers | "Help me eliminate wrong answers. Walk through each choice and explain why it's likely right or wrong." | Math + RW |

**Free-text prompt input**: Always visible below the explanation. The student can type any question about the current problem. Placeholder text starts as "Ask anything about this question..." and switches to "Enter your response..." once a multi-turn conversation is underway. Works in both Socratic and Direct modes.

All help button interactions and free-text messages maintain conversation history, so the dialogue builds naturally across multiple exchanges.

### 4.6 Socratic vs. Direct Mode

- **Default: Socratic Mode** ("Guide me") — Claude asks leading questions, gives hints, and guides the student to the answer. System prompt instructs Claude to never give the answer directly on the first attempt.
- **Student toggle: Direct Mode** ("Just tell me") — Claude gives a clear, concise explanation with the answer.
- Switching modes resets the conversation history and starts a fresh explanation.
- Both modes support the help buttons and free-text prompt described above.

---

## 5. Module 2: Practice & Test Simulation

### 5.1 Session Types

| Session Type | Duration | Description | Phase |
|---|---|---|---|
| Quick Drill | 10 min / 10 questions | Adaptive, single sub-skill focus | P1 + P2 |
| Study Session | 25-45 min | Adaptive, mixed sub-skills, with explanations | P1 + P2 |
| Timed Section | 32-35 min | Mimics one SAT section, timed, no hints | P1 + P2 |
| Full Practice Test | ~2 hrs 14 min | Complete SAT simulation (2 sections, adaptive modules) | P1 only* |

*Phase 2 will support Full Practice Test but with a recommendation to use desktop.

### 5.2 Digital SAT Simulation (Full Practice Test)

The digital SAT has an adaptive structure that must be replicated exactly:

**Reading & Writing:**
- Module 1: 27 questions, 32 minutes
- Module 2: 27 questions, 32 minutes (difficulty adapts based on Module 1 performance)

**Math:**
- Module 1: 22 questions, 35 minutes
- Module 2: 22 questions, 35 minutes (difficulty adapts based on Module 1 performance)

**Simulation features:**
- Countdown timer per module (with 5-minute warning)
- Question flagging for review
- Cross-out tool for answer elimination
- Reference sheet for math (formulas provided on real SAT)
- Desmos calculator embed (via Desmos API) for math sections
- 10-minute break between sections (enforced, like the real test)
- Annotation/highlighting toolbar for reading passages

### 5.3 Question Bank

**Primary source**: College Board's publicly released practice tests and questions (8 full practice tests + supplemental questions from Khan Academy/College Board partnership — all freely available). Uploaded via the Parent Dashboard PDF upload flow, which accepts 3 PDFs per test (questions, answers, explanations). PDF text is extracted client-side using pdfjs-dist, then parsed and classified by Claude via step-by-step API calls (`/api/parent/upload-questions/parse` → `/api/parent/upload-questions/classify` → `/api/parent/upload-questions/confirm`).

**Secondary source**: Claude-generated questions tagged as `[AI-Generated]` to supplement areas with thin coverage. These are generated using Opus 4.6 with few-shot examples of real SAT questions for style fidelity, then manually reviewed.

**Question metadata schema:**
```json
{
  "question_id": "q_00001",
  "source": "college_board_practice_1",
  "section": "math",
  "sub_skill_id": "M-08",
  "difficulty": 3,           // 1-5 scale mapped to SAT difficulty
  "passage_id": "p_00012",  // null for non-passage questions
  "answer_choices": ["A", "B", "C", "D"],
  "correct_answer": "C",
  "distractor_analysis": {
    "A": "sign_error",
    "B": "partial_solution",
    "D": "common_misconception_quadratic_formula"
  },
  "is_ai_generated": false,
  "tags": ["calculator_allowed", "grid_in_eligible"]
}
```

### 5.4 Pacing Analysis

During timed sessions, the app tracks time spent per question and provides post-session pacing feedback:

- Flag questions where time > 90 seconds (math) or > 75 seconds (reading/writing)
- Identify "time sinks" — questions the student spent too long on and still got wrong
- Provide SAT-specific strategy advice: "You spent 3 minutes on question 14 and got it wrong. On the real SAT, the optimal strategy is to flag it and move on after 90 seconds. The points you'd gain by spending that time on easier questions outweigh the chance of getting this one right."

---

## 6. Module 3: Wrong Answer Intelligence (Pattern Recognition) ★

This is the app's signature differentiator. No human tutor can do this at scale.

### 6.1 Activation Threshold

- **Minimum data required**: 10 wrong answers before any insights are generated
- **UI before threshold**: A card in the Insights tab showing: *"Wrong answer insights will be available after you answer at least X more questions incorrectly. Keep practicing — the AI is learning your patterns!"* with a progress bar (e.g., 6/10 wrong answers collected).
- **After threshold**: Insights are generated and continuously refined. More data = better insights.
- **Refresh frequency**: Insights are re-computed after every 5 new wrong answers or at the start of each new session.

### 6.2 Pattern Recognition Dimensions

The system analyzes wrong answers across 8 dimensions. Each dimension generates specific, actionable insights.

#### Dimension 1: Error Type Classification

Every wrong answer is classified by Claude into one of these error types:

| Error Type | Definition | Example |
|---|---|---|
| Conceptual Gap | Student doesn't understand the underlying concept | Doesn't know how to set up a system of equations |
| Procedural Error | Understands concept but makes a mistake in execution | Correct setup but arithmetic error in step 3 |
| Careless/Rush Error | Knew the material, went too fast | Misread "least" as "most," selected wrong sign |
| Misread/Comprehension | Misunderstood what the question asked | Solved for x when asked for 2x+1 |
| Trap Answer | Fell for a deliberately tempting wrong answer | Selected the "partial answer" that solves half the problem |
| Time Pressure | Ran out of time or rushed due to pacing | Guessed on last 5 questions of a timed section |
| Knowledge Gap | Missing a specific fact or formula | Didn't know the circle area formula |

**Implementation**: After each wrong answer, Claude is prompted:
```
The student answered [their answer] to this question: [question text]
The correct answer is [correct answer].
Classify this error into exactly one type: conceptual_gap, procedural_error, 
careless_rush, misread_comprehension, trap_answer, time_pressure, knowledge_gap.
Provide a 1-sentence explanation of why this classification fits.
Return as JSON.
```

**Insight generated**: "62% of your errors are Trap Answers — you're drawn to answer choices that are partially correct. Before selecting, check: does this answer fully address what the question asks, or just part of it?"

#### Dimension 2: Sub-Skill Clustering

Aggregate wrong answers by sub-skill and identify clusters:

- **Weak clusters**: Sub-skills where error rate > 40% over last 20 questions
- **Improving clusters**: Sub-skills where error rate has decreased by 15%+ over last 2 sessions
- **Stagnant clusters**: Sub-skills with consistent error rate (no improvement over 3+ sessions)

**Insight generated**: "Your biggest opportunity is in Systems of Linear Equations (M-04) — you've gotten 7 of your last 12 wrong. But your Quadratics (M-08) errors have dropped from 50% to 20% this week. The approach that worked for quadratics (visual/graphing strategy) might help with systems too."

#### Dimension 3: Distractor Analysis (Why This Wrong Answer?)

For each wrong answer, the app stores which specific answer choice was selected and the distractor type. Over time, patterns emerge in which types of wrong answers attract the student.

**Distractor types tracked:**
- Partial answer (solves part of the problem)
- Sign/direction error (right magnitude, wrong sign)
- Misapplied formula (used wrong formula correctly)
- Scope error (too broad or too narrow for reading questions)
- Sounds right (reading: answer that sounds sophisticated but isn't supported)
- Calculation of wrong variable (solved for the wrong thing)

**Insight generated**: "You have a strong pattern of selecting 'partial answers' — choices that solve the first step but not the whole problem. This has happened 8 times in math. Try this: after solving, re-read the question and ask 'did I answer exactly what they asked?'"

#### Dimension 4: Question Structure Vulnerability

Analyze whether the student struggles more with certain question formats, independent of topic:

- Word problems vs. pure computation (math)
- "Which choice best..." vs. "According to the passage..." (reading)
- "Must be true" vs. "Could be true" (logic)
- Grid-in/free response vs. multiple choice (math)
- Short passage vs. long passage (reading)
- Questions with "NOT" or "EXCEPT" (both sections)

**Insight generated**: "You get 85% of direct computation questions right but only 55% of word problems — even on the same math concepts. The issue isn't the math; it's translating words to equations. Let's practice 10 word-problem translations without solving them."

#### Dimension 5: Time-Based Patterns

Correlate wrong answers with timing data:

- Errors at the beginning vs. end of sessions (fatigue? warmup?)
- Errors on questions where time spent was < 30 seconds (rushing)
- Errors on questions where time spent was > 2 minutes (overthinking)
- Performance by time of day (if enough data)
- Performance decline rate during long sessions

**Insight generated**: "Your error rate jumps from 25% to 48% in the last 10 minutes of timed sections. You're either fatiguing or rushing. Try this: do a 30-second breathing reset when you hit the halfway point of each module."

#### Dimension 6: Cross-Topic Interaction Effects

Identify if struggling on one topic causes cascading failures on subsequent questions (tilt effect):

- After getting a hard question wrong, does error rate spike on the next 2-3 questions?
- After a streak of correct answers, does the student get overconfident on harder questions?
- Are there topic transitions that cause more errors (e.g., switching from algebra to geometry)?

**Insight generated**: "When you get a question wrong, there's a 65% chance you'll also get the next question wrong — compared to 30% baseline. This suggests frustration is carrying over. Try: when you get one wrong, take a 5-second pause and consciously reset before the next question."

#### Dimension 7: Reading Comprehension Sub-Patterns (RW Only)

For reading/writing questions specifically:

- Performance by passage type (literary fiction, social science, natural science, humanities)
- Performance by passage length
- Performance on questions requiring explicit evidence vs. inference
- Performance on paired passages vs. single passages
- Specific grammar rules frequently missed

**Insight generated**: "You ace natural science passages (90%) but struggle with literary fiction (55%). The fiction passages require reading for tone and implication rather than facts. Let's practice with 5 fiction passages this week focusing on author's tone."

#### Dimension 8: Confidence Calibration

If the app includes a confidence selector (see below), track calibration:

- When the student says "confident" — are they actually right?
- When they say "guessing" — are they actually wrong?
- Overconfidence ratio: high-confidence wrong answers / total high-confidence answers
- Underconfidence ratio: low-confidence right answers / total low-confidence answers

**UI feature**: Before submitting each answer, optional 3-point confidence selector: [Guessing] [Okay] [Confident]. Not required but highly encouraged.

**Insight generated**: "You're overconfident on grammar questions — you mark 'confident' 80% of the time but only get 60% right. On algebra, you're underconfident — you mark 'guessing' 40% of the time but actually get 75% right. Trust yourself more on algebra and slow down on grammar."

### 6.3 Insights UI

#### Insights Home Screen (Desktop)

```
┌─────────────────────────────────────────────────────┐
│  Wrong Answer Intelligence                    [i]   │
│  Based on 47 wrong answers across 12 sessions       │
│  Last updated: 2 hours ago                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🎯 TOP 3 INSIGHTS                                 │
│  ┌───────────────────────────────────────────────┐  │
│  │ 1. You fall for "partial answer" traps        │  │
│  │    62% of your math errors are trap answers    │  │
│  │    [Practice trap recognition →]               │  │
│  ├───────────────────────────────────────────────┤  │
│  │ 2. Post-error tilt is costing you ~30 points  │  │
│  │    65% error rate on questions after a miss    │  │
│  │    [Learn reset techniques →]                  │  │
│  ├───────────────────────────────────────────────┤  │
│  │ 3. Literary fiction passages are your weak spot│  │
│  │    55% accuracy vs. 85% on other passage types │  │
│  │    [Start a fiction passage drill →]           │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  📊 DEEP DIVE CATEGORIES                           │
│  [Error Types] [Topic Clusters] [Distractor Traps] │
│  [Question Format] [Timing Patterns] [Tilt Effect] │
│  [Reading Breakdown] [Confidence Calibration]       │
│                                                     │
│  📈 PATTERN TRENDS (are you improving?)            │
│  [chart: error type distribution over time]         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Insight Detail View

Each of the 8 dimensions has its own detail page with:

1. **Headline insight** — 1-2 sentence summary of the finding
2. **Evidence** — Specific questions that demonstrate the pattern, with links to review them
3. **Visualization** — Chart appropriate to the dimension (pie chart for error types, line chart for trends, heatmap for time-based patterns)
4. **AI recommendation** — Claude-generated specific practice plan to address this pattern
5. **Action button** — "Start a targeted drill on this pattern" which auto-generates a practice session focused on the weakness

#### Pre-Threshold State

Before 10 wrong answers are collected:

```
┌─────────────────────────────────────────────────────┐
│  Wrong Answer Intelligence                          │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │        🔍 Building Your Error Profile         │  │
│  │                                                │  │
│  │  The AI is collecting data on your mistakes    │  │
│  │  to find hidden patterns. Insights will be     │  │
│  │  available after 10 wrong answers.             │  │
│  │                                                │  │
│  │  ████████░░░░░░░░░░░░  6 / 10                │  │
│  │                                                │  │
│  │  Keep practicing — every wrong answer teaches  │  │
│  │  the AI more about how to help you.            │  │
│  │                                                │  │
│  │  [Start a practice session →]                  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 6.4 Pattern Recognition Implementation

**When it runs**: Pattern recognition is triggered:
1. After every 5 new wrong answers (batch update)
2. At the start of each new session (refresh with latest data)
3. On-demand when the student opens the Insights tab

**How it runs**: A background job sends the full wrong answer history to Claude Opus with a structured analysis prompt:

```
You are an expert SAT tutor and data analyst. Analyze the following wrong 
answer history for a student and identify the most important patterns.

WRONG ANSWER HISTORY:
[Array of wrong answer objects with: question text, student answer, correct 
answer, sub_skill, difficulty, time_spent, session_id, timestamp, 
confidence_level, error_type_from_previous_classification]

PREVIOUS INSIGHTS (to track what's changed):
[Previous insight set, if any]

Analyze across these 8 dimensions:
1. Error type distribution and trends
2. Sub-skill clustering (weak, improving, stagnant)
3. Distractor/wrong answer choice patterns
4. Question structure vulnerabilities
5. Time-based patterns
6. Cross-topic interaction effects (tilt)
7. Reading comprehension sub-patterns
8. Confidence calibration

For each dimension, provide:
- finding: 1-2 sentence insight
- evidence_question_ids: [list of question IDs that demonstrate this]
- severity: high/medium/low
- trend: improving/stagnant/worsening
- recommendation: specific practice action

Return the top 3 most impactful insights ranked by (severity × actionability).

Return as structured JSON.
```

---

## 7. Module 4: Analytics & Progress Dashboard

### 7.1 Student Dashboard

**Score Prediction Widget:**
- Predicted SAT score range (e.g., 1280-1340) updated after every session
- Score breakdown: predicted Reading/Writing + predicted Math
- Trend arrow: up/down/flat vs. last week

**Skill Map:**
- Visual grid of all sub-skills with color coding: red (developing), yellow (progressing), green (proficient), gold (mastered)
- Click any sub-skill to see: rating history, recent questions, error rate, time to next mastery level

**Session History:**
- Chronological list of all sessions with: date, duration, questions answered, accuracy, topics covered, AI-generated 3-sentence summary

**Streak & Consistency:**
- Current daily streak
- Calendar heatmap showing study days (GitHub-contribution-style)
- Weekly goal progress (e.g., "5 of 7 days this week")

### 7.2 Parent Dashboard

Accessible via a separate login or PIN-protected tab.

**Overview:**
- Predicted score + trend
- Total time studied this week/month
- Session frequency and consistency
- Top 3 current weaknesses (from Wrong Answer Intelligence)

**Detailed View:**
- Full access to all analytics the student sees
- Additional: error rate by topic over time (is tutoring working?)
- Alert system: flag if no study session in 3+ days, or if a sub-skill is regressing

### 7.3 Session Summaries

After each session, Claude generates:

```
**Session Summary — Feb 21, 2026 (32 min)**
Practiced 18 questions across algebra and reading comprehension. Math accuracy 
improved to 78% (up from 70% last session), with strong performance on linear 
equations. Reading inference questions remain challenging — recommend focusing 
next session on evidence-based reading strategies.
```

Stored in session history and accessible from the parent dashboard.

---

## 8. Module 5: Emotional Intelligence Layer

### 8.1 Frustration Detection

**Signals monitored:**
- 3+ consecutive wrong answers
- Decreasing time per question (rushing in frustration)
- Increasing time per question (shutting down)
- Short or terse responses in Socratic mode ("idk", "whatever", "just tell me")
- Repeated requests to skip questions

**Response protocol when frustration detected:**

```
System prompt injection:
"The student appears frustrated (signal: [specific signal]). 
Do the following:
1. Acknowledge without being patronizing — don't say 'I can see you're frustrated'
2. Normalize the difficulty — 'This is one of the hardest question types on the SAT'
3. Offer a choice: easier topic, different explanation, or short break
4. If they continue, switch to their strongest sub-skill for 2-3 questions (confidence boost)
Keep tone casual and peer-like, not teacher-like."
```

### 8.2 Growth Mindset Framing

Baked into all system prompts:

- Never say "wrong" — say "not quite" or "close, but..."
- Always identify what the student did right before addressing the error
- Frame mistakes as data: "Great — now the AI knows exactly what to work on with you"
- Celebrate improvement over absolute performance: "You've gone from 40% to 70% on quadratics in two weeks"

### 8.3 Session Energy Management

Automatic session structure:

```
Session start (0-5 min):  Medium difficulty — warm up
Early session (5-15 min):  Ramp to challenging — peak learning zone
Mid session (15-25 min):   Hardest questions — push the edge
Late session (25-35 min):  Gradual ease-off — consolidation
Session end (last 3 min):  2-3 questions at comfortable level — end on a win
```

---

## 9. Module 6: Engagement & Gamification

### 9.1 Daily Streak

- Track consecutive days with at least 1 completed session (minimum 10 questions)
- Visual streak counter on dashboard
- Milestone celebrations at 7, 14, 30, 60, 90 days

### 9.2 Micro-Goals

Weekly auto-generated goals based on current performance:

- "Master 2 new sub-skills this week"
- "Complete 3 timed drills"
- "Reduce careless errors by 20%"
- "Hit 80% accuracy on systems of equations"

### 9.3 Skill Tree Visualization

Visual representation of all sub-skills as an unlockable tree:
- Locked skills (not yet attempted)
- In progress (attempted, below mastery)
- Mastered (gold, with date of mastery)
- Connected lines showing prerequisite relationships (e.g., linear equations → systems of equations)

### 9.4 Spaced Repetition Queue

**Algorithm**: Modified SM-2
- Wrong answer → review in 1 day
- Correct on first review → review in 3 days
- Correct on second review → review in 7 days
- Correct on third review → review in 21 days
- Wrong on any review → reset to 1 day

**UI**: "Review Queue" section showing count of questions due today with a "Start Review" button.

---

## 10. Claude API Architecture

### 10.1 Model Selection Strategy

| Use Case | Model | Rationale |
|---|---|---|
| Question explanation (Socratic) | Sonnet 4.6 | Fast, cheap, good conversational quality |
| Question explanation (Direct) | Sonnet 4.6 | Speed matters for "just tell me" mode |
| Help button responses | Sonnet 4.6 | Same streaming pipeline as explanations |
| Wrong answer error classification | Sonnet 4.6 | Structured output, high throughput |
| Pattern recognition analysis | Opus 4.6 | Complex multi-dimensional analysis needs best reasoning |
| Session summary generation | Sonnet 4.6 | Simple summarization task |
| AI-generated questions | Opus 4.6 | Fidelity to SAT style requires best model |
| Strategy coaching | Sonnet 4.6 | Conversational, doesn't need deep reasoning |
| Score prediction model | Opus 4.6 | Statistical reasoning |
| PDF question parsing | Sonnet 4.6 | Extract structured data from College Board PDFs |
| Question classification | Sonnet 4.6 | Sub-skill and difficulty assignment |

### 10.2 System Prompt Library

The app maintains distinct system prompts loaded per mode:

**`tutor_socratic`** — Default tutoring mode
```
You are an expert SAT tutor helping a 16-year-old student. Your approach:
- Never give the answer directly. Ask guiding questions.
- Give one hint at a time. Wait for the student's response.
- If the student is stuck after 3 hints, offer to explain directly.
- Use language appropriate for a smart teenager — casual but precise.
- Reference the specific SAT sub-skill being tested.
- When possible, teach the underlying strategy, not just the specific question.
- Never say "wrong" — say "not quite" or "close, but..."
- Always identify what the student did right before addressing the error.
- Frame mistakes as data: "Great — now we know exactly what to work on."
- If the student asks about strategy, passage breakdown, keywords, elimination,
  or says they're stuck — respond helpfully to that specific request while
  keeping an encouraging tone. Stay focused on the current question.

Student profile (injected dynamically):
{student_profile_json}

Current question context:
{question_json}
```

**`tutor_direct`** — Direct explanation mode
```
You are an expert SAT tutor. The student wants a clear, direct explanation.
- Explain the correct answer in 2-3 sentences.
- Then explain why the student's chosen answer was wrong in 1-2 sentences.
- Offer one alternative approach they could try next time.
- Keep it concise — no more than 150 words total.
- Use the explanation strategy most appropriate for this student's learning style.

Student profile: {student_profile_json}
Question: {question_json}
Student's answer: {student_answer}
```

**`error_classifier`** — Wrong answer classification
```
Classify this wrong answer into exactly one error type. Return JSON only.

Error types: conceptual_gap, procedural_error, careless_rush, 
misread_comprehension, trap_answer, time_pressure, knowledge_gap

Question: {question_json}
Correct answer: {correct_answer}
Student answer: {student_answer}
Time spent: {time_seconds}s
Student confidence: {confidence_level}

Return:
{
  "error_type": "...",
  "explanation": "1 sentence explaining why this classification",
  "distractor_type": "partial_answer | sign_error | misapplied_formula | 
                      scope_error | sounds_right | wrong_variable | other",
  "what_student_likely_thought": "1 sentence on the student's probable reasoning"
}
```

**`pattern_analyzer`** — Full pattern recognition (Opus)
```
[See Section 6.4 for the full prompt]
```

**`strategy_coach`** — Meta-strategy advice
```
You are an SAT strategy coach. You don't teach content — you teach test-taking 
strategy: time management, guessing strategy, section pacing, mental state 
management, question triage (which to skip, which to prioritize).

The student's analytics:
{analytics_json}

Their biggest strategy issues:
{strategy_issues}

Give specific, actionable advice. Reference their actual data.
```

### 10.3 Context Injection Schema

Before every Claude API call, the app injects a compressed student profile:

```json
{
  "student_id": "oren_001",
  "session_number": 23,
  "current_predicted_score": { "total": 1310, "rw": 660, "math": 650 },
  "skill_ratings": {
    "M-04": { "elo": 1050, "trend": "improving", "calibrated": true },
    "RW-04": { "elo": 980, "trend": "stagnant", "calibrated": true }
  },
  "top_3_weaknesses": ["M-04", "RW-04", "M-08"],
  "recent_wrong_answers": [
    {
      "question_id": "q_00234",
      "error_type": "trap_answer",
      "sub_skill": "M-04",
      "time_spent_seconds": 95,
      "confidence": "confident"
    }
  ],
  "session_state": {
    "questions_answered": 12,
    "accuracy_this_session": 0.67,
    "current_mood_signal": "neutral",
    "consecutive_wrong": 0,
    "time_in_session_minutes": 18
  },
  "learning_preferences": {
    "preferred_explanation_style": "visual",
    "socratic_mode": true
  }
}
```

### 10.4 Prompt Caching & Cost Optimization

- **Cache system prompts**: System prompts + question bank metadata are static — use Claude's prompt caching to avoid re-sending on every turn.
- **Batch error classification**: After a session ends, batch all wrong answers into a single classification call rather than one per question.
- **Streaming for explanations**: Use streaming responses for tutoring interactions to reduce perceived latency.
- **Sonnet 4.6 for 90% of calls**: Reserve Opus 4.6 for pattern analysis (runs async, not blocking the student) and question generation (offline batch job).

---

## 11. Data Model

### 11.1 Supabase Tables

```sql
-- Student profile
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  parent_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'
);

-- Skill ratings (one row per sub-skill per student)
CREATE TABLE skill_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  sub_skill_id TEXT NOT NULL,
  elo_rating INTEGER DEFAULT 1000,
  questions_attempted INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  is_calibrated BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, sub_skill_id)
);

-- Questions bank
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL,
  section TEXT NOT NULL,
  sub_skill_id TEXT NOT NULL,
  difficulty INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  passage_id TEXT,
  answer_choices JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  distractor_analysis JSONB,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}'
);

-- Session log
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  session_type TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  questions_answered INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  accuracy FLOAT,
  summary TEXT,
  mood_signals JSONB DEFAULT '[]',
  sub_skills_practiced TEXT[] DEFAULT '{}',
  sub_skill_focus TEXT,              -- which skill a quick_drill targets
  metadata JSONB DEFAULT '{}'        -- flexible extra session config
);

-- Individual question attempts (core analytics table)
CREATE TABLE question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  session_id UUID REFERENCES sessions(id),
  question_id TEXT REFERENCES questions(question_id),
  student_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent_seconds INTEGER,
  confidence_level TEXT,
  error_type TEXT,
  distractor_type TEXT,
  error_explanation TEXT,
  explanation_strategy_used TEXT,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spaced repetition queue
CREATE TABLE review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  question_id TEXT REFERENCES questions(question_id),
  next_review_date DATE NOT NULL,
  review_count INTEGER DEFAULT 0,
  last_review_result BOOLEAN,
  interval_days INTEGER DEFAULT 1
);

-- Pattern recognition insights (generated by Opus)
CREATE TABLE wrong_answer_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  total_wrong_answers_analyzed INTEGER,
  top_insights JSONB NOT NULL,
  dimension_details JSONB NOT NULL,
  raw_analysis TEXT
);

-- Score predictions
CREATE TABLE score_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  total_score_low INTEGER,
  total_score_mid INTEGER,
  total_score_high INTEGER,
  rw_score INTEGER,
  math_score INTEGER,
  confidence FLOAT
);

-- Daily streak tracking
CREATE TABLE daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  activity_date DATE NOT NULL,
  questions_answered INTEGER DEFAULT 0,
  streak_qualifying BOOLEAN DEFAULT FALSE,
  UNIQUE(student_id, activity_date)
);
```

---

## 12. Technical Architecture

### 12.1 Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js 14+ (App Router) | SSR for dashboard, client components for interactive practice; single codebase for desktop + mobile |
| Styling | Tailwind CSS | Rapid responsive design, easy desktop → mobile adaptation |
| UI Components | shadcn/ui | Clean, accessible component library |
| Backend | Next.js API Routes + Server Actions | No separate backend needed for Phase 1 |
| Database | Supabase (PostgreSQL) | Auth, realtime subscriptions, row-level security for parent/student views |
| Auth | Supabase Auth | Email/password for student + parent accounts |
| AI | Claude API (Anthropic SDK) | Sonnet 4.6 for tutoring, Opus 4.6 for analysis |
| Calculator | Desmos API (embed) | Faithful reproduction of SAT calculator |
| Charts | Recharts or Chart.js | Dashboard visualizations |
| Hosting | Vercel | Zero-config Next.js deployment |

### 12.2 Key Architecture Decisions

**Server-side Claude calls**: All Claude API calls go through Next.js API routes (server-side) to keep the API key secure. The frontend never calls Claude directly.

**Streaming for tutoring**: Use the Anthropic SDK's streaming mode for Socratic/Direct explanation calls so the student sees text appear in real-time (reduces perceived latency).

**Async pattern analysis**: Pattern recognition (Opus) runs as a background job — not triggered during active study sessions. Results are pre-computed and cached in the `wrong_answer_insights` table.

**Offline question bank**: All questions are stored in Supabase, not fetched from Claude at runtime. Claude is only used for explanations and analysis, not for serving questions.

### 12.3 Directory Structure

```
sat-tutor-pro/
├── app/
│   ├── layout.tsx                 # Root layout with nav
│   ├── page.tsx                   # Dashboard home
│   ├── study/
│   │   ├── page.tsx               # Study session (adaptive practice)
│   │   └── [session_id]/page.tsx  # Active session view
│   ├── practice-test/
│   │   ├── page.tsx               # Test selection
│   │   └── [test_id]/page.tsx     # Active test view
│   ├── insights/
│   │   ├── page.tsx               # Wrong Answer Intelligence home
│   │   └── [dimension]/page.tsx   # Deep dive per dimension
│   ├── progress/
│   │   ├── page.tsx               # Analytics dashboard
│   │   └── skills/page.tsx        # Skill map view
│   ├── review/
│   │   └── page.tsx               # Spaced repetition queue
│   ├── parent/
│   │   └── page.tsx               # Parent dashboard (PIN-protected)
│   └── api/
│       ├── claude/
│       │   ├── explain/route.ts       # Tutoring explanations
│       │   ├── classify-error/route.ts # Error classification
│       │   ├── analyze-patterns/route.ts # Pattern recognition (Opus)
│       │   ├── session-summary/route.ts  # Session summaries
│       │   └── predict-score/route.ts    # Score prediction
│       ├── questions/route.ts          # Question serving logic
│       ├── sessions/route.ts           # Session CRUD
│       ├── parent/
│       │   └── upload-questions/
│       │       ├── parse/route.ts     # Parse one PDF type with Claude
│       │       ├── classify/route.ts  # Classify one batch of questions
│       │       └── confirm/route.ts   # Insert confirmed questions to DB
│       └── review/route.ts             # Spaced repetition logic
├── components/
│   ├── question-card.tsx          # Question display + answer input
│   ├── explanation-panel.tsx      # Claude explanation with help buttons, free-text prompt, strategy toggle
│   ├── question-uploader.tsx     # PDF upload flow (parent dashboard) with client-side orchestration
│   ├── timer.tsx                  # Countdown timer for timed modes
│   ├── confidence-selector.tsx    # [Guessing] [Okay] [Confident]
│   ├── skill-map.tsx              # Visual skill grid
│   ├── insight-card.tsx           # Single insight display
│   ├── progress-chart.tsx         # Score trend chart
│   ├── streak-counter.tsx         # Daily streak display
│   ├── desmos-embed.tsx           # Desmos calculator wrapper
│   └── annotation-toolbar.tsx     # Reading passage tools
├── lib/
│   ├── claude.ts                  # Anthropic SDK wrapper (Sonnet 4.6 + Opus 4.6)
│   ├── pdf-extract-client.ts      # Client-side PDF text extraction (pdfjs-dist)
│   ├── pdf-question-parser.ts     # Claude-based PDF parsing, matching, classification
│   ├── question-selector.ts       # Adaptive question selection algorithm
│   ├── elo.ts                     # Elo rating calculations
│   ├── spaced-repetition.ts       # SM-2 algorithm
│   ├── frustration-detector.ts    # Mood signal analysis
│   ├── score-predictor.ts         # Score prediction model
│   └── supabase.ts                # Supabase client
├── prompts/
│   ├── tutor-socratic.md          # Socratic mode system prompt
│   ├── tutor-direct.md            # Direct mode system prompt
│   ├── error-classifier.md        # Error classification prompt
│   ├── pattern-analyzer.md        # Pattern recognition prompt (Opus)
│   ├── strategy-coach.md          # Strategy coaching prompt
│   └── session-summary.md         # Summary generation prompt
├── data/
│   └── questions/                 # Question bank seed data (JSON)
└── supabase/
    └── migrations/                # Database schema migrations
```

---

## 13. Phase 1 Scope (Desktop Web)

### 13.1 What's In

All 6 modules with full functionality:

- Adaptive Learning Engine with Elo ratings and multi-strategy explanations
- All session types including Full Practice Test with Desmos and annotation tools
- Wrong Answer Intelligence with all 8 dimensions and full Insights UI
- Analytics dashboard with score prediction, skill map, session history
- Emotional intelligence (frustration detection, growth mindset, energy management)
- Gamification (streaks, micro-goals, skill tree, spaced repetition)
- Parent dashboard (separate login)
- Desktop-optimized layout (1024px+ viewport)

### 13.2 What's Out (Phase 1)

- Mobile-responsive layout (functional on mobile but not optimized)
- Push notifications
- Quick Drill mode (mobile-specific)
- Swipe gestures
- Offline support / PWA

### 13.3 Phase 1 Milestones

| Week | Milestone |
|---|---|
| Week 1 | Project setup, Supabase schema, question bank seed, Claude API integration (basic explain endpoint) |
| Week 2 | Question serving + adaptive algorithm, study session flow, Elo system |
| Week 3 | Wrong answer classification, Insights module (pre-threshold + post-threshold UI), pattern analysis pipeline |
| Week 4 | Practice test simulator (timed sections, Desmos, annotation), pacing analysis |
| Week 5 | Dashboard, score prediction, skill map, session summaries, spaced repetition |
| Week 6 | Parent dashboard, frustration detection, gamification, polish, testing |

---

## 14. Phase 2 Scope (Mobile Web)

### 14.1 Responsive Strategy

The app uses a single Next.js codebase with Tailwind responsive breakpoints:

- **Desktop**: `lg:` and above (1024px+) — full layout from Phase 1
- **Tablet**: `md:` (768px-1023px) — slightly compressed layout
- **Mobile**: Default / `sm:` (375px-430px, iPhone-optimized) — completely reworked layout

### 14.2 Mobile-Specific Adaptations

**Navigation**: Replace sidebar with bottom tab bar (4 tabs: Study, Insights, Progress, Review)

**Study Session (Mobile):**
- Question card takes full viewport width
- Answer choices are large tap targets (minimum 48px height)
- Explanation panel slides up from bottom (bottom sheet)
- Socratic chat interface mimics iMessage-style bubbles
- "Just tell me" is a single tap button, not a toggle

**Quick Drill Mode (Mobile-Only):**
- Optimized for 5-10 minute sessions
- Single sub-skill focus
- Minimal chrome — just question, answers, and next
- Swipe right = next question, swipe left = flag for review
- Summary card at the end (not a full summary page)

**Insights (Mobile):**
- Top 3 insights shown as swipeable cards
- Deep dive dimensions accessible via expandable accordion
- Charts adapted for small screens (no horizontal scrolling)
- "Start a drill on this" button prominent on each insight card

**Practice Test (Mobile):**
- Supported but with a banner: "For the best experience, use a desktop for full practice tests"
- Reading passages use expandable/collapsible sections
- No Desmos embed on mobile (link to Desmos app instead)
- Timer compact in header bar

**Progress (Mobile):**
- Score prediction front and center
- Skill map uses compact grid (tap to expand)
- Calendar heatmap scrolls horizontally
- Session history as a scrollable list

### 14.3 Mobile-Specific Features

**PWA (Progressive Web App):**
- Add to home screen support
- Push notifications for: daily streak reminders, review queue due, weekly progress report
- Splash screen with app branding

**Haptic Feedback:**
- Subtle vibration on correct/incorrect answer (via Haptic API)

**Dark Mode:**
- Auto-detect system preference
- Toggle in settings
- Important for late-night study sessions

### 14.4 Phase 2 Milestones

| Week | Milestone |
|---|---|
| Week 1 | Mobile layout system, bottom nav, responsive question card, touch-optimized answer selection |
| Week 2 | Quick Drill mode, mobile Insights cards, PWA setup with push notifications |
| Week 3 | Mobile practice test adaptations, dark mode, polish, cross-device testing |

---

## 15. Cost Estimates

### 15.1 Claude API Costs (per month, estimated)

Assuming 5 sessions/week, ~20 questions/session:

| Call Type | Model | Calls/Month | Est. Cost |
|---|---|---|---|
| Tutoring explanations + help buttons | Sonnet 4.6 | ~400 | $8-15 |
| Error classification | Sonnet 4.6 | ~150 (batched) | $2-4 |
| Pattern analysis | Opus 4.6 | ~20 | $5-10 |
| Session summaries | Sonnet 4.6 | ~20 | $1-2 |
| Score predictions | Opus 4.6 | ~4 | $1-2 |
| Strategy coaching | Sonnet 4.6 | ~10 | $1-2 |
| PDF parsing & classification | Sonnet 4.6 | ~5 (per upload) | $1-3 |
| **Total** | | | **~$20-40/month** |

For comparison: a human SAT tutor at 2 hrs/week × $150/hr = $1,200/month.

### 15.2 Infrastructure Costs

| Service | Tier | Est. Cost/Month |
|---|---|---|
| Vercel | Pro | $20 |
| Supabase | Free tier (to start) | $0 |
| Desmos API | Free | $0 |
| Domain | Annual | ~$12/year |
| **Total** | | **~$20/month** |

### 15.3 Total Cost of Ownership

**Phase 1 build**: ~$0 (Claude Code + your time)
**Monthly operating cost**: ~$40-55/month
**Annual cost**: ~$500-650/year vs. ~$14,400/year for a human tutor

---

## Appendix A: SAT Score Ranges for Context

| Score Range | Percentile | Interpretation |
|---|---|---|
| 1550-1600 | 99th+ | Competitive for Ivy League |
| 1450-1540 | 95th-99th | Competitive for top-25 schools |
| 1350-1440 | 90th-95th | Strong score, competitive for top-50 |
| 1200-1340 | 75th-89th | Above average |
| 1000-1190 | 40th-74th | Average range |

## Appendix B: Key Resources

- [College Board Digital SAT Practice](https://satsuite.collegeboard.org/digital/digital-practice-preparation) — Official practice tests
- [Desmos API Documentation](https://www.desmos.com/api) — Calculator embed
- [Anthropic Claude API Docs](https://docs.anthropic.com) — API reference
- [Supabase Documentation](https://supabase.com/docs) — Database & auth
- [Next.js Documentation](https://nextjs.org/docs) — Framework reference
