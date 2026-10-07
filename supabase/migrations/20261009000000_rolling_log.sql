-- El Tronco Loco: 45 s arriba × 15 + 13 burbujas × 25 = 1000 como máximo.
-- Se puede perder las 3 vidas rápido, así que la duración mínima es baja.
insert into public.minigames (id, name, max_score, min_duration_ms)
values ('rolling_log', 'El Tronco Loco', 1000, 1000)
on conflict (id) do update
  set name = excluded.name,
      max_score = excluded.max_score,
      min_duration_ms = excluded.min_duration_ms;
