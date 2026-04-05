-- Migration 008: Diagnostic questions table
--
-- Stores the 10 fixed questions used for the new-user onboarding diagnostic.
-- One row per question slot; question_id references the questions table.
-- display_order (1–10) determines the order shown to the student.
-- section groups Math (1–5) and R&W (6–10) slots for display logic.

CREATE TABLE diagnostic_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   TEXT NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL CHECK (display_order BETWEEN 1 AND 10),
  section       TEXT NOT NULL CHECK (section IN ('math', 'reading_writing')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (question_id),
  UNIQUE (display_order)
);

-- RLS: read-only for authenticated users; no student writes needed
ALTER TABLE diagnostic_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diagnostic_questions_select"
  ON diagnostic_questions FOR SELECT
  USING (true);

-- Seed the 10 selected diagnostic questions
-- Replacements made v2: slots 1, 3, 4, 5 swapped for clean MC questions
INSERT INTO diagnostic_questions (question_id, display_order, section) VALUES
  ('q_m01_002',                1,  'math'),            -- M-01 Linear Equations (1 var), diff 3, seed_data  [was q_pt_11_1772437672358_kz6: corrupted equation text]
  ('q_m08_002',                2,  'math'),            -- M-08 Quadratics, diff 4, seed_data
  ('q_m11_004',                3,  'math'),            -- M-11 Percentages, diff 3, seed_data  [was q_pt_8_1772437051105_ee1: grid-in]
  ('q_pt_9_1772437254767_0no', 4,  'math'),            -- M-18 Right Triangles & Trig, diff 2, pt_9  [was q_pt_5_1772436424291_5lt: grid-in M-17]
  ('q_m04_001',                5,  'math'),            -- M-04 Systems of Linear Equations, diff 3, seed_data  [was q_pt_4_1772436228229_llr: missing context]
  ('q_rw03_002',               6,  'reading_writing'), -- RW-03 Command of Evidence (Quantitative), diff 3, seed_data
  ('q_rw07_005',               7,  'reading_writing'), -- RW-07 Cross-Text Connections, diff 4, seed_data
  ('q_rw09_001',               8,  'reading_writing'), -- RW-09 Transitions, diff 2, seed_data
  ('q_rw11_002',               9,  'reading_writing'), -- RW-11 Form, Structure, and Sense, diff 3, seed_data
  ('q_rw05_005',               10, 'reading_writing')  -- RW-05 Words in Context, diff 4, seed_data
;
