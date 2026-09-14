-- The original health-probe migration was already applied before the scoped
-- probe names were added. Expand the production constraint in a follow-up
-- migration so each independent worker endpoint can persist its state.
alter table public.health_probe_states
  drop constraint if exists health_probe_states_probe_name_check;

alter table public.health_probe_states
  add constraint health_probe_states_probe_name_check
  check (probe_name in (
    'critical_workers',
    'critical_worker_line_locks',
    'critical_worker_scores',
    'critical_worker_reminders'
  ));
