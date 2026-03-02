-- Migration: add has_formatting_issues flag to questions
-- Apply via Supabase SQL Editor:
--   https://supabase.com/dashboard/project/puypljwcbplretqtexlj/sql

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS has_formatting_issues BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: fast lookup of all clean questions (the common case)
CREATE INDEX IF NOT EXISTS idx_questions_no_formatting_issues
  ON questions (sub_skill_id)
  WHERE has_formatting_issues = FALSE;

-- Auto-flag existing questions with obvious corruption patterns:
--
--   1. Caret-exponent notation: x^2, a^n — PDF superscript extraction failure
--   2. Unicode replacement character (U+FFFD) — encoding failure
--   3. Common UTF-8 mojibake sequences — Latin-1 / UTF-8 mismatch
--   4. Unprocessed LaTeX remnants: \frac, \sqrt, \left — parser artefacts
UPDATE questions
SET has_formatting_issues = TRUE
WHERE has_formatting_issues = FALSE
  AND (
    question_text LIKE '%^%'
    OR question_text LIKE '%' || chr(65533) || '%'
    OR question_text LIKE '%â€%'
    OR question_text LIKE '%Ã©%'
    OR question_text LIKE '%Ã¢%'
    OR question_text LIKE '%\frac%'
    OR question_text LIKE '%\sqrt%'
    OR question_text LIKE '%\left%'
  );

-- Report how many were flagged:
-- SELECT COUNT(*) AS flagged FROM questions WHERE has_formatting_issues = TRUE;
