-- Migration 006: Auto-create student record on Supabase Auth signup
--
-- A SECURITY DEFINER trigger fires after every INSERT on auth.users.
-- It runs as the postgres superuser, bypassing RLS, so it always succeeds
-- regardless of whether the new session cookie has propagated to the client.
--
-- The student name is read from raw_user_meta_data->>'name' (passed via
-- supabase.auth.signUp options.data). Falls back to the portion of the email
-- before '@' if no name was provided.
--
-- ON CONFLICT DO UPDATE ensures re-runs are idempotent and correctly update
-- name/email if the row already exists (e.g. from a legacy seed record).

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.students (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
    SET name  = COALESCE(
                  NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
                  SPLIT_PART(NEW.email, '@', 1)
                ),
        email = NEW.email;
  RETURN NEW;
END;
$$;

-- Drop the trigger if it already exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- Cleanup SQL (run manually in Supabase SQL editor)
-- Deletes test/junk student records, keeping only the two
-- legacy seed records (ethan_001 and jason_001).
-- ============================================================
--
-- DELETE FROM students
-- WHERE id NOT IN (
--   '00000000-0000-0000-0000-000000000001',  -- ethan_001
--   '00000000-0000-0000-0000-000000000002'   -- jason_001
-- );
