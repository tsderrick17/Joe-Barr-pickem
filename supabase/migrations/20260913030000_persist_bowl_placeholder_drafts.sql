-- Commissioner staging selections can be made before Selection Sunday assigns
-- real team ids. Keep those side-only drafts separate from gradeable picks.
alter table public.bowl_pool_entries
  add column if not exists preview_selections jsonb not null default '[]'::jsonb;

alter table public.bowl_pool_entries
  drop constraint if exists bowl_pool_entries_preview_selections_array;
alter table public.bowl_pool_entries
  add constraint bowl_pool_entries_preview_selections_array
  check (jsonb_typeof(preview_selections) = 'array');
