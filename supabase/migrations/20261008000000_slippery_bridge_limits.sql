-- El Puente Resbaladizo puede terminar en ~1,8 s (al agua en el primer charco),
-- así que el mínimo provisorio de 5 s rechazaría partidas legítimas.
-- Espejo de SERVER_LIMITS en src/game/scenes/slippery-bridge/tuning.ts:
-- los tests de la simulación garantizan que ninguna partida baja de este mínimo
-- ni supera el puntaje máximo.
update public.minigames
   set max_score = 1000,
       min_duration_ms = 1000
 where id = 'slippery_bridge';
