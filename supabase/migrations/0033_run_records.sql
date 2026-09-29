-- Le relevé d'une partie, écrit par l'appareil qui l'a jouée : ses mots avec
-- leur orthographe et le temps qu'ils ont mis à venir, les catégories qu'elle a
-- tirées, sa langue. La page des statistiques relit par là les parties d'un
-- compte, au lieu de ne connaître que celles gardées sur l'appareil.
--
-- `runs` et `run_words` suffisent à compter la rareté — la forme normalisée
-- d'un mot — mais pas à l'afficher : « cote d ivoire » n'est pas
-- « Côte d'Ivoire », et le temps par mot n'y est nulle part. Le client relit
-- ce relevé quand il est là, et recompose sans lui les parties d'avant.

alter table public.runs add column record jsonb;
