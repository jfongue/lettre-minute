-- Deux joueurs maison, Maxitoon et Terretciel, pour que les classements et la
-- liste d'amis ne soient jamais vides.
--
-- Ils jouent côté serveur, par pg_cron : aucune machine à garder allumée.
-- Leurs parties n'ont pas de mots (`run_words`) : un mot écrit par un robot
-- fausserait la rareté que voient les vrais joueurs, et leur volerait des
-- découvertes. Ils figurent donc aux classements de score, jamais à celui des
-- découvertes.

create extension if not exists pg_cron with schema pg_catalog;

-- Une partie « pas dingue » : les vraies parties tournent autour de 50 points
-- de médiane et 90 de moyenne. Chaque robot tire son score entre ses bornes.
create table public.bots (
  id uuid primary key references public.profiles on delete cascade,
  min_score integer not null check (min_score >= 0),
  max_score integer not null check (max_score > min_score),
  -- Chance de jouer à un passage horaire : un joueur qui ne rate jamais une
  -- heure ne ressemble à personne.
  play_chance real not null default 0.6 check (play_chance between 0 and 1)
);

alter table public.bots enable row level security;

-- Des comptes d'auth sans mot de passe utilisable : personne ne s'y connecte,
-- mais ils sont nommés (`is_anonymous = false`), donc visibles aux classements
-- et trouvables par une demande d'ami. Les jetons vides plutôt que nuls évitent
-- à GoTrue de lever s'il lit un jour ces lignes.
do $$
declare
  v_bot record;
  v_id uuid;
begin
  for v_bot in
    select * from (values
      ('Maxitoon',   'maxitoon@bots.lettre-minute.invalid',   40, 120, 0.6, '{"design": 1, "ground": "jaune", "shape": "noir", "accent": "rouge"}'::jsonb),
      ('Terretciel', 'terretciel@bots.lettre-minute.invalid', 20,  90, 0.5, '{"design": 3, "ground": "bleu", "shape": "jaune", "accent": "noir"}'::jsonb)
    ) as t(name, email, min_score, max_score, play_chance, avatar)
  loop
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_bot.email, '', now(),
      '{"provider": "email", "providers": ["email"]}', '{}', now(), now(), false,
      '', '', '', ''
    );
    -- Le profil est né du déclencheur `on_auth_user_created`.
    update public.profiles set display_name = v_bot.name, avatar = v_bot.avatar where id = v_id;
    insert into public.bots (id, min_score, max_score, play_chance)
      values (v_id, v_bot.min_score, v_bot.max_score, v_bot.play_chance);
  end loop;
end;
$$;

-- Une demande adressée à un robot est acceptée dès son arrivée : attendre le
-- passage horaire laisserait le joueur devant « demande envoyée » sans raison.
create function public.bots_accept_friend() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.bots where id = new.addressee) then
    new.status := 'accepted';
  end if;
  return new;
end;
$$;

create trigger friendships_bots_accept
  before insert on public.friendships
  for each row execute function public.bots_accept_friend();

-- Un passage horaire : chaque robot joue peut-être une partie, et le profil
-- avance comme `pushRun` le ferait (1 XP par point). Personne ne joue la nuit.
create function public.bots_play() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_bot record;
  v_score integer;
  v_words integer;
  v_combo integer;
begin
  if extract(hour from now() at time zone 'Europe/Paris') between 1 and 7 then
    return;
  end if;

  for v_bot in select * from public.bots loop
    continue when random() >= v_bot.play_chance;

    v_score := v_bot.min_score + floor(random() * (v_bot.max_score - v_bot.min_score + 1))::integer;
    v_words := greatest(1, round(v_score / 12.0 + random() * 2 - 1)::integer);
    v_combo := least(v_words, 1 + floor(random() * 5)::integer);

    insert into public.runs (player_id, seed, score, words, best_combo, skips)
      values (v_bot.id, floor(random() * 2147483647)::bigint, v_score, v_words, v_combo,
              floor(random() * 5)::integer);

    update public.profiles
       set xp = xp + v_score,
           runs = runs + 1,
           best_score = greatest(best_score, v_score),
           words_found = words_found + v_words,
           best_combo = greatest(best_combo, v_combo),
           updated_at = now()
     where id = v_bot.id;
  end loop;
end;
$$;

revoke execute on function public.bots_play() from public, anon, authenticated;
revoke execute on function public.bots_accept_friend() from public, anon, authenticated;

-- Minute 17 plutôt que 0 : les tâches planifiées de tout le monde tombent à
-- l'heure pile.
select cron.schedule('house-bots', '17 * * * *', 'select public.bots_play()');

-- Une première partie tout de suite, pour qu'ils figurent au classement du jour.
select public.bots_play();
