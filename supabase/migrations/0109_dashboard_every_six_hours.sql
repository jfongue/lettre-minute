-- Chaque relevé relit `events` environ neuf fois, une par section (près de
-- 500 Mo) : toutes les dix minutes, c'est ce qui a vidé le budget disque le
-- 23 novembre, et même à l'heure il ne le laisse pas se reconstituer. Le
-- relevé passe à toutes les six heures, jusqu'à ce que ses sections lisent
-- un cumul comme la rétention (0108) ; à ce rythme, il a cinq minutes pour
-- finir même sur un disque bridé.
select cron.schedule('dashboard-cache', '3 */6 * * *',
  'set statement_timeout = ''300s''; select public.refresh_dashboard()');
