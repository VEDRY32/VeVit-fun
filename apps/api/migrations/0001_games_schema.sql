-- Schéma `games` (D-009).
--
-- Zapisuje výhradně API se service rolí. RLS je zapnuté i tak a pro role
-- `anon` a `authenticated` je **deny-all** — kdyby se klientský klíč někdy
-- dostal do prohlížeče, nedostane z databáze nic.
--
-- `user_id` je text, protože identitu drží vlastní SSO, ne `auth.uid()`.

create schema if not exists games;

-- --- Hráči -----------------------------------------------------------------
-- Musí být první: score_runs i další tabulky na ni odkazují cizím klíčem.

create table if not exists games.users (
  id          text primary key,
  nickname    text not null,
  role        text not null default 'player' check (role in ('player', 'moderator', 'admin')),
  created_at  timestamptz not null default now()
);

-- --- Katalog ---------------------------------------------------------------

create table if not exists games.games (
  slug            text primary key,
  category        text not null,
  rules_version   integer not null default 1,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- --- Běhy a skóre ----------------------------------------------------------

create type games.run_status as enum ('pending', 'validated', 'rejected', 'flagged');

create table if not exists games.score_runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         text references games.users(id) on delete set null,
  game_slug       text not null references games.games(slug) on delete cascade,
  mode            text not null,
  score           bigint not null,
  duration_ms     integer not null,
  seed            text not null,
  -- Komprimovaný záznam vstupů pro serverovou validaci.
  replay          bytea,
  client_version  text,
  status          games.run_status not null default 'pending',
  reject_reason   text,
  created_at      timestamptz not null default now()
);

create index if not exists score_runs_board_idx
  on games.score_runs (game_slug, mode, status, score desc, created_at);
create index if not exists score_runs_user_idx
  on games.score_runs (user_id, created_at desc);

-- Jeden rozpracovaný hodnocený běh na hráče a hru — brání sbírání seedů
-- do zásoby a jejich pozdějšímu přehrávání.
create unique index if not exists score_runs_one_pending_idx
  on games.score_runs (user_id, game_slug, mode)
  where status = 'pending' and user_id is not null;

-- --- Žebříčky --------------------------------------------------------------

create table if not exists games.leaderboards (
  game_slug   text not null references games.games(slug) on delete cascade,
  mode        text not null,
  period      text not null check (period in ('day', 'week', 'all')),
  period_key  text not null,
  user_id     text not null,
  nickname    text not null,
  score       bigint not null,
  run_id      uuid references games.score_runs(id) on delete cascade,
  updated_at  timestamptz not null default now(),
  primary key (game_slug, mode, period, period_key, user_id)
);

create index if not exists leaderboards_rank_idx
  on games.leaderboards (game_slug, mode, period, period_key, score desc);

-- --- Denní výzvy -----------------------------------------------------------

create table if not exists games.daily_challenges (
  challenge_date  date not null,
  game_slug       text not null references games.games(slug) on delete cascade,
  seed            text not null,
  params          jsonb not null default '{}'::jsonb,
  primary key (challenge_date, game_slug)
);

-- Odpovědi slovních her stojí zvlášť. Tahle tabulka nemá **žádný** grant
-- pro anon ani authenticated a nikdy se neservíruje klientovi (zadání 3.3).
create table if not exists games.daily_answers (
  challenge_date  date not null,
  game_slug       text not null,
  answer          text not null,
  -- Předpočítané pořadí slov pro hru Přihořívá.
  extra           jsonb,
  primary key (challenge_date, game_slug)
);

-- --- Statistiky hráčů ------------------------------------------------------

create table if not exists games.user_game_stats (
  user_id       text not null references games.users(id) on delete cascade,
  game_slug     text not null references games.games(slug) on delete cascade,
  plays         integer not null default 0,
  best_score    bigint,
  streak_days   integer not null default 0,
  favorite      boolean not null default false,
  last_played   timestamptz,
  primary key (user_id, game_slug)
);

create table if not exists games.achievements (
  id          text primary key,
  game_slug   text references games.games(slug) on delete cascade,
  title_cs    text not null,
  title_en    text not null,
  hidden      boolean not null default false
);

create table if not exists games.user_achievements (
  user_id         text not null references games.users(id) on delete cascade,
  achievement_id  text not null references games.achievements(id) on delete cascade,
  unlocked_at     timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- --- Multiplayer -----------------------------------------------------------

create table if not exists games.matches (
  id          uuid primary key default gen_random_uuid(),
  game_slug   text not null references games.games(slug) on delete cascade,
  mode        text not null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

create table if not exists games.match_players (
  match_id    uuid not null references games.matches(id) on delete cascade,
  user_id     text references games.users(id) on delete set null,
  nickname    text not null,
  placement   integer,
  score       bigint,
  rating_delta integer,
  primary key (match_id, nickname)
);

-- Glicko-2 na hru: hodnocení, odchylka a volatilita.
create table if not exists games.ratings (
  user_id     text not null references games.users(id) on delete cascade,
  game_slug   text not null references games.games(slug) on delete cascade,
  rating      numeric not null default 1500,
  deviation   numeric not null default 350,
  volatility  numeric not null default 0.06,
  updated_at  timestamptz not null default now(),
  primary key (user_id, game_slug)
);

-- --- Uložené pozice, hlášení, úrovně z editorů -----------------------------

create table if not exists games.saves (
  user_id     text not null references games.users(id) on delete cascade,
  game_slug   text not null references games.games(slug) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, game_slug),
  -- Limit odpovídá MAX_SAVE_BYTES v enginu.
  constraint saves_size_limit check (pg_column_size(data) <= 65536)
);

create table if not exists games.reports (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('nickname', 'chat', 'drawing', 'level')),
  target_id     text not null,
  reporter_id   text references games.users(id) on delete set null,
  reason        text,
  resolved      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists games.user_levels (
  id            uuid primary key default gen_random_uuid(),
  game_slug     text not null references games.games(slug) on delete cascade,
  author_id     text references games.users(id) on delete set null,
  title         text not null,
  data          jsonb not null,
  moderation    text not null default 'pending'
                check (moderation in ('pending', 'approved', 'rejected')),
  plays         integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists user_levels_queue_idx
  on games.user_levels (moderation, created_at);

-- --- Sezení ----------------------------------------------------------------

-- Uložen je jen hash tokenu; z databáze se relace zpětně nedá použít.
create table if not exists games.sessions (
  token_hash  text primary key,
  user_id     text not null references games.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  last_seen   timestamptz not null default now()
);

create index if not exists sessions_expiry_idx on games.sessions (expires_at);

-- --- RLS -------------------------------------------------------------------
-- Zapnuté všude, bez jediné permisivní politiky pro anon/authenticated.
-- Service role RLS obchází, takže API funguje; klient nedostane nic.

do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'games'
  loop
    execute format('alter table games.%I enable row level security', t.tablename);
    execute format('alter table games.%I force row level security', t.tablename);
  end loop;
end $$;

revoke all on all tables in schema games from anon, authenticated;
revoke all on schema games from anon, authenticated;
