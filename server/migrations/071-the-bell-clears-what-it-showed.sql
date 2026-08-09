-- 071 · THE BELL CLEARS WHAT IT SHOWED
--
-- "Mark all read" did not work, and the manager said so. The mechanism was
-- honest and still wrong: the watermark was stamped at now_ms(), but some of
-- the news the bell had ALREADY SHOWN carries a stamp ahead of the clock.
-- A training report is stamped at its round's play hour and the umpire banks
-- the round an hour before first ball; a settled transfer is stamped at the
-- day's play hour whatever o'clock the hammer actually fell. Read the bell
-- inside that gap and those items sat ahead of the watermark - fresh forever,
-- however many times "Mark all read" was pressed, until a later press finally
-- landed past their stamp.
--
-- The reader has read what he was shown. So the watermark is now the newest
-- stamp the feed actually serves him, or the clock, whichever is later - and
-- it never moves backwards, so a slow request cannot undo a newer read.
CREATE OR REPLACE FUNCTION public.world_notifications_seen()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; hi bigint; mark timestamptz;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  -- the newest news stamp this user is currently served (the feed orders
  -- newest first, so one row is enough)
  hi := (public.world_my_notifications(1)->'news'->0->>'at')::bigint;
  mark := to_timestamp(greatest(now_ms(), coalesce(hi, 0)) / 1000.0);
  INSERT INTO notif_seen(user_id, seen_at) VALUES (u, mark)
    ON CONFLICT (user_id) DO UPDATE SET seen_at = greatest(notif_seen.seen_at, excluded.seen_at);
  RETURN jsonb_build_object('ok', true);
END $$;

NOTIFY pgrst, 'reload schema';
