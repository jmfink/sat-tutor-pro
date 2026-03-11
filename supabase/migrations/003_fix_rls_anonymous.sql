-- Fix RLS policies for anonymous/demo student model.
-- The app uses a hardcoded demo student UUID with no Supabase Auth login flow.
-- auth.uid()-based policies block all access from anonymous sessions.
-- Replace with permissive policies; all API routes use the service role key server-side.

-- Drop existing auth.uid()-based policies
DROP POLICY IF EXISTS "Students can view own data" ON students;
DROP POLICY IF EXISTS "Students can update own data" ON students;
DROP POLICY IF EXISTS "Students can view own skill ratings" ON skill_ratings;
DROP POLICY IF EXISTS "Students can view own sessions" ON sessions;
DROP POLICY IF EXISTS "Students can view own attempts" ON question_attempts;
DROP POLICY IF EXISTS "Students can view own review queue" ON review_queue;
DROP POLICY IF EXISTS "Students can view own insights" ON wrong_answer_insights;
DROP POLICY IF EXISTS "Students can view own predictions" ON score_predictions;
DROP POLICY IF EXISTS "Students can view own activity" ON daily_activity;
DROP POLICY IF EXISTS "Students can view own goals" ON weekly_goals;

-- Replace with permissive policies (service role bypasses RLS entirely; anon key needs these)
CREATE POLICY "Allow all on students" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on skill_ratings" ON skill_ratings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on question_attempts" ON question_attempts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on review_queue" ON review_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on wrong_answer_insights" ON wrong_answer_insights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on score_predictions" ON score_predictions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on daily_activity" ON daily_activity FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on weekly_goals" ON weekly_goals FOR ALL USING (true) WITH CHECK (true);
