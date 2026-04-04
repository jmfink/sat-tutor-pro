-- Migration 005: Enable auth.uid()-based RLS policies
-- Run this after deploying auth to replace the permissive dev policies

-- ============================================================
-- Helper: revoke permissive policies from migration 003
-- ============================================================

-- sessions
DROP POLICY IF EXISTS "Students can manage own sessions" ON sessions;
DROP POLICY IF EXISTS "Allow all" ON sessions;

-- question_attempts
DROP POLICY IF EXISTS "Students can manage own attempts" ON question_attempts;
DROP POLICY IF EXISTS "Allow all" ON question_attempts;

-- skill_ratings
DROP POLICY IF EXISTS "Students can manage own ratings" ON skill_ratings;
DROP POLICY IF EXISTS "Allow all" ON skill_ratings;

-- review_queue
DROP POLICY IF EXISTS "Students can manage own review" ON review_queue;
DROP POLICY IF EXISTS "Allow all" ON review_queue;

-- daily_activity
DROP POLICY IF EXISTS "Students can manage own activity" ON daily_activity;
DROP POLICY IF EXISTS "Allow all" ON daily_activity;

-- students
DROP POLICY IF EXISTS "Students can manage own record" ON students;
DROP POLICY IF EXISTS "Allow all" ON students;

-- score_predictions
DROP POLICY IF EXISTS "Students can manage own predictions" ON score_predictions;
DROP POLICY IF EXISTS "Allow all" ON score_predictions;

-- question_feedback
DROP POLICY IF EXISTS "Students can submit feedback" ON question_feedback;
DROP POLICY IF EXISTS "Allow all" ON question_feedback;

-- ============================================================
-- Enable RLS on all student-facing tables (idempotent)
-- ============================================================

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_feedback ENABLE ROW LEVEL SECURITY;

-- questions and passages: readable by all authenticated users
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE passages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Students table
-- ============================================================
CREATE POLICY "student_own" ON students
  FOR ALL USING (auth.uid() = id);

-- ============================================================
-- Sessions
-- ============================================================
CREATE POLICY "sessions_own" ON sessions
  FOR ALL USING (auth.uid() = student_id);

-- ============================================================
-- Question attempts
-- ============================================================
CREATE POLICY "attempts_own" ON question_attempts
  FOR ALL USING (auth.uid() = student_id);

-- ============================================================
-- Skill ratings
-- ============================================================
CREATE POLICY "ratings_own" ON skill_ratings
  FOR ALL USING (auth.uid() = student_id);

-- ============================================================
-- Review queue
-- ============================================================
CREATE POLICY "review_own" ON review_queue
  FOR ALL USING (auth.uid() = student_id);

-- ============================================================
-- Daily activity
-- ============================================================
CREATE POLICY "activity_own" ON daily_activity
  FOR ALL USING (auth.uid() = student_id);

-- ============================================================
-- Score predictions
-- ============================================================
CREATE POLICY "predictions_own" ON score_predictions
  FOR ALL USING (auth.uid() = student_id);

-- ============================================================
-- Question feedback
-- ============================================================
CREATE POLICY "feedback_own" ON question_feedback
  FOR ALL USING (auth.uid() = student_id);

-- ============================================================
-- Questions — readable by all authenticated users
-- ============================================================
CREATE POLICY "questions_authenticated_read" ON questions
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- Passages — readable by all authenticated users
-- ============================================================
CREATE POLICY "passages_authenticated_read" ON passages
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- INSTRUCTIONS FOR EXISTING USERS (ethan_001, jason_001)
-- ============================================================
-- After creating auth accounts for ethan and jason in the Supabase dashboard:
-- 1. Go to Authentication > Users and create their accounts
-- 2. Copy their auth UUIDs
-- 3. Run this SQL to migrate their data to the new UUIDs:
--
-- BEGIN;
-- -- Replace <ETHAN_AUTH_UUID> and <JASON_AUTH_UUID> with real values
-- UPDATE students SET id = '<ETHAN_AUTH_UUID>' WHERE id = '00000000-0000-0000-0000-000000000001';
-- UPDATE sessions SET student_id = '<ETHAN_AUTH_UUID>' WHERE student_id = '00000000-0000-0000-0000-000000000001';
-- UPDATE question_attempts SET student_id = '<ETHAN_AUTH_UUID>' WHERE student_id = '00000000-0000-0000-0000-000000000001';
-- UPDATE skill_ratings SET student_id = '<ETHAN_AUTH_UUID>' WHERE student_id = '00000000-0000-0000-0000-000000000001';
-- UPDATE review_queue SET student_id = '<ETHAN_AUTH_UUID>' WHERE student_id = '00000000-0000-0000-0000-000000000001';
-- UPDATE daily_activity SET student_id = '<ETHAN_AUTH_UUID>' WHERE student_id = '00000000-0000-0000-0000-000000000001';
-- UPDATE score_predictions SET student_id = '<ETHAN_AUTH_UUID>' WHERE student_id = '00000000-0000-0000-0000-000000000001';
-- -- Repeat for jason_001 (00000000-0000-0000-0000-000000000002)
-- COMMIT;
