-- Sesiones de tarde: agrupan las partidas de cada quedada. Solo puede haber una abierta.

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create unique index sessions_one_open_idx on public.sessions ((true)) where ended_at is null;

alter table public.sessions enable row level security;
create policy "Cualquiera puede leer las sesiones" on public.sessions
  for select to anon, authenticated using (true);

alter table public.games add column session_id uuid references public.sessions (id) on delete set null;

-- Las partidas nuevas se asocian solas a la sesión abierta, si la hay.
create or replace function public.add_game(code text, player text, tickets integer, cents integer) returns public.games
language plpgsql security definer set search_path = '' as $$
declare
  saved public.games;
begin
  perform private.assert_group_code(code);
  insert into public.games (player, tickets, cents, session_id)
  values (add_game.player, add_game.tickets, add_game.cents,
          (select s.id from public.sessions s where s.ended_at is null))
  returning * into saved;
  return saved;
end $$;

-- Empezar devuelve la sesión abierta si ya había una.
create function public.start_session(code text) returns public.sessions
language plpgsql security definer set search_path = '' as $$
declare
  current_session public.sessions;
begin
  perform private.assert_group_code(code);
  select * into current_session from public.sessions where ended_at is null;
  if found then
    return current_session;
  end if;
  insert into public.sessions default values returning * into current_session;
  return current_session;
end $$;

create function public.end_session(code text) returns public.sessions
language plpgsql security definer set search_path = '' as $$
declare
  ended public.sessions;
begin
  perform private.assert_group_code(code);
  update public.sessions set ended_at = now() where ended_at is null returning * into ended;
  return ended;
end $$;

revoke all on function public.start_session(text), public.end_session(text) from public;
grant execute on function public.start_session(text), public.end_session(text) to anon, authenticated;

alter publication supabase_realtime add table public.sessions;
