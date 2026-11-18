-- The clubhouse beta: the Commissioner can let chosen players into the clubhouse (the light switch in the header and /clubhouse)
-- before it opens to everyone. Off for every player until the Commissioner turns it on; the Commissioner always has it.
alter table public.players
  add column if not exists clubhouse_access boolean not null default false;
