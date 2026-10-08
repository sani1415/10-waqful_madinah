-- ════════════════════════════════════════════════════════════════════════
-- Waqful Madinah — PIN brute-force guard + diary/group auth fix
-- ════════════════════════════════════════════════════════════════════════
--
-- (A) BUG FIX — ছয়টি RPC `PERFORM private.verify_teacher_pin(...)` ব্যবহার করত।
--     PERFORM ফলাফল ফেলে দেয়, তাই এগুলোতে কার্যত কোনো PIN যাচাই ছিল না:
--     get_diary / upsert_diary / delete_diary / get_groups / upsert_group /
--     delete_group। anon key থাকলে যে কেউ শিক্ষকের ব্যক্তিগত ডায়েরি পড়তে পারত।
--     এখন: `IF NOT verify THEN RAISE EXCEPTION 'invalid_pin'`।
--
-- (B) PIN LOCKOUT — ৪ অঙ্কের PIN-এ মাত্র ১০,০০০ সম্ভাবনা। এখন প্রতি subject
--     (শিক্ষক = 'teacher', ছাত্র = students.id) ৬০ মিনিটে ১০টি ভুল চেষ্টার পর
--     'pin_locked' — সঠিক PIN দিলেও — উইন্ডো শেষ হওয়া পর্যন্ত।
--
--     কেন SEQUENCE? সব RPC ভুল PIN-এ RAISE করে → পুরো transaction rollback হয়,
--     তাই সাধারণ টেবিলে লেখা ব্যর্থতার হিসাব হারিয়ে যেত। nextval/setval
--     non-transactional — rollback-এর পরেও থাকে। প্রতি subject-এর একটি
--     sequence: value = window_start_minute * 10000 + fail_count।
--
-- (C) TRUSTED DEVICE — লকআউট যেন DoS-এর হাতিয়ার না হয় (যেমন কোনো ছাত্র
--     শিক্ষক লগইনে ইচ্ছা করে ভুল PIN দিয়ে শিক্ষককে আটকে দিল)। সফল লগইনের পর
--     ক্লায়েন্ট একটি র‍্যান্ডম device token নিবন্ধন করে (`madrasa_rel_trust_device`)
--     এবং প্রতিটি অনুরোধে `x-waqf-device` হেডারে পাঠায়। লক চলাকালীন বিশ্বস্ত
--     ডিভাইস সঠিক PIN দিয়ে কাজ চালিয়ে যেতে পারে; অন্যরা পারে না।
--
-- (D) `madrasa_rel_verify_session` — Vercel /api/admin-ai ও /api/transcribe
--     এখন এই RPC দিয়ে অনুরোধকারীর PIN যাচাই করে (একই লকআউটের আওতায়)।
--
-- পুরনো ক্লায়েন্টের সাথে সামঞ্জস্যপূর্ণ: হেডার না পাঠালে শুধু trusted-bypass পাবে না।
-- এই migration-এ কোনো ডেটা পরিবর্তন/মোছা হয় না — শুধু function/sequence/টেবিল।
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Trusted devices ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waqf_trusted_devices (
  token_hash   text        NOT NULL,
  subject      text        NOT NULL,           -- 'teacher' | waqf_students.id
  role         text        NOT NULL CHECK (role IN ('teacher', 'student')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (token_hash, subject)
);
ALTER TABLE public.waqf_trusted_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waqf_trusted_devices FROM anon, authenticated;

-- ── 2. Per-subject counter sequences ─────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS private.waqf_pin_guard_fallback MINVALUE 0 START 0;

CREATE OR REPLACE FUNCTION private.waqf_pin_seq_name(p_subject text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'waqf_pin_guard_' || left(md5(coalesce(p_subject, '')), 16)
$$;

CREATE OR REPLACE FUNCTION private.waqf_pin_ensure_seq(p_subject text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS private.%I MINVALUE 0 START 0',
                 private.waqf_pin_seq_name(p_subject));
END;
$$;

CREATE OR REPLACE FUNCTION private.waqf_pin_seq(p_subject text)
RETURNS regclass LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN coalesce(
    to_regclass('private.' || private.waqf_pin_seq_name(p_subject)),
    'private.waqf_pin_guard_fallback'::regclass
  );
END;
$$;

-- নতুন ছাত্র যোগ হলে তার sequence তৈরি
CREATE OR REPLACE FUNCTION private.waqf_students_pin_seq_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.waqf_pin_ensure_seq(NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS waqf_students_pin_seq ON public.waqf_students;
CREATE TRIGGER waqf_students_pin_seq AFTER INSERT ON public.waqf_students
  FOR EACH ROW EXECUTE FUNCTION private.waqf_students_pin_seq_trg();

SELECT private.waqf_pin_ensure_seq('teacher');
SELECT private.waqf_pin_ensure_seq(id) FROM public.waqf_students;

-- ── 3. Lock state ────────────────────────────────────────────────────
-- Limits: 10 failures per 60-minute window (window starts at first failure).
CREATE OR REPLACE FUNCTION private.waqf_pin_is_locked(p_subject text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_val    bigint;
  v_called boolean;
  v_now    bigint := floor(extract(epoch FROM clock_timestamp()) / 60);
BEGIN
  EXECUTE format('SELECT last_value, is_called FROM %s', private.waqf_pin_seq(p_subject))
    INTO v_val, v_called;
  IF NOT v_called THEN RETURN false; END IF;
  RETURN (v_val % 10000) >= 10 AND v_now - (v_val / 10000) < 60;
END;
$$;

CREATE OR REPLACE FUNCTION private.waqf_pin_record_failure(p_subject text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_seq regclass := private.waqf_pin_seq(p_subject);
  v_val bigint;
  v_now bigint := floor(extract(epoch FROM clock_timestamp()) / 60);
BEGIN
  v_val := nextval(v_seq);                       -- atomic, survives rollback
  IF v_now - (v_val / 10000) >= 60 THEN          -- window expired → new window
    PERFORM setval(v_seq, v_now * 10000 + 1, true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.waqf_device_trusted(p_subject text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tok text;
BEGIN
  BEGIN
    v_tok := current_setting('request.headers', true)::json ->> 'x-waqf-device';
  EXCEPTION WHEN others THEN
    v_tok := NULL;
  END;
  IF v_tok IS NULL OR length(v_tok) < 32 THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.waqf_trusted_devices
    WHERE subject = p_subject
      AND token_hash = encode(sha256(convert_to(v_tok, 'UTF8')), 'hex')
  );
END;
$$;

-- Core: raise if locked (unless trusted device), record failure if wrong.
CREATE OR REPLACE FUNCTION private.waqf_pin_check(p_subject text, p_ok boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.waqf_pin_is_locked(p_subject) AND NOT private.waqf_device_trusted(p_subject) THEN
    RAISE EXCEPTION 'pin_locked';
  END IF;
  IF NOT coalesce(p_ok, false) THEN
    PERFORM private.waqf_pin_record_failure(p_subject);
  END IF;
END;
$$;

-- ── 4. Student guards (called at the top of student-facing RPCs) ─────
-- These never authorize anything — the RPC's own PIN check still decides.
-- They only (a) block while locked, (b) count a wrong PIN.
CREATE OR REPLACE FUNCTION private.waqf_guard_student_id(p_student_id text, p_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_pin text;
BEGIN
  SELECT pin INTO v_pin FROM public.waqf_students WHERE id = p_student_id;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM private.waqf_pin_check(p_student_id, v_pin IS NOT DISTINCT FROM p_pin);
END;
$$;

CREATE OR REPLACE FUNCTION private.waqf_guard_student_waqf(p_waqf text, p_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id text;
BEGIN
  SELECT id INTO v_id FROM public.waqf_students WHERE waqf_id = p_waqf LIMIT 1;
  IF v_id IS NOT NULL THEN PERFORM private.waqf_guard_student_id(v_id, p_pin); END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.waqf_guard_student_msg(p_message_id text, p_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id text;
BEGIN
  SELECT thread_id INTO v_id FROM public.waqf_messages WHERE id = p_message_id;
  IF v_id IS NOT NULL THEN PERFORM private.waqf_guard_student_id(v_id, p_pin); END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.waqf_guard_student_doc(p_doc_id text, p_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id text;
BEGIN
  SELECT student_id INTO v_id FROM public.waqf_documents WHERE id = p_doc_id;
  IF v_id IS NOT NULL THEN PERFORM private.waqf_guard_student_id(v_id, p_pin); END IF;
END;
$$;

-- ── 5. Teacher PIN (single choke point for ~40 RPCs) ─────────────────
CREATE OR REPLACE FUNCTION private.verify_teacher_pin(p_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ok boolean;
BEGIN
  v_ok := EXISTS (
    SELECT 1 FROM public.waqf_madrasa_config WHERE id = 'singleton' AND teacher_pin = p_pin
  );
  PERFORM private.waqf_pin_check('teacher', v_ok);
  RETURN v_ok;
END;
$$;

REVOKE ALL ON FUNCTION private.waqf_pin_seq_name(text)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.waqf_pin_ensure_seq(text)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.waqf_pin_seq(text)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.waqf_pin_is_locked(text)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.waqf_pin_record_failure(text)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.waqf_device_trusted(text)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.waqf_pin_check(text, boolean)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.waqf_guard_student_id(text, text)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.waqf_guard_student_waqf(text, text)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.waqf_guard_student_msg(text, text)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.waqf_guard_student_doc(text, text)   FROM PUBLIC, anon, authenticated;

-- ── 6. New public RPCs ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.madrasa_rel_trust_device(
  p_role text, p_waqf text, p_pin text, p_token text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_subject text;
  v_ok      boolean := false;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 OR length(p_token) > 128 THEN
    RAISE EXCEPTION 'bad_token';
  END IF;
  IF p_role = 'teacher' THEN
    v_subject := 'teacher';
    v_ok := private.verify_teacher_pin(p_pin);
  ELSIF p_role = 'student' THEN
    SELECT id INTO v_subject FROM public.waqf_students WHERE waqf_id = p_waqf LIMIT 1;
    IF v_subject IS NULL THEN RAISE EXCEPTION 'invalid_pin'; END IF;
    PERFORM private.waqf_guard_student_id(v_subject, p_pin);
    v_ok := EXISTS (SELECT 1 FROM public.waqf_students WHERE id = v_subject AND pin = p_pin);
  ELSE
    RAISE EXCEPTION 'bad_role';
  END IF;
  IF NOT v_ok THEN RAISE EXCEPTION 'invalid_pin'; END IF;

  INSERT INTO public.waqf_trusted_devices (token_hash, subject, role)
  VALUES (encode(sha256(convert_to(p_token, 'UTF8')), 'hex'), v_subject, p_role)
  ON CONFLICT (token_hash, subject) DO UPDATE SET last_seen_at = now();

  -- প্রতি subject-এ সর্বোচ্চ ১০টি ডিভাইস রাখি
  DELETE FROM public.waqf_trusted_devices d
  WHERE d.subject = v_subject
    AND d.token_hash NOT IN (
      SELECT t.token_hash FROM public.waqf_trusted_devices t
      WHERE t.subject = v_subject ORDER BY t.last_seen_at DESC LIMIT 10
    );
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Returns true/false (never raises on a wrong PIN, so failures are counted);
-- raises 'pin_locked' while locked.
CREATE OR REPLACE FUNCTION public.madrasa_rel_verify_session(
  p_role text, p_waqf text, p_pin text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_role = 'teacher' THEN
    RETURN private.verify_teacher_pin(p_pin);
  ELSIF p_role = 'student' THEN
    PERFORM private.waqf_guard_student_waqf(p_waqf, p_pin);
    RETURN EXISTS (SELECT 1 FROM public.waqf_students WHERE waqf_id = p_waqf AND pin = p_pin);
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.madrasa_rel_trust_device(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.madrasa_rel_verify_session(text, text, text)    TO anon;

-- ── 7. Patch existing RPCs in place ──────────────────────────────────
-- Rewrites the live definitions (pg_get_functiondef) instead of copying ~25
-- long function bodies here, so nothing else in them can drift:
--   (a) PERFORM verify_teacher_pin(...)  →  IF NOT ... RAISE 'invalid_pin'
--   (b) inserts one student-guard line right after the top-level BEGIN.
-- Idempotent: functions already containing a guard are skipped.
DO $mig$
DECLARE
  r       record;
  v_def   text;
  v_new   text;
  v_guard text;
  v_not_teacher text := 'IF p_role IS DISTINCT FROM ''teacher'' THEN PERFORM private.%s; END IF;';
  v_slot  text := 'IF NOT (p_id = ''teacher'' OR p_role = ''teacher'') THEN PERFORM private.waqf_guard_student_waqf(p_id, p_pin); END IF;';
  v_map   jsonb;
  v_done  text[] := '{}';
BEGIN
  v_map := jsonb_build_object(
    'madrasa_rel_student_bootstrap',             'PERFORM private.waqf_guard_student_waqf(p_waqf, p_pin);',
    'madrasa_rel_submit_daily_schedule_proposal','PERFORM private.waqf_guard_student_waqf(p_waqf, p_pin);',
    'madrasa_rel_student_update_pin',            'PERFORM private.waqf_guard_student_waqf(btrim(p_waqf), p_old_pin);',
    'madrasa_rel_submit_quiz',                   'PERFORM private.waqf_guard_student_id(p_student_id, p_student_pin);',
    'madrasa_rel_upsert_goal',                   'PERFORM private.waqf_guard_student_id(p_student_id, p_pin);',
    'madrasa_rel_delete_goal',                   'PERFORM private.waqf_guard_student_id(p_student_id, p_pin);',
    'madrasa_rel_upsert_student_note',           'PERFORM private.waqf_guard_student_id(p_student_id, p_pin);',
    'madrasa_rel_delete_student_note',           'PERFORM private.waqf_guard_student_id(p_student_id, p_pin);',
    'madrasa_rel_check_push_failure',            v_slot,
    'madrasa_rel_save_pwa_subscription',         v_slot,
    'madrasa_rel_complete_onetime_task',         format(v_not_teacher, 'waqf_guard_student_id(p_student_id, p_pin)'),
    'madrasa_rel_delete_completion',             format(v_not_teacher, 'waqf_guard_student_id(p_student_id, p_pin)'),
    'madrasa_rel_upsert_completion',             format(v_not_teacher, 'waqf_guard_student_id(p_student_id, p_pin)'),
    'madrasa_rel_update_task_status',            format(v_not_teacher, 'waqf_guard_student_id(p_student_id, p_pin)'),
    'madrasa_rel_mark_messages_read',            format(v_not_teacher, 'waqf_guard_student_id(p_thread_id, p_pin)'),
    'madrasa_rel_insert_document',               format(v_not_teacher, 'waqf_guard_student_id(p_doc->>''student_id'', p_pin)'),
    'madrasa_rel_insert_message',                format(v_not_teacher, 'waqf_guard_student_waqf(p_message->>''thread_id_waqf'', p_pin)'),
    'madrasa_rel_delete_document',               format(v_not_teacher, 'waqf_guard_student_doc(p_doc_id, p_pin)'),
    'madrasa_rel_delete_own_message',            format(v_not_teacher, 'waqf_guard_student_msg(p_message_id, p_pin)'),
    'madrasa_rel_update_message_text',           format(v_not_teacher, 'waqf_guard_student_msg(p_message_id, p_pin)')
  );

  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'madrasa_rel_%'
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_new := replace(v_def,
      'PERFORM private.verify_teacher_pin(p_teacher_pin);',
      'IF NOT private.verify_teacher_pin(p_teacher_pin) THEN RAISE EXCEPTION ''invalid_pin''; END IF;');

    v_guard := v_map ->> r.proname;
    IF v_guard IS NOT NULL AND position('private.waqf_guard_student' IN v_new) = 0 THEN
      IF v_new !~ E'\nBEGIN\r?\n' THEN
        RAISE EXCEPTION 'pin_guard migration: no top-level BEGIN in %', r.proname;
      END IF;
      v_new := regexp_replace(v_new, E'\nBEGIN(\r?\n)', E'\nBEGIN\\1  ' || v_guard || E'\\1');
    END IF;

    IF v_new IS DISTINCT FROM v_def THEN
      EXECUTE v_new;
      v_done := v_done || r.proname::text;
    END IF;
  END LOOP;

  -- every mapped function must now carry its guard
  FOR r IN SELECT key FROM jsonb_each_text(v_map) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = r.key
        AND position('private.waqf_guard_student' IN pg_get_functiondef(p.oid)) > 0
    ) THEN
      RAISE EXCEPTION 'pin_guard migration: % not guarded', r.key;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'madrasa_rel_%'
      AND pg_get_functiondef(p.oid) LIKE '%PERFORM private.verify_teacher_pin%'
  ) THEN
    RAISE EXCEPTION 'pin_guard migration: ignored verify_teacher_pin still present';
  END IF;
END
$mig$;
