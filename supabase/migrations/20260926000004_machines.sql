-- Máquinas del local, bautizadas por el grupo. Cada partida puede indicar en cuál se jugó.

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

create unique index machines_name_idx on public.machines (lower(trim(name)));

alter table public.machines enable row level security;
create policy "Cualquiera puede leer las máquinas" on public.machines
  for select to anon, authenticated using (true);

alter table public.games add column machine_id uuid references public.machines (id) on delete set null;

-- Crear devuelve la existente si ya hay una con ese nombre.
create function public.add_machine(code text, name text) returns public.machines
language plpgsql security definer set search_path = '' as $$
declare
  saved public.machines;
begin
  perform private.assert_group_code(code);
  select * into saved from public.machines m where lower(trim(m.name)) = lower(trim(add_machine.name));
  if found then
    return saved;
  end if;
  insert into public.machines (name) values (trim(add_machine.name)) returning * into saved;
  return saved;
end $$;

-- add_game gana la máquina (opcional).
drop function public.add_game(text, text, integer, integer);

create function public.add_game(code text, player text, tickets integer, cents integer, machine_id uuid default null)
returns public.games
language plpgsql security definer set search_path = '' as $$
declare
  saved public.games;
begin
  perform private.assert_group_code(code);
  insert into public.games (player, tickets, cents, session_id, machine_id)
  values (add_game.player, add_game.tickets, add_game.cents,
          (select s.id from public.sessions s where s.ended_at is null), add_game.machine_id)
  returning * into saved;
  return saved;
end $$;

revoke all on function public.add_machine(text, text), public.add_game(text, text, integer, integer, uuid) from public;
grant execute on function public.add_machine(text, text), public.add_game(text, text, integer, integer, uuid) to anon, authenticated;

alter publication supabase_realtime add table public.machines;
