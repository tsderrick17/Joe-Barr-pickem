alter table public.players
add column if not exists login_pin text;

update public.players as player
set login_pin = substring(
  auth_user.email
  from '^pin-([0-9]{4})@pickemjb[.]app$'
)
from auth.users as auth_user
where player.auth_user_id = auth_user.id
  and player.login_pin is null;

create unique index if not exists players_login_pin_unique
on public.players (login_pin)
where login_pin is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'players_login_pin_format'
  ) then
    alter table public.players
    add constraint players_login_pin_format
    check (
      login_pin is null
      or login_pin ~ '^[0-9]{4}$'
    );
  end if;
end
$$;