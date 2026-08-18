alter table public.push_reminders
  add column if not exists automation_key text,
  add column if not exists source_game_ids uuid[] not null default '{}';

create unique index if not exists push_reminders_automation_key_unique
  on public.push_reminders(automation_key)
  where automation_key is not null;

-- The original recap index accidentally limited every category to one row per
-- week. Keep that protection for the recap alone so gameday and window-based
-- plan messages can each have their own immutable occurrence.
drop index if exists public.push_reminders_one_automatic_recap_per_period;
create unique index if not exists push_reminders_one_automatic_recap_per_period
  on public.push_reminders(category, source_scoring_period_id)
  where category = 'weekly_recap' and source_scoring_period_id is not null;

comment on column public.push_reminders.automation_key is
  'Stable deduplication key for a specific automatic email occurrence.';
comment on column public.push_reminders.source_game_ids is
  'Exact games represented by an automatic email, retained with its delivery receipt.';
