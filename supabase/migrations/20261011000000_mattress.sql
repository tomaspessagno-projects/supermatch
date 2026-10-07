-- El Colchón (en equipo): 3 rondas de 40 s, tope 1000 por ronda.
-- Las rondas duran siempre lo mismo, así que la duración mínima es alta.
insert into public.minigames (id, name, max_score, min_duration_ms)
values ('mattress', 'El Colchón', 1000, 30000)
on conflict (id) do update
  set name = excluded.name,
      max_score = excluded.max_score,
      min_duration_ms = excluded.min_duration_ms;
