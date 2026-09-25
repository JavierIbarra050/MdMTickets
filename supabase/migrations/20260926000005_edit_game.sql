-- Corregir una partida mal apuntada.
create function public.update_game(code text, game_id uuid, tickets integer, cents integer, machine_id uuid default null)
returns public.games
language plpgsql security definer set search_path = '' as $$
declare
  saved public.games;
begin
  perform private.assert_group_code(code);
  update public.games g
     set tickets = update_game.tickets, cents = update_game.cents, machine_id = update_game.machine_id
   where g.id = update_game.game_id
  returning * into saved;
  return saved;
end $$;

revoke all on function public.update_game(text, uuid, integer, integer, uuid) from public;
grant execute on function public.update_game(text, uuid, integer, integer, uuid) to anon, authenticated;
