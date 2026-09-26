CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dark_mode boolean NOT NULL DEFAULT false,
  open_cards_in_new_tab boolean NOT NULL DEFAULT false,
  gamificacao_avatar_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_preferences_select_own ON public.user_preferences;
CREATE POLICY user_preferences_select_own
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_preferences_write_own ON public.user_preferences;
CREATE POLICY user_preferences_write_own
  ON public.user_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.upsert_user_preferences(
  p_dark_mode boolean DEFAULT NULL,
  p_open_cards_in_new_tab boolean DEFAULT NULL,
  p_gamificacao_avatar_id text DEFAULT NULL
)
RETURNS public.user_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result public.user_preferences;
BEGIN
  INSERT INTO public.user_preferences (
    user_id,
    dark_mode,
    open_cards_in_new_tab,
    gamificacao_avatar_id
  )
  VALUES (
    auth.uid(),
    COALESCE(p_dark_mode, false),
    COALESCE(p_open_cards_in_new_tab, false),
    p_gamificacao_avatar_id
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    dark_mode = COALESCE(p_dark_mode, public.user_preferences.dark_mode),
    open_cards_in_new_tab = COALESCE(p_open_cards_in_new_tab, public.user_preferences.open_cards_in_new_tab),
    gamificacao_avatar_id = COALESCE(p_gamificacao_avatar_id, public.user_preferences.gamificacao_avatar_id),
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.upsert_user_preferences(boolean, boolean, text) TO authenticated;
