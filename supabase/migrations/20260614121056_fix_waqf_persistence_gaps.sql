-- Waqful Madinah persistence repairs.
-- Scope guard: this migration may reference only public.waqf_* data tables.
-- Other application namespaces are intentionally not referenced.

CREATE OR REPLACE FUNCTION public.madrasa_rel_update_config(
  p_teacher_pin text,
  p_teacher_name text,
  p_madrasa_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.verify_teacher_pin(p_teacher_pin) THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  UPDATE public.waqf_madrasa_config
  SET teacher_name = COALESCE(NULLIF(btrim(p_teacher_name), ''), teacher_name),
      madrasa_name = COALESCE(NULLIF(btrim(p_madrasa_name), ''), madrasa_name),
      updated_at = now()
  WHERE id = 'singleton';
END;
$$;

CREATE OR REPLACE FUNCTION public.madrasa_rel_upsert_academic_history(
  p_teacher_pin text,
  p_student_id text,
  p_record jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.verify_teacher_pin(p_teacher_pin) THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  INSERT INTO public.waqf_academic_history (
    id, student_id, year_class, grade, added_at
  )
  VALUES (
    p_record->>'id',
    p_student_id,
    COALESCE(p_record->>'year_class', ''),
    COALESCE(p_record->>'grade', ''),
    COALESCE(NULLIF(p_record->>'added_at', '')::date, CURRENT_DATE)
  )
  ON CONFLICT (id) DO UPDATE SET
    year_class = EXCLUDED.year_class,
    grade = EXCLUDED.grade,
    added_at = EXCLUDED.added_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.madrasa_rel_delete_academic_history(
  p_teacher_pin text,
  p_student_id text,
  p_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.verify_teacher_pin(p_teacher_pin) THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  DELETE FROM public.waqf_academic_history
  WHERE id = p_id AND student_id = p_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.madrasa_rel_upsert_teacher_note(
  p_teacher_pin text,
  p_id text,
  p_student_id text,
  p_text text,
  p_date text,
  p_time text,
  p_edited_at text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.verify_teacher_pin(p_teacher_pin) THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  INSERT INTO public.waqf_teacher_notes (
    id, student_id, text, note_date, note_time, edited_at
  )
  VALUES (
    p_id,
    p_student_id,
    COALESCE(p_text, ''),
    COALESCE(NULLIF(p_date, '')::date, CURRENT_DATE),
    COALESCE(p_time, ''),
    NULLIF(p_edited_at, '')::date
  )
  ON CONFLICT (id) DO UPDATE SET
    text = EXCLUDED.text,
    note_date = EXCLUDED.note_date,
    note_time = EXCLUDED.note_time,
    edited_at = EXCLUDED.edited_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.madrasa_rel_delete_teacher_note(
  p_teacher_pin text,
  p_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.verify_teacher_pin(p_teacher_pin) THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  DELETE FROM public.waqf_teacher_notes WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.madrasa_rel_delete_goal(
  p_pin text,
  p_student_id text,
  p_goal_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.waqf_students
    WHERE id = p_student_id AND pin = p_pin
  ) THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  DELETE FROM public.waqf_goals
  WHERE id = p_goal_id AND student_id = p_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.madrasa_rel_delete_document(
  p_pin text,
  p_role text,
  p_doc_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_id text;
BEGIN
  SELECT student_id INTO v_student_id
  FROM public.waqf_documents
  WHERE id = p_doc_id;

  IF p_role = 'teacher' THEN
    IF NOT private.verify_teacher_pin(p_pin) THEN
      RAISE EXCEPTION 'invalid_pin';
    END IF;
  ELSIF p_role = 'student' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.waqf_students
      WHERE id = v_student_id AND pin = p_pin
    ) THEN
      RAISE EXCEPTION 'invalid_pin';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_role';
  END IF;

  DELETE FROM public.waqf_documents WHERE id = p_doc_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.madrasa_rel_update_quiz_score(
  p_teacher_pin text,
  p_submission_id text,
  p_score integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.verify_teacher_pin(p_teacher_pin) THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  UPDATE public.waqf_quiz_submissions qs
  SET score = GREATEST(0, LEAST(COALESCE(p_score, 0), qs.total)),
      passed = CASE
        WHEN qs.total <= 0 THEN false
        ELSE (
          GREATEST(0, LEAST(COALESCE(p_score, 0), qs.total))::numeric
          / qs.total * 100
        ) >= (
          SELECT q.pass_percent
          FROM public.waqf_quizzes q
          WHERE q.id = qs.quiz_id
        )
      END,
      needs_manual_grade = false
  WHERE qs.id = p_submission_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.madrasa_rel_complete_onetime_task(
  p_pin text,
  p_role text,
  p_completion_id text,
  p_task_id text,
  p_student_id text,
  p_date text,
  p_completed_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ok boolean := false;
  v_date date := COALESCE(NULLIF(p_date, '')::date, CURRENT_DATE);
  v_completed_at timestamptz := COALESCE(p_completed_at, now());
BEGIN
  IF p_role = 'teacher' THEN
    v_ok := private.verify_teacher_pin(p_pin);
  ELSIF p_role = 'student' THEN
    v_ok := EXISTS (
      SELECT 1
      FROM public.waqf_students
      WHERE id = p_student_id AND pin = p_pin
    );
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  INSERT INTO public.waqf_task_completions (
    id, task_id, student_id, comp_date, status, completed_at, note, created_at
  )
  VALUES (
    p_completion_id, p_task_id, p_student_id, v_date,
    'done', v_completed_at, '', now()
  )
  ON CONFLICT (task_id, student_id, comp_date) DO UPDATE SET
    status = 'done',
    completed_at = EXCLUDED.completed_at;

  UPDATE public.waqf_task_assignments
  SET status = 'done',
      completed_date = v_date,
      completed_time = to_char(v_completed_at AT TIME ZONE 'Asia/Dhaka', 'HH24:MI')
  WHERE task_id = p_task_id AND student_id = p_student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.madrasa_rel_update_config(text, text, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.madrasa_rel_upsert_academic_history(text, text, jsonb) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.madrasa_rel_delete_academic_history(text, text, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.madrasa_rel_upsert_teacher_note(text, text, text, text, text, text, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.madrasa_rel_delete_teacher_note(text, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.madrasa_rel_delete_goal(text, text, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.madrasa_rel_delete_document(text, text, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.madrasa_rel_update_quiz_score(text, text, integer) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.madrasa_rel_complete_onetime_task(text, text, text, text, text, text, timestamptz) FROM PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION public.madrasa_rel_update_config(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.madrasa_rel_upsert_academic_history(text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.madrasa_rel_delete_academic_history(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.madrasa_rel_upsert_teacher_note(text, text, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.madrasa_rel_delete_teacher_note(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.madrasa_rel_delete_goal(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.madrasa_rel_delete_document(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.madrasa_rel_update_quiz_score(text, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.madrasa_rel_complete_onetime_task(text, text, text, text, text, text, timestamptz) TO anon;
