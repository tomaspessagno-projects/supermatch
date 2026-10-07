-- =====================================================================
-- Supermatch · esquema inicial
--
-- Modelo:
--   teams        facciones fijas (rojo/azul/amarillo/verde)
--   players      perfil 1:1 con auth.users (Supabase Anonymous Sign-in)
--   minigames    catálogo + topes para validar puntajes en el servidor
--   runs         una partida = 3 minijuegos consecutivos
--   run_results  puntaje de cada minijuego dentro de un run
--   team_totals  acumulado por equipo (tabla, no vista: Realtime solo
--                emite cambios de tablas). Es lo que escucha el leaderboard.
--
-- Escrituras de puntaje: SOLO vía RPC (start_run / finish_run).
-- El cliente nunca hace INSERT directo en runs / run_results / team_totals.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Facciones (datos de referencia: van en la migración, no en seed)
-- ---------------------------------------------------------------------
create table public.teams (
  id         text primary key,
  name       text not null,
  color_hex  text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$')
);

insert into public.teams (id, name, color_hex) values
  ('red',    'Equipo Rojo',     '#E63946'),
  ('blue',   'Equipo Azul',     '#1D4ED8'),
  ('yellow', 'Equipo Amarillo', '#FACC15'),
  ('green',  'Equipo Verde',    '#16A34A');


-- ---------------------------------------------------------------------
-- 2. Jugadores
-- ---------------------------------------------------------------------
create table public.players (
  id          uuid primary key references auth.users (id) on delete cascade,
  nickname    text not null check (char_length(nickname) between 2 and 20),
  team_id     text not null references public.teams (id),
  created_at  timestamptz not null default now()
);

create index players_team_idx on public.players (team_id);


-- ---------------------------------------------------------------------
-- 3. Catálogo de minijuegos
-- ---------------------------------------------------------------------
create table public.minigames (
  id               text primary key,
  name             text not null,
  max_score        integer not null check (max_score > 0),
  min_duration_ms  integer not null check (min_duration_ms >= 0),
  is_active        boolean not null default true
);

-- Valores provisorios: se ajustan cuando tengamos el scoring real.
insert into public.minigames (id, name, max_score, min_duration_ms) values
  ('slippery_bridge', 'El Puente Resbaladizo', 1000, 5000);


-- ---------------------------------------------------------------------
-- 4. Runs (una partida completa)
-- ---------------------------------------------------------------------
create type public.run_status as enum ('in_progress', 'finished', 'abandoned');

create table public.runs (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players (id) on delete cascade,
  team_id      text not null references public.teams (id), -- snapshot al empezar
  status       public.run_status not null default 'in_progress',
  total_score  integer not null default 0 check (total_score >= 0),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  check ((status = 'finished') = (finished_at is not null))
);

create index runs_player_idx on public.runs (player_id, started_at desc);
create index runs_team_score_idx on public.runs (team_id, total_score desc)
  where status = 'finished';


-- ---------------------------------------------------------------------
-- 5. Resultado por minijuego
-- ---------------------------------------------------------------------
create table public.run_results (
  run_id       uuid not null references public.runs (id) on delete cascade,
  slot         smallint not null check (slot between 1 and 3),
  minigame_id  text not null references public.minigames (id),
  score        integer not null check (score >= 0),
  duration_ms  integer not null check (duration_ms >= 0),
  primary key (run_id, slot)
);


-- ---------------------------------------------------------------------
-- 6. Totales por equipo (lo que consume el leaderboard en tiempo real)
-- ---------------------------------------------------------------------
create table public.team_totals (
  team_id      text primary key references public.teams (id),
  total_score  bigint not null default 0,
  runs_count   integer not null default 0,
  updated_at   timestamptz not null default now()
);

insert into public.team_totals (team_id) select id from public.teams;


-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.teams        enable row level security;
alter table public.minigames    enable row level security;
alter table public.players      enable row level security;
alter table public.runs         enable row level security;
alter table public.run_results  enable row level security;
alter table public.team_totals  enable row level security;

-- Lectura pública: el leaderboard se ve sin estar logueado.
create policy "teams are public"       on public.teams       for select using (true);
create policy "minigames are public"   on public.minigames   for select using (true);
create policy "team totals are public" on public.team_totals for select using (true);

-- Perfil propio.
create policy "players read own" on public.players
  for select using (id = (select auth.uid()));
create policy "players insert own" on public.players
  for insert with check (id = (select auth.uid()));
create policy "players update own" on public.players
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- La facción queda bloqueada una vez elegida: solo se puede editar el nickname.
revoke update on public.players from anon, authenticated;
grant update (nickname) on public.players to authenticated;

-- Runs y resultados: solo lectura de los propios. Sin políticas de escritura.
create policy "runs read own" on public.runs
  for select using (player_id = (select auth.uid()));
create policy "run results read own" on public.run_results
  for select using (
    exists (
      select 1 from public.runs r
       where r.id = run_id and r.player_id = (select auth.uid())
    )
  );


-- =====================================================================
-- RPCs (security definer: única puerta de escritura de puntajes)
-- =====================================================================

-- Abre un run. El servidor fija started_at, así finish_run puede verificar
-- que el tiempo real transcurrido sea plausible.
create or replace function public.start_run()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team    text;
  v_run_id  uuid;
begin
  select team_id into v_team from public.players where id = auth.uid();
  if v_team is null then
    raise exception 'player profile not found' using errcode = 'P0002';
  end if;

  -- Un solo run activo por jugador: los colgados se dan por abandonados.
  update public.runs
     set status = 'abandoned'
   where player_id = auth.uid() and status = 'in_progress';

  insert into public.runs (player_id, team_id)
  values (auth.uid(), v_team)
  returning id into v_run_id;

  return v_run_id;
end;
$$;


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

  return v_total;
end;
$$;

revoke execute on function public.start_run()                from public, anon;
revoke execute on function public.finish_run(uuid, jsonb)    from public, anon;
grant  execute on function public.start_run()                to authenticated;
grant  execute on function public.finish_run(uuid, jsonb)    to authenticated;


-- =====================================================================
-- Realtime: el leaderboard escucha UPDATEs sobre 4 filas.
-- =====================================================================
alter publication supabase_realtime add table public.team_totals;
