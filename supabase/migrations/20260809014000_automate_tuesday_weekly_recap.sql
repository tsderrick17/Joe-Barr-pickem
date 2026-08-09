alter table public.push_reminders
  add column if not exists source_scoring_period_id uuid references public.scoring_periods(id) on delete restrict;

create unique index if not exists push_reminders_one_automatic_recap_per_period
  on public.push_reminders(category, source_scoring_period_id);
