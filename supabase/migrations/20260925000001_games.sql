-- Partidas compartidas protegidas con un código de grupo.
-- Leer es público; escribir solo es posible a través de funciones que comprueban el código.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

-- Hash del código de grupo (una sola fila). El esquema private no se expone por la API.
create table private.group_code (
  id boolean primary key default true check (id),
  code_hash text not null
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  player text not null check (player in ('alej', 'jon', 'gabriel', 'javier', 'migueliz')),
  tickets integer not null check (tickets between 0 and 99999),
  cents integer not null check (cents between 0 and 100000),
  created_at timestamptz not null default now()
);

create index games_created_at_idx on public.games (created_at);

alter table public.games enable row level security;

-- Sin políticas de escritura: nadie inserta, edita ni borra directamente.
create policy "Cualquiera puede leer las partidas" on public.games
  for select to anon, authenticated using (true);

create function private.assert_group_code(code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from private.group_code g where g.code_hash = extensions.crypt(code, g.code_hash)
  ) then
    raise exception 'codigo_incorrecto' using errcode = '28000';
  end if;
end $$;

create function public.check_group_code(code text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_group_code(code);
  return true;
exception when sqlstate '28000' then
  return false;
end $$;

create function public.add_game(code text, player text, tickets integer, cents integer) returns public.games
language plpgsql security definer set search_path = '' as $$
declare
  saved public.games;
begin
  perform private.assert_group_code(code);
  insert into public.games (player, tickets, cents)
  values (add_game.player, add_game.tickets, add_game.cents)
  returning * into saved;
  return saved;
end $$;

create function public.remove_game(code text, game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_group_code(code);
  delete from public.games where id = game_id;
end $$;

revoke all on function private.assert_group_code(text) from public;
revoke all on function public.check_group_code(text), public.add_game(text, text, integer, integer), public.remove_game(text, uuid) from public;
grant execute on function public.check_group_code(text), public.add_game(text, text, integer, integer), public.remove_game(text, uuid) to anon, authenticated;
