-- Lettre Minute — schéma initial.
--
-- Trois choses vivent ici et nulle part ailleurs : l'identité d'un joueur et sa
-- progression, ce que les joueurs écrivent (qui sert à mesurer la rareté d'un
-- mot), et le dictionnaire communautaire qui vient compléter les listes
-- embarquées dans l'application.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profils --

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default 'Anonyme' check (char_length(display_name) between 1 and 24),
  xp integer not null default 0 check (xp >= 0),
  runs integer not null default 0 check (runs >= 0),
  best_score integer not null default 0 check (best_score >= 0),
  words_found integer not null default 0 check (words_found >= 0),
  best_combo integer not null default 0 check (best_combo >= 0),
  updated_at timestamptz not null default now()
);

-- Un joueur anonyme doit pouvoir jouer sans écran d'inscription : le profil
-- naît avec le compte plutôt qu'au premier enregistrement de partie.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------- parties --

-- Le tirage d'un jour est le même pour tout le monde : c'est ce qui rend un
-- classement quotidien comparable.
create table public.daily_challenges (
  day date primary key,
  seed bigint not null
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles on delete cascade,
  seed bigint not null,
  score integer not null check (score >= 0),
  words integer not null default 0 check (words >= 0),
  best_combo integer not null default 0 check (best_combo >= 0),
  skips integer not null default 0 check (skips >= 0),
  challenge_day date references public.daily_challenges on delete set null,
  created_at timestamptz not null default now()
);

create index runs_player_idx on public.runs (player_id, created_at desc);
create index runs_challenge_idx on public.runs (challenge_day, score desc);

-- Les mots d'une partie, forme normalisée : c'est la matière première du bonus
-- de rareté, pas un journal de jeu.
create table public.run_words (
  run_id uuid not null references public.runs on delete cascade,
  word text not null,
  category_id text not null,
  points integer not null default 0,
  primary key (run_id, word)
);

create index run_words_word_idx on public.run_words (word);

-- ---------------------------------------------------- dictionnaire vivant --

create table public.dictionary_words (
  category_id text not null,
  word text not null,
  display text not null,
  sitelinks integer not null default 0,
  frequency real not null default 0,
  source text not null default 'community' check (source in ('wikidata', 'community')),
  added_at timestamptz not null default now(),
  primary key (category_id, word)
);

create table public.word_submissions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles on delete cascade,
  category_id text not null,
  word text not null,
  display text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (player_id, category_id, word)
);

create index word_submissions_pending_idx on public.word_submissions (category_id, word) where status = 'pending';

create table public.moderators (
  id uuid primary key references public.profiles on delete cascade
);

create function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moderators where id = auth.uid());
$$;

-- Combien de joueurs distincts réclament un mot, et s'il est déjà entré.
create view public.submission_tally
with (security_invoker = off) as
  select category_id,
         word,
         min(display) as display,
         count(*)::integer as proposals,
         bool_or(status = 'accepted') as accepted
  from public.word_submissions
  group by category_id, word;

-- Un mot réclamé par assez de joueurs différents entre sans modérateur : c'est
-- la règle qui fait vivre le dictionnaire là où Wikidata est muet.
create function public.accept_word(p_category text, p_word text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_display text;
begin
  select min(display) into v_display
  from public.word_submissions
  where category_id = p_category and word = p_word;

  if v_display is null then
    return;
  end if;

  insert into public.dictionary_words (category_id, word, display, source)
  values (p_category, p_word, v_display, 'community')
  on conflict (category_id, word) do nothing;

  -- La récompense va à chaque joueur qui l'a réclamé, une seule fois : le
  -- passage à 'accepted' est ce qui la rend non rejouable.
  update public.profiles p
     set xp = p.xp + 150, updated_at = now()
    from public.word_submissions s
   where s.player_id = p.id
     and s.category_id = p_category
     and s.word = p_word
     and s.status <> 'accepted';

  update public.word_submissions
     set status = 'accepted'
   where category_id = p_category and word = p_word;
end;
$$;

create function public.auto_accept_word() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.word_submissions
  where category_id = new.category_id and word = new.word;

  if v_count >= 3 then
    perform public.accept_word(new.category_id, new.word);
  end if;

  return new;
end;
$$;

create trigger word_submissions_auto_accept
  after insert on public.word_submissions
  for each row execute function public.auto_accept_word();

-- ------------------------------------------------------------ classements --

create view public.leaderboard
with (security_invoker = off) as
  select id, display_name, best_score, xp, runs
  from public.profiles
  where runs > 0
  order by best_score desc
  limit 200;

-- Part des parties récentes où un mot est apparu. Le client s'en sert pour
-- éroder le bonus de rareté des mots que tout le monde écrit.
create view public.word_popularity
with (security_invoker = off) as
  select w.word,
         count(distinct w.run_id)::real / greatest((select count(*) from public.runs), 1) as share,
         count(*)::integer as uses
  from public.run_words w
  group by w.word
  having count(*) >= 3;

-- ------------------------------------------------------------------- RLS --

alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.run_words enable row level security;
alter table public.dictionary_words enable row level security;
alter table public.word_submissions enable row level security;
alter table public.moderators enable row level security;
alter table public.daily_challenges enable row level security;

-- Un profil est public en lecture : c'est ce que le classement affiche, et rien
-- de sensible n'y est stocké.
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_write_own on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy runs_read on public.runs for select to authenticated using (true);
create policy runs_insert_own on public.runs for insert to authenticated
  with check (auth.uid() = player_id);

create policy run_words_read on public.run_words for select to authenticated using (true);
create policy run_words_insert_own on public.run_words for insert to authenticated
  with check (exists (select 1 from public.runs r where r.id = run_id and r.player_id = auth.uid()));

create policy dictionary_read on public.dictionary_words for select to authenticated using (true);
create policy dictionary_write_moderator on public.dictionary_words for all to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

create policy submissions_read_own on public.word_submissions for select to authenticated
  using (auth.uid() = player_id or public.is_moderator());
create policy submissions_insert_own on public.word_submissions for insert to authenticated
  with check (auth.uid() = player_id);
create policy submissions_moderate on public.word_submissions for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

create policy moderators_read on public.moderators for select to authenticated
  using (public.is_moderator());

create policy daily_read on public.daily_challenges for select to authenticated using (true);

grant select on public.leaderboard, public.word_popularity, public.submission_tally to authenticated;
