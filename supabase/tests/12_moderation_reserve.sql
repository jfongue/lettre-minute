-- The reserve of words poured into the moderation queue: only for a
-- moderator who finished his queue last time, just enough for a session,
-- proposed by a house bot who is not paid for them.

select tests.new_user('rp');
select tests.new_user('rm');
select tests.make_moderator('rm');
select tests.new_user('rq');
select tests.make_moderator('rq');
select tests.new_user('rx');

insert into public.moderation_reserve (category_id, word, display)
select 'metiers', w, w
  from unnest(array['plombier', 'maçon', 'couvreur', 'carreleur', 'vitrier', 'serrurier', 'ramoneur', 'tailleur']) w;
insert into public.moderation_reserve (category_id, word, display)
values ('de:berufe', 'de:bäcker', 'Bäcker');
select tests.propose('rp', 'metiers', 'couvreur');
insert into public.dictionary_words (category_id, word, display) values ('metiers', 'vitrier', 'vitrier');

create function pg_temp.top_up(p_label text, p_lang text default 'fr') returns integer
language plpgsql as $$
declare
  v_released integer;
begin
  perform tests.login(p_label);
  v_released := public.top_up_moderation(p_lang);
  perform tests.logout();
  return v_released;
end;
$$;

create function pg_temp.waiting(p_label text, p_lang text default 'fr') returns integer
language plpgsql as $$
declare
  v_count integer;
begin
  perform tests.login(p_label);
  v_count := (select count(*)::integer from public.moderation_queue(p_lang, 20));
  perform tests.logout();
  return v_count;
end;
$$;

-- --------------------------------------------------------------- access --

select tests.is(pg_temp.top_up('rx'), 0, 'a player who is not a moderator gets nothing');
select tests.is((select count(*)::int from public.moderation_reserve where released_at is not null), 0,
                'and releases nothing');
select tests.login('rm');
select tests.is((select count(*)::int from public.moderation_reserve), 0, 'a moderator cannot read the reserve');
select tests.is((select count(*)::int from public.moderation_drained), 0, 'nor who finished his queue');
select tests.logout();
select tests.login_anon();
select tests.throws($$select public.top_up_moderation('fr')$$, 'nor topped up without a session', '42501');
select tests.logout();

-- ------------------------------------------------------------- the drip --

select tests.is(pg_temp.waiting('rm'), 1, 'one word waits from a player');
select tests.is(pg_temp.top_up('rm'), 0, 'a first visit to a short queue releases nothing');
select tests.is(pg_temp.top_up('rm'), 4, 'the next visit tops it up to a session');
select tests.is(pg_temp.waiting('rm'), 5, 'five words wait');
select tests.is((select count(*)::int from public.word_submissions s join public.bots b on b.id = s.player_id), 4,
                'a house bot proposes them');
select tests.ok(not exists (select 1 from public.word_submissions where word = 'vitrier'),
                'a word already in the dictionary is not proposed');
select tests.is((select count(*)::int from public.word_submissions where word = 'couvreur'), 1,
                'nor one a player already proposed');
select tests.is(pg_temp.top_up('rm'), 0, 'a full queue is not topped up');
select tests.is(pg_temp.top_up('rm', 'de'), 0, 'each language keeps its own count');

-- A moderator who votes down to under a session has finished it.
do $$
declare
  v_word record;
begin
  perform tests.login('rm');
  for v_word in select id from public.moderation_queue('fr', 20) loop
    perform public.cast_vote(v_word.id, 'correct');
  end loop;
  perform tests.logout();
end;
$$;
select tests.is(pg_temp.waiting('rm'), 0, 'his queue is empty');
select tests.ok(exists (select 1 from public.moderation_drained where moderator_id = tests.uid('rm') and lang = 'fr'),
                'his last vote marks it finished');
select tests.is(pg_temp.waiting('rq'), 5, 'another moderator still has those five');
select tests.is(pg_temp.top_up('rm'), 2, 'his next visit releases what the reserve has left, skipping what it cannot use');
select tests.is(pg_temp.top_up('rm'), 0, 'the visit right after releases nothing');

-- ---------------------------------------------------------------- reward --

create table xp0 as select id, xp from public.profiles;
select s.word as seed
  from public.word_submissions s join public.bots b on b.id = s.player_id
  join public.moderation_votes v on v.review_id = tests.review(s.category_id, s.word) and v.moderator_id = tests.uid('rm')
 limit 1 \gset
select tests.new_user('rz');
select tests.make_moderator('rz');
select tests.vote('rq', 'metiers', :'seed', 'correct');
select tests.is(tests.vote('rz', 'metiers', :'seed', 'correct'), 'accepted', 'a reserve word enters like any other');
select tests.ok(exists (select 1 from public.dictionary_words where category_id = 'metiers' and word = :'seed'),
                'into the dictionary');
select tests.ok(not exists (select 1 from public.profiles p join xp0 on xp0.id = p.id
                             where p.id in (select id from public.bots) and p.xp <> xp0.xp),
                'the house bot is not paid for it');
select tests.vote('rq', 'metiers', 'couvreur', 'correct');
select tests.vote('rz', 'metiers', 'couvreur', 'correct');
select tests.is(tests.xp('rp') - (select xp from xp0 where id = tests.uid('rp')), 150, 'a player still is');
