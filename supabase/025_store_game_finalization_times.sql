-- Stores the moment a final score was accepted with the game itself. This
-- keeps weekly rollover independent of audit-log availability.
alter table public.games
  add column if not exists finalized_at timestamptz;

update public.games
set finalized_at = (
  select max(audit_logs.created_at)
  from public.audit_logs
  where audit_logs.action = 'final_score_imported'
    and audit_logs.entity_type = 'game'
    and audit_logs.entity_id = games.id
)
where status = 'final'
  and finalized_at is null;
