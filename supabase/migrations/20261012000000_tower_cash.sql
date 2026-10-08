-- =====================================================================
-- La Torre suma para el equipo: cada intento cobrado manda los metros que
-- subiste, y cada metro vale 10 puntos para tu color (ranking y misión del día).
--
-- Como el intento se juega en el navegador, el servidor pone topes:
--   - no más que el alto de la torre (98 m) por intento;
--   - ritmo: entre un cobro y el siguiente tiene que pasar el tiempo de subir
--     esos metros (como mucho 4 m por segundo, más 3 s de la caída);
--   - cada jugador suma como mucho 5.000 puntos por día a su equipo.
-- =====================================================================

create table public.tower_cashes (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.players (id) on delete cascade,
  team_id     text not null references public.teams (id),
  climbed     real not null check (climbed >= 0),
  points      integer not null check (points >= 0),
  created_at  timestamptz not null default now()
);

create index tower_cashes_player_idx on public.tower_cashes (player_id, created_at desc);

alter table public.tower_cashes enable row level security;
create policy "tower cashes read own" on public.tower_cashes
  for select using (player_id = (select auth.uid()));
-- Sin políticas de escritura: solo tower_cash (security definer).

create or replace function public.tower_cash(p_climbed real)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team    text;
  v_last    timestamptz;
  v_today   integer;
  v_points  integer;
begin
  -- Bloquea el perfil: dos cobros a la vez del mismo jugador van de a uno.
  select team_id into v_team from public.players where id = auth.uid() for update;
  if v_team is null then
    raise exception 'no profile' using errcode = 'P0002';
  end if;

  if p_climbed is null or p_climbed < 0 or p_climbed > 98 then
    raise exception 'implausible climb' using errcode = '22023';
  end if;

  select max(created_at) into v_last from public.tower_cashes where player_id = auth.uid();
  if v_last is not null and now() - v_last < make_interval(secs => 3 + p_climbed / 4) then
    raise exception 'too fast' using errcode = '22023';
  end if;

  select coalesce(sum(points), 0) into v_today
    from public.tower_cashes
   where player_id = auth.uid()
     and (created_at at time zone 'America/Argentina/Buenos_Aires')::date = public.mission_day();

  v_points := greatest(0, least(round(p_climbed * 10)::integer, 5000 - v_today));

  insert into public.tower_cashes (player_id, team_id, climbed, points)
  values (auth.uid(), v_team, p_climbed, v_points);

  if v_points > 0 then
    update public.team_totals
       set total_score = total_score + v_points,
           runs_count  = runs_count + 1,
           updated_at  = now()
     where team_id = v_team;

    insert into public.team_missions as m (day, team_id, target, progress, completed_at)
    values (public.mission_day(), v_team, public.mission_target(), v_points,
            case when v_points >= public.mission_target() then now() end)
    on conflict (day, team_id) do update
       set progress     = m.progress + excluded.progress,
           completed_at = coalesce(
             m.completed_at,
             case when m.progress + excluded.progress >= m.target then now() end
           );
  end if;

  return v_points;
end;
$$;

revoke execute on function public.tower_cash(real) from public, anon;
grant  execute on function public.tower_cash(real) to authenticated;
