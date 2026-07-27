-- Push failure feedback loop.
-- Edge Function (notify-kv-push) records every failed Web Push send here, keyed
-- by the subscription slot it tried (teacher_device_*, waqf_NNN). On startup the
-- client checks its own slot via madrasa_rel_check_push_failure and, if flagged,
-- force-renews its push subscription immediately instead of waiting for the
-- 14-day auto-renew. Saving a new subscription clears the flag.

CREATE TABLE IF NOT EXISTS public.waqf_push_failures (
  slot_id text PRIMARY KEY,
  role text NOT NULL DEFAULT '',
  status_code integer,
  endpoint text,
  failed_at timestamptz NOT NULL DEFAULT now()
);

-- No policies: deny all direct REST access (service role + SECURITY DEFINER RPCs only)
ALTER TABLE public.waqf_push_failures ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.madrasa_rel_check_push_failure(
  p_id text,
  p_role text,
  p_pin text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_ok boolean := false;
  v_row public.waqf_push_failures%ROWTYPE;
BEGIN
  IF p_id = 'teacher' OR p_role = 'teacher' THEN
    v_ok := private.verify_teacher_pin(p_pin);
  ELSIF p_id LIKE 'shared_device_%' THEN
    v_ok := true;
  ELSE
    v_ok := EXISTS (
      SELECT 1 FROM public.waqf_students WHERE waqf_id = p_id AND pin = p_pin
    );
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  SELECT * INTO v_row FROM public.waqf_push_failures WHERE slot_id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('flagged', false);
  END IF;
  RETURN jsonb_build_object(
    'flagged', true,
    'status_code', v_row.status_code,
    'failed_at', v_row.failed_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.madrasa_rel_check_push_failure(text, text, text) TO anon;

-- Patch madrasa_rel_save_pwa_subscription: a freshly saved subscription clears
-- any recorded failure for that slot (repair completed).
CREATE OR REPLACE FUNCTION public.madrasa_rel_save_pwa_subscription(
  p_id text,
  p_role text,
  p_subscription jsonb,
  p_pin text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_ok boolean := false;
  v_endpoint text := NULLIF(p_subscription->>'endpoint', '');
BEGIN
  IF p_id = 'teacher' OR p_role = 'teacher' THEN
    v_ok := private.verify_teacher_pin(p_pin);
  ELSIF p_id LIKE 'shared_device_%' THEN
    v_ok := true;
  ELSE
    v_ok := EXISTS (
      SELECT 1 FROM public.waqf_students WHERE waqf_id = p_id AND pin = p_pin
    );
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  IF v_endpoint IS NOT NULL THEN
    DELETE FROM public.waqf_pwa_subscriptions
    WHERE id <> p_id
      AND subscription->>'endpoint' = v_endpoint;
  END IF;

  INSERT INTO public.waqf_pwa_subscriptions (id, role, subscription, updated_at)
  VALUES (p_id, p_role, p_subscription, now())
  ON CONFLICT (id) DO UPDATE SET
    subscription = EXCLUDED.subscription,
    role = EXCLUDED.role,
    updated_at = now();

  DELETE FROM public.waqf_push_failures WHERE slot_id = p_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
