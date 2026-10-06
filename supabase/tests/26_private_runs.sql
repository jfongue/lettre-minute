-- Les parties d'un compte ne se lisent plus par les autres (0057) : ni les
-- scores, ni les graines, ni le relevé mot à mot. La part d'un mot continue de
-- se compter sur tout le monde, par la fonction derrière la vue.

select tests.new_user(n) from unnest(array['pa', 'pb']) n;

select tests.run_at('pa', now(), 30, array['p-mot']);
select tests.run_at('pa', now(), 20, array['p-mot']);
select tests.run_at('pb', now(), 40, array['p-mot', 'p-autre']);

select tests.login('pb');
select tests.is((select count(*)::int from public.runs), 1, 'a player reads only his own runs');
select tests.is((select count(*)::int from public.run_words), 2, 'and only the words of his own runs');
select tests.is((select count(*)::int from public.runs where player_id = tests.uid('pa')), 0,
                'another account''s run stays out of reach');
select tests.is((select count(*)::int from public.run_words w
                  join public.runs r on r.id = w.run_id where r.player_id = tests.uid('pa')), 0,
                'and so do its words');
select tests.is((select uses from public.word_popularity where word = 'p-mot'), 3,
                'the crowd usage still counts every run');
select tests.is((select count(*)::int from public.runs), 1, 'nothing else appeared meanwhile');
select tests.logout();
