-- Question feedback: thumbs-down on questions and explanations
CREATE TABLE question_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id TEXT REFERENCES questions(question_id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bad_question', 'bad_explanation')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_question_feedback_question ON question_feedback(question_id);
CREATE INDEX idx_question_feedback_student ON question_feedback(student_id);
CREATE INDEX idx_question_feedback_type ON question_feedback(feedback_type);

ALTER TABLE question_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on question_feedback" ON question_feedback FOR ALL USING (true) WITH CHECK (true);
