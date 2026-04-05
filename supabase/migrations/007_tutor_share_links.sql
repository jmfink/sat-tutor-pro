-- Migration 007: Tutor Share Links
-- Stores unique, expiring report links that students can share with their tutors.

CREATE TABLE tutor_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'base64url'),
  tutor_name TEXT,
  tutor_contact TEXT,           -- phone number or email
  contact_type TEXT,            -- 'sms' | 'whatsapp' | 'email' | 'link'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  last_sent_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0
);

CREATE INDEX idx_tutor_share_links_token ON tutor_share_links(token);
CREATE INDEX idx_tutor_share_links_student ON tutor_share_links(student_id);
