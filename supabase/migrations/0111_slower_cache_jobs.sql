-- Le 24 novembre au matin, la base était de nouveau à court de disque : son
-- budget d'entrées-sorties épuisé, écrire 21 pages prenait 7,7 s, et le cache
-- des classements (0110), refait chaque minute, dépassait ses 50 s à chaque
-- passage — une charge sans pause, celle-là même qu'il devait éviter. Les
-- tâches de cache passent à un rythme que ce disque tient : les classements
-- toutes les cinq minutes, les découvertes du jour et de la semaine et celles
-- de toujours une fois par heure. La ligne du joueur qui demande reste lue en
-- direct : son propre score s'affiche toujours aussitôt.
select cron.schedule('boards-cache', '*/5 * * * *', 'set statement_timeout = ''50s''; select public.refresh_boards(false)');
select cron.schedule('boards-cache-heavy', '7 * * * *', 'set statement_timeout = ''120s''; select public.refresh_boards(true)');
select cron.schedule('discoveries-all', '41 * * * *', 'set statement_timeout = ''120s''; select public.refresh_discoveries()');
