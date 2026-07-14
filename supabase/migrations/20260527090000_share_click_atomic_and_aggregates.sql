-- Atomic share-click counter + per-channel aggregation helpers.
--
-- Background: the previous Node-side implementation did SELECT clicks → +1 → UPDATE
-- on share_events, which loses increments under concurrent viral-share traffic.
--
-- This migration replaces that with:
--   1. `increment_share_event_clicks(uuid)` — atomic single-statement increment.
--   2. `get_share_click_counts(uuid)` — returns per-channel click counts driven by
--      the source-of-truth `share_clicks` table, so analytics never lies even if the
--      cached counter on share_events drifts.

create or replace function public.increment_share_event_clicks(p_share_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.share_events
     set clicks = coalesce(clicks, 0) + 1
   where id = p_share_id
  returning clicks;
$$;

revoke all on function public.increment_share_event_clicks(uuid) from public;
grant execute on function public.increment_share_event_clicks(uuid) to authenticated, service_role, anon;

-- Returns one row per channel with: events_count (number of share_events) and
-- clicks_count (number of share_clicks). Computed via a LEFT JOIN so channels with
-- zero clicks still appear. Single round-trip instead of N+1 over share_events rows.
create or replace function public.get_share_click_counts(p_passport_id uuid)
returns table (channel text, events_count bigint, clicks_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select se.channel::text                 as channel,
         count(distinct se.id)            as events_count,
         count(sc.id)                     as clicks_count
    from public.share_events se
    left join public.share_clicks sc on sc.share_id = se.id
   where se.passport_id = p_passport_id
   group by se.channel;
$$;

revoke all on function public.get_share_click_counts(uuid) from public;
grant execute on function public.get_share_click_counts(uuid) to authenticated, service_role, anon;
