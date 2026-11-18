-- 호감슬라이드 공유판 — 데이터베이스 설정
-- Supabase 대시보드 › SQL Editor › New query 에 이 파일 전체를 붙여 넣고 Run 을 누르세요.
-- 여러 번 실행해도 안전하게 만들어 두었어요.

create extension if not exists pgcrypto with schema extensions;

-- ───────────── 팀원 ─────────────
create table if not exists public.members (
  user_id   uuid primary key references auth.users on delete cascade,
  name      text not null unique,
  joined_at timestamptz not null default now()
);

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

create or replace function public.my_name() returns text
language sql stable security definer set search_path = public as $$
  select name from public.members where user_id = auth.uid();
$$;

-- ───────────── 곡 보관함 ─────────────
create table if not exists public.songs (
  title           text primary key,
  result          jsonb not null,
  thumb           text,
  created_by_name text,
  updated_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ───────────── 예배 기록 ─────────────
create table if not exists public.services (
  id              text primary key,
  name            text not null default '',
  text            text not null default '',
  results         jsonb not null default '[]'::jsonb,
  verse_in        text not null default '',
  b_title         text not null default '',
  dirty           boolean not null default false,
  created_by_name text,
  updated_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ───────────── 편집 기록 ─────────────
create table if not exists public.edit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  user_id     uuid,
  name        text,
  action      text not null,      -- create · edit · delete · join
  target_type text not null,      -- song · service · member
  target_id   text,
  summary     text
);
create index if not exists edit_log_at on public.edit_log (at desc);

-- ───────────── 2단계 추가 (2026-11) ─────────────
-- 판 번호: 저장할 때마다 1씩 올라가요. 내가 본 판보다 서버가 새로우면 덮어쓰지 않게 막는 데 써요.
alter table public.songs    add column if not exists version int not null default 1;
alter table public.services add column if not exists version int not null default 1;
-- 바뀌기 전 내용: 고치거나 지울 때 예전 모습을 남겨서 되돌릴 수 있게 해요.
alter table public.edit_log add column if not exists before jsonb;

-- 팀 암호를 틀린 기록 (signup 기능만 써요. 화면에서는 볼 수 없어요)
create table if not exists public.signup_attempts (
  id bigint generated always as identity primary key,
  ip text,
  at timestamptz not null default now()
);
create index if not exists signup_attempts_at on public.signup_attempts (at desc);

-- AI를 쓴 기록 (ai 기능만 써요. 한 사람이 하루 한도를 다 쓰지 않게)
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists ai_usage_user_at on public.ai_usage (user_id, at desc);

-- ───────────── 3단계 추가 (2026-11) ─────────────
-- 팀이 함께 쓰는 설정: 슬라이드 모양(look), 곡 색(songColors), 자막 양식(fmt), 말씀 설정(bset),
-- 저장한 양식(mine), 배경 사진·로고(media.song / media.word / media.logo)
create table if not exists public.team_settings (
  key             text primary key,
  value           jsonb,
  updated_by_name text,
  updated_at      timestamptz not null default now()
);
create or replace function public.stamp_setting() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_by_name := public.my_name();
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists team_settings_stamp on public.team_settings;
create trigger team_settings_stamp before insert or update on public.team_settings for each row execute function public.stamp_setting();

-- ───────────── 4단계 추가 (2026-11): 곡 보관함 강화 ─────────────
-- 찬송가 번호, 가사를 확인한 사람·때. 가사가 바뀌면 '확인됨'은 저절로 풀려요.
alter table public.songs add column if not exists hymn        int;
alter table public.songs add column if not exists verified_by text;
alter table public.songs add column if not exists verified_at timestamptz;
create or replace function public.song_verify_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.result is distinct from old.result and new.verified_at is not distinct from old.verified_at then
    new.verified_by := null; new.verified_at := null;           -- 가사가 바뀌었으니 다시 확인해야 해요
  elsif new.verified_at is not null and (tg_op = 'INSERT' or old.verified_at is null or new.verified_at is distinct from old.verified_at) then
    new.verified_by := public.my_name(); new.verified_at := now(); -- 확인한 사람은 서버가 직접 적어요
  elsif new.verified_at is null then
    new.verified_by := null;
  else
    new.verified_by := old.verified_by;                          -- 확인한 사람 이름을 화면에서 바꿀 수 없게
  end if;
  return new;
end $$;

-- 누가 고쳤는지는 서버가 직접 적어요 (화면에서 이름을 꾸며 넣을 수 없게)
create or replace function public.stamp_editor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_by_name := public.my_name();
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by_name := new.updated_by_name;
    new.created_at := now();
    new.version := 1;
  else
    new.created_by_name := old.created_by_name;
    new.created_at := old.created_at;
    new.version := coalesce(old.version, 0) + 1;
  end if;
  return new;
end $$;

-- 바뀔 때마다 편집 기록을 남겨요. 같은 사람이 같은 것을 10분 안에 계속 고치면 한 줄로 묶어요.
create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_type text := case tg_table_name when 'songs' then 'song' else 'service' end;
  v_id   text;
  v_sum  text;
  v_act  text := case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'edit' else 'delete' end;
  v_name text := public.my_name();
  v_last bigint;
  -- 고치거나 지울 때는 바뀌기 전 모습을 남겨요 (10분 안에 이어 고친 것은 처음 모습이 남아요)
  v_before jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
begin
  if tg_op = 'DELETE' then
    if tg_table_name = 'songs' then v_id := old.title; v_sum := old.title;
    else v_id := old.id; v_sum := old.name; end if;
  else
    if tg_table_name = 'songs' then v_id := new.title; v_sum := new.title;
    else v_id := new.id; v_sum := new.name; end if;
  end if;
  if v_act = 'edit' then
    select id into v_last from public.edit_log
      where user_id = auth.uid() and target_type = v_type and target_id = v_id
        and action in ('edit','create') and at > now() - interval '10 minutes'
      order by at desc limit 1;
    if v_last is not null then
      update public.edit_log set at = now(), summary = v_sum where id = v_last;
      return null;
    end if;
  end if;
  insert into public.edit_log (user_id, name, action, target_type, target_id, summary, before)
    values (auth.uid(), v_name, v_act, v_type, v_id, v_sum, v_before);
  return null;
end $$;

-- 예배 기록 저장: 내가 본 판(p_base)이 서버의 판과 같을 때만 저장해요.
-- 그사이 다른 사람이 고쳤으면 저장하지 않고 {ok:false, by:고친 사람}을 돌려줘요.
create or replace function public.save_service(
  p_id text, p_base int, p_name text, p_text text, p_results jsonb,
  p_verse_in text, p_b_title text, p_dirty boolean
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare cur public.services;
begin
  if not public.is_member() then raise exception '팀원만 저장할 수 있어요'; end if;
  select * into cur from public.services where id = p_id for update;
  if not found then
    insert into public.services (id, name, text, results, verse_in, b_title, dirty)
      values (p_id, p_name, p_text, p_results, p_verse_in, p_b_title, p_dirty)
      returning * into cur;
    return jsonb_build_object('ok', true, 'version', cur.version);
  end if;
  if p_base is distinct from cur.version then
    return jsonb_build_object('ok', false, 'version', cur.version, 'by', cur.updated_by_name, 'at', cur.updated_at);
  end if;
  update public.services
     set name = p_name, text = p_text, results = p_results, verse_in = p_verse_in, b_title = p_b_title, dirty = p_dirty
   where id = p_id
   returning * into cur;
  return jsonb_build_object('ok', true, 'version', cur.version);
end $$;

-- 편집 기록의 '되돌리기': 그 기록에 남은 바뀌기 전 모습으로 되돌려요. 지운 것도 되살려요.
-- 되돌린 일도 편집 기록에 남아서, 되돌리기를 다시 되돌릴 수 있어요.
create or replace function public.restore_from_log(p_log_id bigint) returns text
language plpgsql security invoker set search_path = public as $$
declare r public.edit_log; b jsonb;
begin
  if not public.is_member() then raise exception '팀원만 되돌릴 수 있어요'; end if;
  select * into r from public.edit_log where id = p_log_id;
  if not found or r.before is null then return '되돌릴 내용이 없는 기록이에요'; end if;
  b := r.before;
  if r.target_type = 'song' then
    insert into public.songs (title, result, thumb)
      values (b->>'title', b->'result', b->>'thumb')
      on conflict (title) do update set result = excluded.result, thumb = excluded.thumb;
    return '‘' || (b->>'title') || '’ 곡을 되돌렸어요';
  elsif r.target_type = 'service' then
    insert into public.services (id, name, text, results, verse_in, b_title, dirty)
      values (b->>'id', coalesce(b->>'name',''), coalesce(b->>'text',''), coalesce(b->'results','[]'::jsonb),
              coalesce(b->>'verse_in',''), coalesce(b->>'b_title',''), coalesce((b->>'dirty')::boolean, false))
      on conflict (id) do update set name = excluded.name, text = excluded.text, results = excluded.results,
        verse_in = excluded.verse_in, b_title = excluded.b_title, dirty = excluded.dirty;
    return '‘' || coalesce(b->>'name','예배') || '’ 기록을 되돌렸어요';
  end if;
  return '되돌릴 수 없는 기록이에요';
end $$;

drop trigger if exists songs_stamp on public.songs;
create trigger songs_stamp before insert or update on public.songs for each row execute function public.stamp_editor();
drop trigger if exists songs_verify on public.songs;
create trigger songs_verify before insert or update on public.songs for each row execute function public.song_verify_guard();
drop trigger if exists songs_log on public.songs;
create trigger songs_log after insert or update or delete on public.songs for each row execute function public.log_change();

drop trigger if exists services_stamp on public.services;
create trigger services_stamp before insert or update on public.services for each row execute function public.stamp_editor();
drop trigger if exists services_log on public.services;
create trigger services_log after insert or update or delete on public.services for each row execute function public.log_change();

-- ───────────── 접근 규칙: 팀원만 ─────────────
alter table public.members  enable row level security;
alter table public.songs    enable row level security;
alter table public.services enable row level security;
alter table public.edit_log enable row level security;
-- 이 두 표는 서버 기능(service_role)만 써요. 규칙을 하나도 두지 않아서 화면에서는 읽지도 쓰지도 못해요.
alter table public.signup_attempts enable row level security;
alter table public.ai_usage        enable row level security;
alter table public.team_settings   enable row level security;

drop policy if exists "팀원은 팀 설정을 써요" on public.team_settings;
create policy "팀원은 팀 설정을 써요" on public.team_settings for all using (public.is_member()) with check (public.is_member());

drop policy if exists "팀원은 팀원 목록을 봐요" on public.members;
create policy "팀원은 팀원 목록을 봐요" on public.members for select using (public.is_member());

drop policy if exists "팀원은 곡 보관함을 써요" on public.songs;
create policy "팀원은 곡 보관함을 써요" on public.songs for all using (public.is_member()) with check (public.is_member());

drop policy if exists "팀원은 예배 기록을 써요" on public.services;
create policy "팀원은 예배 기록을 써요" on public.services for all using (public.is_member()) with check (public.is_member());

drop policy if exists "팀원은 편집 기록을 봐요" on public.edit_log;
create policy "팀원은 편집 기록을 봐요" on public.edit_log for select using (public.is_member());

-- ───────────── 다른 사람이 고친 것을 바로 보기 ─────────────
do $$ begin
  begin alter publication supabase_realtime add table public.songs;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.services; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.edit_log; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.team_settings; exception when duplicate_object then null; end;
end $$;

-- ───────────── 잠들지 않게 깨우는 신호 (GitHub가 사흘마다 불러요) ─────────────
create or replace function public.ping() returns int language sql stable as $$ select 1 $$;
grant execute on function public.ping() to anon, authenticated;

-- ───────────── 관리자용: 암호를 잊은 팀원 암호 바꾸기 ─────────────
-- SQL Editor에서만 쓰세요:  select public.reset_password('김목자', '새암호123');
create or replace function public.reset_password(p_name text, p_new text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid;
begin
  select user_id into v_uid from public.members where name = p_name;
  if v_uid is null then return '그 이름의 팀원이 없어요'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_new, extensions.gen_salt('bf')) where id = v_uid;
  return p_name || ' 님의 암호를 바꿨어요';
end $$;
revoke execute on function public.reset_password(text, text) from public, anon, authenticated;
revoke execute on function public.my_name() from anon;

-- ───────────── 서버와 화면이 표를 쓸 수 있게 허락 ─────────────
-- (2026년 5월 이후 만든 Supabase 프로젝트는 표를 자동으로 열어 주지 않아서, 직접 허락해야 해요)
grant usage on schema public to anon, authenticated, service_role;
grant select on public.members to authenticated;
grant select, insert, update, delete on public.members, public.songs, public.services, public.edit_log to service_role;
grant select, insert, update, delete on public.songs, public.services to authenticated;
grant select on public.edit_log to authenticated;
grant select, insert, delete on public.signup_attempts, public.ai_usage to service_role;
grant select, insert, update, delete on public.team_settings to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke execute on function public.save_service(text, int, text, text, jsonb, text, text, boolean) from public, anon;
revoke execute on function public.restore_from_log(bigint) from public, anon;
grant execute on function public.save_service(text, int, text, text, jsonb, text, text, boolean) to authenticated;
grant execute on function public.restore_from_log(bigint) to authenticated;
grant execute on function public.is_member(), public.my_name() to authenticated, service_role;
grant execute on function public.ping() to anon, authenticated;
