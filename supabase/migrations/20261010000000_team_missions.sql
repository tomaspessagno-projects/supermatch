-- =====================================================================
-- Misión del equipo: un objetivo común por día para todos los de un color.
-- Cada run terminado suma su total al progreso de su equipo (finish_run).
-- =====================================================================

create table public.team_missions (
  day          date        not null,
  team_id      text        not null references public.teams (id),
  target       integer     not null check (target > 0),
  progress     integer     not null default 0 check (progress >= 0),
  completed_at timestamptz,
  primary key (day, team_id)
);

alter table public.team_missions enable row level security;
create policy "team missions are public" on public.team_missions for select using (true);
-- El cliente nunca escribe: solo finish_run (security definer).

alter publication supabase_realtime add table public.team_missions;

-- El día del programa es el de Argentina.
create or replace function public.mission_day()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

-- Meta del día, igual para los 4 equipos.
create or replace function public.mission_target()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 10000
$$;

-- Las misiones de hoy de los 4 equipos (con 0 si todavía nadie jugó).
create or replace function public.today_missions()
returns table (team_id text, progress integer, target integer, completed_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select t.id, coalesce(m.progress, 0), coalesce(m.target, public.mission_target()), m.completed_at
    from public.teams t
    left join public.team_missions m
      on m.team_id = t.id and m.day = public.mission_day()
   order by t.id
$$;

grant execute on function public.today_missions() to anon, authenticated;

-- Cierra un run con los 3 resultados y suma al equipo. Todo o nada.
-- p_results: [{ "slot": 1, "minigame_id": "slippery_bridge",
--               "score": 420, "duration_ms": 31000 }, ...]
create or replace function public.finish_run(p_run_id uuid, p_results jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run           public.runs%rowtype;
  v_total         integer;
  v_min_elapsed   integer;
begin
  select * into v_run
    from public.runs
   where id = p_run_id and player_id = auth.uid()
   for update;

  if not found or v_run.status <> 'in_progress' then
    raise exception 'run not found or already closed' using errcode = 'P0002';
  end if;

  if jsonb_typeof(p_results) is distinct from 'array'
     or jsonb_array_length(p_results) <> 3 then
    raise exception 'expected exactly 3 results' using errcode = '22023';
  end if;

  insert into public.run_results (run_id, slot, minigame_id, score, duration_ms)
  select p_run_id, r.slot, r.minigame_id, r.score, r.duration_ms
    from jsonb_to_recordset(p_results)
         as r(slot smallint, minigame_id text, score integer, duration_ms integer);

  -- Plausibilidad por minijuego (tope de puntaje, duración mínima, activo).
  if exists (
    select 1
      from public.run_results rr
      join public.minigames m on m.id = rr.minigame_id
     where rr.run_id = p_run_id
       and (rr.score > m.max_score
            or rr.duration_ms < m.min_duration_ms
            or not m.is_active)
  ) then
    raise exception 'implausible result' using errcode = '22023';
  end if;

  -- Plausibilidad global: el reloj del servidor manda, no el del cliente.
  select coalesce(sum(m.min_duration_ms), 0)
    into v_min_elapsed
    from public.run_results rr
    join public.minigames m on m.id = rr.minigame_id
   where rr.run_id = p_run_id;

  if now() - v_run.started_at < v_min_elapsed * interval '1 millisecond' then
    raise exception 'run finished too fast' using errcode = '22023';
  end if;

  select sum(score) into v_total from public.run_results where run_id = p_run_id;

  update public.runs
     set status = 'finished', total_score = v_total, finished_at = now()
   where id = p_run_id;

  update public.team_totals
     set total_score = total_score + v_total,
         runs_count  = runs_count + 1,
         updated_at  = now()
   where team_id = v_run.team_id;

  -- Misión del día: lo que hiciste suma al objetivo común de tu equipo.
  insert into public.team_missions as m (day, team_id, target, progress, completed_at)
  values (public.mission_day(), v_run.team_id, public.mission_target(), v_total,
          case when v_total >= public.mission_target() then now() end)
  on conflict (day, team_id) do update
     set progress     = m.progress + excluded.progress,
         completed_at = coalesce(
           m.completed_at,
           case when m.progress + excluded.progress >= m.target then now() end
         );

  return v_total;
end;
$$;

revoke execute on function public.finish_run(uuid, jsonb) from public, anon;
grant  execute on function public.finish_run(uuid, jsonb) to authenticated;
