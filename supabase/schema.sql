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

-- 옛 팀 암호 가입에서 쓰던 표를 지워요 (이제 초대 코드로만 들어와요)
drop table if exists public.signup_attempts;

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
  if tg_op = 'UPDATE' and new.church_id is distinct from old.church_id then raise exception '다른 교회로 옮길 수 없어요'; end if;
  new.updated_by_name := public.my_name(new.church_id);
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
    new.verified_by := public.my_name(new.church_id); new.verified_at := now(); -- 확인한 사람은 서버가 직접 적어요
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
  -- 두 교회에 속한 사람이 한 교회 것을 다른 교회로 옮기지 못하게
  if tg_op = 'UPDATE' and new.church_id is distinct from old.church_id then raise exception '다른 교회로 옮길 수 없어요'; end if;
  new.updated_by_name := public.my_name(new.church_id);
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
  v_last bigint;
  -- 고치거나 지울 때는 바뀌기 전 모습을 남겨요 (10분 안에 이어 고친 것은 처음 모습이 남아요)
  v_before jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_church uuid := case tg_op when 'DELETE' then old.church_id else new.church_id end;
  v_name text := public.my_name(v_church);
begin
  if tg_op = 'DELETE' then
    if tg_table_name = 'songs' then v_id := old.title; v_sum := old.title;
    else v_id := old.id; v_sum := old.name; end if;
  else
    if tg_table_name = 'songs' then v_id := new.title; v_sum := new.title;
    else v_id := new.id; v_sum := new.name; end if;
  end if;
  -- 휴지통에 넣기·되돌리기는 내용 고치기와 따로 적어요
  if tg_table_name = 'services' and tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then v_act := 'delete';
    elsif old.deleted_at is not null and new.deleted_at is null then v_act := 'restore'; end if;
  end if;
  if v_act = 'edit' then
    select id into v_last from public.edit_log
      where user_id = auth.uid() and church_id = v_church and target_type = v_type and target_id = v_id
        and action in ('edit','create') and at > now() - interval '10 minutes'
      order by at desc limit 1;
    if v_last is not null then
      update public.edit_log set at = now(), summary = v_sum where id = v_last;
      return null;
    end if;
  end if;
  insert into public.edit_log (church_id, user_id, name, action, target_type, target_id, summary, before)
    values (v_church, auth.uid(), v_name, v_act, v_type, v_id, v_sum, v_before);
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
  -- 여러 교회에 속했는데 어느 교회인지 안 알리면 저장하지 않아요 (엉뚱한 교회에 들어가지 않게)
  if public.my_church() is null then raise exception '팀원만 저장할 수 있어요'; end if;
  select * into cur from public.services where id = p_id for update;
  if not found then
    insert into public.services (id, name, text, results, verse_in, b_title, dirty)
      values (p_id, p_name, p_text, p_results, p_verse_in, p_b_title, p_dirty)
      returning * into cur;
    return jsonb_build_object('ok', true, 'version', cur.version);
  end if;
  if p_base is distinct from cur.version then
    return jsonb_build_object('ok', false, 'version', cur.version, 'by', coalesce(cur.deleted_by_name, cur.updated_by_name), 'at', cur.updated_at, 'trashed', cur.deleted_at is not null);
  end if;
  update public.services
     set name = p_name, text = p_text, results = p_results, verse_in = p_verse_in, b_title = p_b_title, dirty = p_dirty,
         deleted_at = null -- 휴지통에 있던 것을 '내 글로 저장'하면 되살아나요
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
  if public.my_church() is null then raise exception '팀원만 되돌릴 수 있어요'; end if;
  select * into r from public.edit_log where id = p_log_id;
  if not found or r.before is null then return '되돌릴 내용이 없는 기록이에요'; end if;
  b := r.before;
  if r.target_type = 'song' then
    insert into public.songs (church_id, title, result, thumb)
      values (coalesce((b->>'church_id')::uuid, public.my_church()), b->>'title', b->'result', b->>'thumb')
      on conflict (church_id, title) do update set result = excluded.result, thumb = excluded.thumb;
    return '‘' || (b->>'title') || '’ 곡을 되돌렸어요';
  elsif r.target_type = 'service' then
    insert into public.services (church_id, id, name, text, results, verse_in, b_title, dirty)
      values (coalesce((b->>'church_id')::uuid, public.my_church()), b->>'id', coalesce(b->>'name',''), coalesce(b->>'text',''), coalesce(b->'results','[]'::jsonb),
              coalesce(b->>'verse_in',''), coalesce(b->>'b_title',''), coalesce((b->>'dirty')::boolean, false))
      on conflict (id) do update set name = excluded.name, text = excluded.text, results = excluded.results,
        verse_in = excluded.verse_in, b_title = excluded.b_title, dirty = excluded.dirty, deleted_at = null;
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
-- 아래 ai_usage 는 서버 기능(service_role)만 써요. 규칙을 하나도 두지 않아서 화면에서는 읽지도 쓰지도 못해요.
alter table public.ai_usage        enable row level security;
alter table public.team_settings   enable row level security;

-- 누가 무엇을 보고 쓰는지 정하는 규칙은 맨 아래 '6단계'에 모아 뒀어요 (교회 칸이 생긴 뒤라야 만들 수 있어서요).

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
  if (select count(*) from public.members where name = p_name) > 1 then
    return '같은 이름이 여러 교회에 있어요. Authentication › Users 에서 바꿔 주세요';
  end if;
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
grant select, insert, delete on public.ai_usage to service_role;
grant select, insert, update, delete on public.team_settings to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke execute on function public.save_service(text, int, text, text, jsonb, text, text, boolean) from public, anon;
revoke execute on function public.restore_from_log(bigint) from public, anon;
grant execute on function public.save_service(text, int, text, text, jsonb, text, text, boolean) to authenticated;
grant execute on function public.restore_from_log(bigint) to authenticated;
grant execute on function public.is_member(), public.my_name() to authenticated, service_role;
grant execute on function public.ping() to anon, authenticated;

-- ───────────── 5단계 추가 (2026-11-22): 교회별 공간 ① 교회 칸 ─────────────
-- 서버 하나에 여러 교회가 들어올 준비예요. 지금 있는 것은 모두 옥수교회 것으로 옮겨요.
-- 이번 단계에서는 화면이 바뀌지 않아요. 교회끼리 서로 못 보게 잠그는 건 다음 단계예요.
create table if not exists public.churches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);
alter table public.churches add column if not exists suspended_at timestamptz; -- 멈춘 교회 (11단계)
-- 옥수교회는 번호를 고정해 둬요 (이 파일을 여러 번 돌려도 한 번만 들어가게)
insert into public.churches (id, name) values ('00000000-0000-0000-0000-000000000001', '옥수교회')
  on conflict (id) do nothing;

alter table public.members       add column if not exists church_id uuid references public.churches;
alter table public.songs         add column if not exists church_id uuid references public.churches;
alter table public.services      add column if not exists church_id uuid references public.churches;
alter table public.team_settings add column if not exists church_id uuid references public.churches;
alter table public.edit_log      add column if not exists church_id uuid references public.churches;
-- 교회 표시를 붙이는 건 '고친 것'이 아니라서, 그동안 고친 사람·편집 기록 남기기를 꺼 둬요
-- (안 끄면 곡마다 이름 없는 '고침' 기록이 생기고 고친 사람·때·판 번호가 바뀌어요. 2026-11-22 실제로 겪음)
alter table public.songs         disable trigger user;
alter table public.services      disable trigger user;
alter table public.team_settings disable trigger user;
update public.members       set church_id = '00000000-0000-0000-0000-000000000001' where church_id is null;
update public.songs         set church_id = '00000000-0000-0000-0000-000000000001' where church_id is null;
update public.services      set church_id = '00000000-0000-0000-0000-000000000001' where church_id is null;
update public.team_settings set church_id = '00000000-0000-0000-0000-000000000001' where church_id is null;
update public.edit_log      set church_id = '00000000-0000-0000-0000-000000000001' where church_id is null;
alter table public.songs         enable trigger user;
alter table public.services      enable trigger user;
alter table public.team_settings enable trigger user;

-- 화면이 요청마다 'x-church'로 알리는 지금 교회. 안 알리면 null, 이상한 값이면 없는 교회(0번)로 봐요.
create or replace function public.req_church() returns uuid
language sql stable set search_path = public as $$
  select case when h is null or h = '' then null
              when h ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then h::uuid
              else '00000000-0000-0000-0000-000000000000'::uuid end
    from (select nullif(current_setting('request.headers', true), '')::json ->> 'x-church' as h) x;
$$;
revoke execute on function public.req_church() from public, anon, authenticated;

-- 지금 로그인한 사람의 지금 교회. 알린 교회의 팀원이 아니면 null.
-- 안 알렸을 때는 한 교회에만 속한 사람만 그 교회로 봐요 (여러 곳이면 짐작하지 않아요).
create or replace function public.my_church() returns uuid
language sql stable security definer set search_path = public as $$
  select case when count(*) = 1 then (array_agg(church_id))[1] end
    from public.members
   where user_id = auth.uid() and (public.req_church() is null or church_id = public.req_church())
     and church_id in (select id from public.churches where suspended_at is null);
$$;
create or replace function public.my_name(c uuid) returns text
language sql stable security definer set search_path = public as $$
  select name from public.members where user_id = auth.uid() and church_id = c;
$$;
create or replace function public.my_name() returns text
language sql stable security definer set search_path = public as $$
  select public.my_name(public.my_church());
$$;
revoke execute on function public.my_name(uuid) from public, anon;
grant execute on function public.my_name(uuid) to authenticated, service_role;
revoke execute on function public.my_church() from public, anon;
grant execute on function public.my_church() to authenticated, service_role;

-- 새로 저장하는 것은 서버가 교회를 채워요. 그래서 화면 코드는 그대로 둬요.
alter table public.songs         alter column church_id set default public.my_church();
alter table public.services      alter column church_id set default public.my_church();
alter table public.team_settings alter column church_id set default public.my_church();
-- 임시: 옛 가입은 교회를 몰라서 옥수교회로 넣었어요. 이 기본값은 8단계에서 없애요.
alter table public.members  alter column church_id set default coalesce(public.my_church(), '00000000-0000-0000-0000-000000000001');
alter table public.edit_log alter column church_id set default coalesce(public.my_church(), '00000000-0000-0000-0000-000000000001');
alter table public.members       alter column church_id set not null;
alter table public.songs         alter column church_id set not null;
alter table public.services      alter column church_id set not null;
alter table public.team_settings alter column church_id set not null;
alter table public.edit_log      alter column church_id set not null;

-- 곡 이름·설정 이름은 교회 안에서만 겹치지 않으면 돼요
do $$ begin
  if (select array_length(indkey::int2[], 1) from pg_index where indrelid = 'public.songs'::regclass and indisprimary) = 1 then
    alter table public.songs drop constraint songs_pkey, add primary key (church_id, title);
  end if;
  if (select array_length(indkey::int2[], 1) from pg_index where indrelid = 'public.team_settings'::regclass and indisprimary) = 1 then
    alter table public.team_settings drop constraint team_settings_pkey, add primary key (church_id, key);
  end if;
end $$;
create index if not exists services_church on public.services (church_id, updated_at desc);
create index if not exists edit_log_church_at on public.edit_log (church_id, at desc);

alter table public.churches enable row level security;
grant select on public.churches to authenticated;
grant select, insert, update, delete on public.churches to service_role;

-- ───────────── 6단계 추가 (2026-11-22): 교회별 공간 ② 교회끼리 잠그기 ─────────────
-- 예배·곡·설정·편집 기록·팀원 목록을 '내가 속한 교회 것'만 보고 쓸 수 있게 해요.
-- 다른 교회 것을 고치거나, 내 것을 다른 교회로 옮기는 것도 막아요.
-- 화면이 지금 교회를 알리면 그 교회 것만, 안 알리면(실시간 알림은 알릴 수 없어요) 내가 속한 교회 것만 열려요.
create or replace function public.in_church(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m join public.churches ch on ch.id = m.church_id
                  where m.user_id = auth.uid() and m.church_id = c and ch.suspended_at is null)
     and (public.req_church() is null or c = public.req_church());
$$;
revoke execute on function public.in_church(uuid) from public, anon;
grant execute on function public.in_church(uuid) to authenticated, service_role;
create or replace function public.belongs_to(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and church_id = c);
$$;
revoke execute on function public.belongs_to(uuid) from public, anon;
grant execute on function public.belongs_to(uuid) to authenticated, service_role;

drop policy if exists "팀원은 팀 설정을 써요"   on public.team_settings;
drop policy if exists "팀원은 팀원 목록을 봐요" on public.members;
drop policy if exists "팀원은 곡 보관함을 써요" on public.songs;
drop policy if exists "팀원은 예배 기록을 써요" on public.services;
drop policy if exists "팀원은 편집 기록을 봐요" on public.edit_log;
drop policy if exists "팀원은 자기 교회를 봐요" on public.churches;

drop policy if exists "우리 교회 설정만 써요" on public.team_settings;
create policy "우리 교회 설정만 써요" on public.team_settings for all
  using (public.in_church(church_id)) with check (public.in_church(church_id));
drop policy if exists "우리 교회 곡만 써요" on public.songs;
create policy "우리 교회 곡만 써요" on public.songs for all
  using (public.in_church(church_id)) with check (public.in_church(church_id));
drop policy if exists "우리 교회 예배만 써요" on public.services;
create policy "우리 교회 예배만 써요" on public.services for all
  using (public.in_church(church_id)) with check (public.in_church(church_id));
drop policy if exists "우리 교회 편집 기록만 봐요" on public.edit_log;
create policy "우리 교회 편집 기록만 봐요" on public.edit_log for select using (public.in_church(church_id));
drop policy if exists "우리 교회 팀원만 봐요" on public.members;
create policy "우리 교회 팀원만 봐요" on public.members for select
  using (user_id = auth.uid() or public.in_church(church_id)); -- 내 줄은 어느 교회든 (교회 목록)
drop policy if exists "내가 속한 교회만 봐요" on public.churches;
create policy "내가 속한 교회만 봐요" on public.churches for select using (public.belongs_to(id)); -- 교회 목록이라 지금 교회와 상관없이

-- ───────────── 7단계 추가 (2026-11-22): 교회별 공간 ③ 접속 중 표시를 잠긴 방으로 ─────────────
-- 화면의 '지금 접속 중인 팀원'은 'online:교회번호' 방을 써요. 그 교회 팀원만 들어와서 보고 알릴 수 있어요.
-- (예전 방 'hogam-online'은 누구나 들어올 수 있어서 팀원 이름이 밖에서 보였어요)
drop policy if exists "우리 교회 접속 방만 봐요" on realtime.messages;
-- 읽기에 broadcast도 넣어야 방에 들어갈 수 있어요 (실시간 서버가 들어올 때 둘 다 확인해요. 2026-11-22 시험에서 확인)
create policy "우리 교회 접속 방만 봐요" on realtime.messages for select to authenticated
  using (realtime.messages.extension in ('presence', 'broadcast')
         and realtime.topic() in (select 'online:' || church_id from public.members where user_id = auth.uid() and public.in_church(church_id)));
drop policy if exists "우리 교회 접속 방에만 알려요" on realtime.messages;
create policy "우리 교회 접속 방에만 알려요" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'presence'
              and realtime.topic() in (select 'online:' || church_id from public.members where user_id = auth.uid() and public.in_church(church_id)));

-- ───────────── 8단계 추가 (2026-11-23): 교회별 공간 ④ 카카오 로그인 + 초대 코드로 교회 들어가기 ─────────────
-- 로그인은 카카오(또는 옛 팀원의 이름+암호). 로그인한 사람이 초대 코드와 '교회에서 쓸 이름'을 넣으면 그 교회 팀원이 돼요.
-- 초대 코드: 교회마다 한 번에 하나. 헷갈리는 글자(0·O·1·I)를 뺀 8글자. 그 교회 팀원만 볼 수 있어요 (churches 규칙).
create or replace function public.new_invite_code() returns text
language sql volatile set search_path = public, extensions as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '' order by i)
    from (select extensions.gen_random_bytes(8) b) x, generate_series(0, 7) i;
$$;
alter table public.churches add column if not exists invite_code text;
-- 코드는 '팀원 초대'를 누를 때 생기고 7일 뒤 막혀요 (11단계 get_invite)
create unique index if not exists churches_invite_code on public.churches (invite_code);

-- 이름은 교회 안에서만 안 겹치면 돼요 (서버 전체에서 하나만이던 것을 풀어요)
alter table public.members drop constraint if exists members_name_key;
create unique index if not exists members_church_name on public.members (church_id, name);
-- 가입 때 옥수교회로 넣던 임시 기본값을 없애요. 이제 교회는 초대 코드로만 정해져요.
alter table public.members  alter column church_id drop default;
alter table public.edit_log alter column church_id set default public.my_church();

-- 초대 코드를 틀린 기록 (join_church만 써요. 화면에서는 볼 수 없어요)
create table if not exists public.join_attempts (
  id      bigint generated always as identity primary key,
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index if not exists join_attempts_user_at on public.join_attempts (user_id, at desc);
alter table public.join_attempts enable row level security;

-- 교회 들어가기: 맞는 초대 코드 + 2~10글자 이름이면 팀원으로 넣어요.
-- 틀린 코드는 기록이 남아야 해서 오류를 던지지 않고 {ok:false, error:…}로 돌려줘요.
create or replace function public.join_church(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_ch   public.churches;
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if v_uid is null then raise exception '먼저 로그인해 주세요'; end if;
  if (select count(*) from public.join_attempts where user_id = v_uid and at > now() - interval '15 minutes') >= 5 then
    return jsonb_build_object('ok', false, 'error', '초대 코드를 여러 번 틀렸어요. 15분 뒤에 다시 해 주세요');
  end if;
  select * into v_ch from public.churches where invite_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
     and invite_expires_at > now() for share; -- 내보내기와 동시에 들어오지 못하게 잠가요
  if not found then
    insert into public.join_attempts (user_id) values (v_uid);
    delete from public.join_attempts where at < now() - interval '1 day';
    return jsonb_build_object('ok', false, 'error', '초대 코드가 맞지 않거나 기한이 지났어요. 새 링크를 받아 주세요');
  end if;
  if v_ch.suspended_at is not null then
    return jsonb_build_object('ok', false, 'error', '지금은 쉬고 있는 교회예요');
  end if;
  if exists (select 1 from public.members where user_id = v_uid and church_id = v_ch.id) then
    return jsonb_build_object('ok', false, 'error', '이미 이 교회에 들어가 있어요');
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 10 then
    return jsonb_build_object('ok', false, 'error', '이름은 2~10글자로 적어 주세요');
  end if;
  begin
    insert into public.members (user_id, name, church_id) values (v_uid, v_name, v_ch.id);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', '이 교회에 같은 이름이 있어요. 이름 뒤에 직분이나 숫자를 붙여 주세요');
  end;
  insert into public.edit_log (church_id, user_id, name, action, target_type, target_id, summary)
    values (v_ch.id, v_uid, v_name, 'join', 'member', v_name, v_name);
  return jsonb_build_object('ok', true, 'church', v_ch.name, 'church_id', v_ch.id);
end $$;
revoke execute on function public.join_church(text, text) from public, anon;
grant execute on function public.join_church(text, text) to authenticated;
revoke execute on function public.new_invite_code() from public, anon, authenticated;


-- ───────────── 9단계 추가 (2026-11-24): 교회별 공간 ⑤ 한 사람이 여러 교회 · 새 교회 만들기 ─────────────
do $$ begin
  if (select array_length(indkey::int2[], 1) from pg_index where indrelid = 'public.members'::regclass and indisprimary) = 1 then
    alter table public.members drop constraint members_pkey, add primary key (user_id, church_id);
  end if;
end $$;
-- 만든 사람은 그 교회 관리자예요. 한 사람이 만들 수 있는 교회는 1곳.
alter table public.members  add column if not exists role text not null default 'member' check (role in ('member', 'admin'));
alter table public.churches add column if not exists created_by uuid references auth.users on delete set null;
create unique index if not exists churches_created_by on public.churches (created_by);

create or replace function public.create_church(p_church text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_ch     public.churches;
  v_church text := regexp_replace(btrim(coalesce(p_church, '')), '\s+', ' ', 'g');
  v_name   text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if v_uid is null then raise exception '먼저 로그인해 주세요'; end if;
  if char_length(v_church) < 2 or char_length(v_church) > 20 then
    return jsonb_build_object('ok', false, 'error', '교회 이름은 2~20글자로 적어 주세요');
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 10 then
    return jsonb_build_object('ok', false, 'error', '이름은 2~10글자로 적어 주세요');
  end if;
  insert into public.churches (name, created_by) values (v_church, v_uid)
    on conflict (created_by) do nothing returning * into v_ch;
  if v_ch.id is null then
    return jsonb_build_object('ok', false, 'error', '교회는 한 사람이 한 곳만 만들 수 있어요');
  end if;
  insert into public.members (user_id, name, church_id, role) values (v_uid, v_name, v_ch.id, 'admin');
  insert into public.edit_log (church_id, user_id, name, action, target_type, target_id, summary)
    values (v_ch.id, v_uid, v_name, 'join', 'member', v_name, v_name);
  return jsonb_build_object('ok', true, 'church', v_ch.name, 'church_id', v_ch.id);
end $$;
revoke execute on function public.create_church(text, text) from public, anon;
grant execute on function public.create_church(text, text) to authenticated;

-- ───────────── 10단계 추가 (2026-11-24): 예배 휴지통 ─────────────
-- 예배를 지우면 휴지통 표시만 해요. 30일이 지나면 편집 기록에 남은 그 예배 내용까지 서버가 지워요.
alter table public.services add column if not exists deleted_at      timestamptz;
alter table public.services add column if not exists deleted_by_name text;
create index if not exists services_trash on public.services (deleted_at) where deleted_at is not null;

-- 지운 때·지운 사람은 서버가 적어요. 휴지통에 넣고 꺼내는 건 '고친 것'이 아니라서 고친 사람·때는 그대로 둬요.
create or replace function public.stamp_trash() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.deleted_at := null; new.deleted_by_name := null;
    return new;
  end if;
  if new.deleted_at is null then
    new.deleted_by_name := null;
  elsif old.deleted_at is null then
    new.deleted_at := now(); new.deleted_by_name := public.my_name(new.church_id);
  else
    new.deleted_at := old.deleted_at; new.deleted_by_name := old.deleted_by_name;
  end if;
  if (old.deleted_at is not null or new.deleted_at is not null) -- 두 사람이 연달아 지워도
     and new.name = old.name and new.text = old.text and new.results = old.results
     and new.verse_in = old.verse_in and new.b_title = old.b_title then
    new.updated_at := old.updated_at; new.updated_by_name := old.updated_by_name;
  end if;
  return new;
end $$;
-- 이름순으로 실행돼서 services_stamp 다음에 돌아요
drop trigger if exists services_trash on public.services;
create trigger services_trash before insert or update on public.services for each row execute function public.stamp_trash();

-- 완전히 지우기: 예배와 편집 기록에 남은 그 예배 내용을 지우고, 이름만 한 줄 남겨요 (화면에서는 못 불러요)
create or replace function public.purge_one(p_church uuid, p_id text, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare v_sum text;
begin
  delete from public.services where church_id = p_church and id = p_id and deleted_at is not null returning name into v_sum;
  if not found then return; end if;
  delete from public.edit_log where church_id = p_church and target_type = 'service' and target_id = p_id;
  insert into public.edit_log (church_id, user_id, name, action, target_type, target_id, summary)
    values (p_church, auth.uid(), p_name, 'purge', 'service', p_id, v_sum);
end $$;
revoke execute on function public.purge_one(uuid, text, text) from public, anon, authenticated;

create or replace function public.purge_service(p_id text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_ch uuid := public.my_church();
begin
  if v_ch is null then raise exception '팀원만 지울 수 있어요'; end if;
  if not public.is_admin(v_ch) then raise exception '교회 관리자만 완전히 지울 수 있어요'; end if;
  if not exists (select 1 from public.services where church_id = v_ch and id = p_id and deleted_at is not null) then return false; end if;
  perform public.purge_one(v_ch, p_id, public.my_name(v_ch));
  return true;
end $$;
revoke execute on function public.purge_service(text) from public, anon;
grant execute on function public.purge_service(text) to authenticated;

create or replace function public.purge_old_trash() returns int
language plpgsql security definer set search_path = public as $$
declare s record; n int := 0;
begin
  for s in select church_id, id from public.services where deleted_at < now() - interval '30 days' loop
    perform public.purge_one(s.church_id, s.id, '자동 정리');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.purge_old_trash() from public, anon, authenticated;

-- 날마다 새벽 3시 20분(한국)에 서버가 스스로 돌려요
create extension if not exists pg_cron;
select cron.schedule('hogam-purge-trash', '20 18 * * *', 'select public.purge_old_trash()');

-- ───────────── 11단계 추가 (2026-11-24): 교회 관리자 · 7일 초대 링크 · 전체 관리자 ─────────────
-- 초대 코드: 처음 적용할 때 기한 없는 옛 코드는 모두 막아요.
alter table public.churches alter column invite_code drop not null;
alter table public.churches alter column invite_code drop default;
alter table public.churches add column if not exists invite_expires_at timestamptz;
update public.churches set invite_code = null where invite_expires_at is null and invite_code is not null;

-- 전체 관리자. 화면에서는 읽지도 쓰지도 못하고, SQL Editor에서만 넣어요:
--   insert into public.super_admins (user_id) values ('계정 번호');
create table if not exists public.super_admins (user_id uuid primary key references auth.users on delete cascade);
alter table public.super_admins enable row level security;
revoke all on public.super_admins from public, anon, authenticated;

create or replace function public.is_super() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid());
$$;
create or replace function public.is_admin(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.in_church(c) and exists (select 1 from public.members where user_id = auth.uid() and church_id = c and role = 'admin');
$$;

-- 초대 코드 받기 (팀원 모두): 살아 있는 코드가 있으면 그것, 없으면 새로 만들어요.
create or replace function public.get_invite() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ch public.churches;
begin
  select * into v_ch from public.churches where id = public.my_church() for update;
  if not found or not public.in_church(v_ch.id) then raise exception '팀원만 초대할 수 있어요'; end if;
  if v_ch.invite_code is null or v_ch.invite_expires_at is null or v_ch.invite_expires_at <= now() then
    update public.churches set invite_code = public.new_invite_code(), invite_expires_at = now() + interval '7 days'
     where id = v_ch.id returning * into v_ch;
  end if;
  return jsonb_build_object('code', v_ch.invite_code, 'expires_at', v_ch.invite_expires_at);
end $$;

-- 교회 줄을 잠그고 관리 권한을 확인해요. 잠그는 까닭: 두 관리자가 동시에 서로 내려서 관리자가 없어지지 않게.
create or replace function public.lock_for_admin(p_church uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.churches where id = p_church for update;
  if not found or not (public.is_admin(p_church) or public.is_super()) then raise exception '교회 관리자만 할 수 있어요'; end if;
end $$;

-- 내보내기: 그 교회에서만 빠져요. 만든 예배·곡은 남고, 초대 링크는 바로 막혀요.
create or replace function public.remove_member(p_church uuid, p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.members;
begin
  perform public.lock_for_admin(p_church);
  if p_user = auth.uid() then return jsonb_build_object('ok', false, 'error', '나 자신은 내보낼 수 없어요'); end if;
  select * into v from public.members where church_id = p_church and user_id = p_user;
  if not found then return jsonb_build_object('ok', false, 'error', '이미 나간 팀원이에요'); end if;
  if v.role = 'admin' and (select count(*) from public.members where church_id = p_church and role = 'admin') = 1 then
    return jsonb_build_object('ok', false, 'error', '마지막 관리자예요. 다른 관리자를 먼저 세워 주세요');
  end if;
  delete from public.members where church_id = p_church and user_id = p_user;
  update public.churches set invite_code = null, invite_expires_at = null where id = p_church;
  insert into public.edit_log (church_id, user_id, name, action, target_type, target_id, summary)
    values (p_church, auth.uid(), coalesce(public.my_name(p_church), '전체 관리자'), 'remove', 'member', v.name, v.name);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.set_admin(p_church uuid, p_user uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.members;
begin
  if p_on is null then raise exception '값이 비었어요'; end if;
  perform public.lock_for_admin(p_church);
  select * into v from public.members where church_id = p_church and user_id = p_user;
  if not found then return jsonb_build_object('ok', false, 'error', '이미 나간 팀원이에요'); end if;
  if (v.role = 'admin') = p_on then return jsonb_build_object('ok', true); end if;
  if not p_on and (select count(*) from public.members where church_id = p_church and role = 'admin') = 1 then
    return jsonb_build_object('ok', false, 'error', '마지막 관리자예요. 다른 관리자를 먼저 세워 주세요');
  end if;
  update public.members set role = case when p_on then 'admin' else 'member' end where church_id = p_church and user_id = p_user;
  insert into public.edit_log (church_id, user_id, name, action, target_type, target_id, summary)
    values (p_church, auth.uid(), coalesce(public.my_name(p_church), '전체 관리자'), case when p_on then 'admin_on' else 'admin_off' end, 'member', v.name, v.name);
  return jsonb_build_object('ok', true);
end $$;

-- 전체 관리 화면: 교회 이름·팀원까지만. 예배·곡 내용을 여는 길은 만들지 않아요.
create or replace function public.super_churches() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super() then raise exception '전체 관리자만 볼 수 있어요'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'created_at', c.created_at, 'suspended_at', c.suspended_at,
            'members', (select count(*) from public.members m where m.church_id = c.id)) order by c.created_at), '[]'::jsonb) from public.churches c);
end $$;
create or replace function public.super_members(p_church uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super() then raise exception '전체 관리자만 볼 수 있어요'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', m.name, 'role', m.role, 'joined_at', m.joined_at) order by m.joined_at), '[]'::jsonb)
            from public.members m where m.church_id = p_church);
end $$;
create or replace function public.set_suspended(p_church uuid, p_on boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super() then raise exception '전체 관리자만 할 수 있어요'; end if;
  if p_on is null then raise exception '값이 비었어요'; end if;
  update public.churches set suspended_at = case when p_on then coalesce(suspended_at, now()) end,
         invite_code = null, invite_expires_at = null where id = p_church;
  return found;
end $$;

create or replace function public.clear_old_invites() returns void
language sql security definer set search_path = public as $$
  update public.churches set invite_code = null, invite_expires_at = null where invite_expires_at <= now();
$$;
revoke execute on function public.clear_old_invites(), public.lock_for_admin(uuid) from public, anon, authenticated;
revoke execute on function public.is_super(), public.is_admin(uuid), public.get_invite(), public.remove_member(uuid, uuid), public.set_admin(uuid, uuid, boolean),
  public.super_churches(), public.super_members(uuid), public.set_suspended(uuid, boolean) from public, anon;
grant execute on function public.is_super(), public.is_admin(uuid), public.get_invite(), public.remove_member(uuid, uuid), public.set_admin(uuid, uuid, boolean),
  public.super_churches(), public.super_members(uuid), public.set_suspended(uuid, boolean) to authenticated;

-- 예배는 휴지통으로만 지워요. 바로 지우기를 닫아야 '완전히 지우기는 관리자만'이 지켜져요.
revoke delete on public.services from authenticated;

select cron.schedule('hogam-clear-invites', '25 18 * * *', 'select public.clear_old_invites()');

-- ───────────── 12단계 추가 (2026-11-24): 전체 관리 카드 · 교회별 AI 횟수 · 용량 ─────────────
-- 누가 썼는지(ai_usage)는 3일, 교회별 하루 횟수(ai_daily)는 13개월만 남겨요. 지난 사용은 교회를 몰라서 0부터 세요.
alter table public.ai_usage add column if not exists church_id uuid references public.churches on delete cascade;
create table if not exists public.ai_daily (
  church_id uuid not null references public.churches on delete cascade,
  day       date not null,             -- 한국 날짜
  n         int not null default 0,
  last_at   timestamptz not null default now(),
  primary key (church_id, day)
);
alter table public.ai_daily enable row level security;
revoke all on public.ai_daily from public, anon, authenticated;
-- 호감만 보는 메모. churches 는 팀원도 볼 수 있어서 따로 둬요.
create table if not exists public.church_memos (
  church_id uuid primary key references public.churches on delete cascade,
  memo      text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.church_memos enable row level security;
revoke all on public.church_memos from public, anon, authenticated;

-- AI를 쓸 때 ai 함수(service_role)만 불러요. 교회를 안 알렸으면 한 교회에만 속한 사람만 그 교회로 봐요.
create or replace function public.ai_church(p_user uuid, p_church uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select case when count(*) = 1 then (array_agg(m.church_id))[1] end
    from public.members m join public.churches c on c.id = m.church_id
   where m.user_id = p_user and c.suspended_at is null and (p_church is null or m.church_id = p_church);
$$;
create or replace function public.log_ai(p_user uuid, p_church uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.ai_usage (user_id, church_id) values (p_user, p_church);
  insert into public.ai_daily (church_id, day, n) values (p_church, (now() at time zone 'Asia/Seoul')::date, 1)
    on conflict (church_id, day) do update set n = ai_daily.n + 1, last_at = now();
end $$;
create or replace function public.clear_old_ai() returns void
language sql security definer set search_path = public as $$
  delete from public.ai_usage where at < now() - interval '3 days';
  delete from public.ai_daily where day < (now() at time zone 'Asia/Seoul')::date - interval '13 months';
$$;

-- 마지막 사용: 그 교회 사람이 남긴 편집 기록과 AI 사용 중 가장 최근 (교회 밖 전체 관리자가 한 일은 빼요)
create or replace function public.church_last_used(c uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select greatest(
    (select max(l.at) from public.edit_log l where l.church_id = c and l.user_id is not null
        and not (l.user_id in (select user_id from public.super_admins)
                 and l.user_id not in (select user_id from public.members where church_id = c))),
    (select max(d.last_at) from public.ai_daily d where d.church_id = c));
$$;
-- 용량(바이트, 어림): 저장된 칸의 크기를 더해요. 내용은 내보내지 않아요.
create or replace function public.church_bytes(c uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'media',    (select coalesce(sum(pg_column_size(value)), 0) from public.team_settings where church_id = c and key like 'media.%'),
    'settings', (select coalesce(sum(pg_column_size(value)), 0) from public.team_settings where church_id = c and key not like 'media.%'),
    'services', (select coalesce(sum(coalesce(pg_column_size(text), 0) + coalesce(pg_column_size(results), 0) + coalesce(pg_column_size(verse_in), 0)), 0) from public.services where church_id = c),
    'songs',    (select coalesce(sum(coalesce(pg_column_size(result), 0) + coalesce(pg_column_size(thumb), 0)), 0) from public.songs where church_id = c),
    'log',      (select coalesce(sum(coalesce(pg_column_size(before), 0) + coalesce(pg_column_size(summary), 0)), 0) from public.edit_log where church_id = c));
$$;

-- 전체 관리 화면: 숫자와 이름만. 새 칸을 넣으면 supabase/tests/church-admin.sql 의 허용 목록도 같이 고쳐요.
create or replace function public.super_churches() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not public.is_super() then raise exception '전체 관리자만 볼 수 있어요'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'created_at', c.created_at, 'suspended_at', c.suspended_at,
            'members',  (select count(*) from public.members m where m.church_id = c.id),
            'admins',   (select count(*) from public.members m where m.church_id = c.id and m.role = 'admin'),
            'services', (select count(*) from public.services s where s.church_id = c.id and s.deleted_at is null),
            'songs',    (select count(*) from public.songs s where s.church_id = c.id),
            'ai_month', (select coalesce(sum(d.n), 0) from public.ai_daily d where d.church_id = c.id and d.day >= date_trunc('month', v_today)),
            'ai_today', (select coalesce(sum(d.n), 0) from public.ai_daily d where d.church_id = c.id and d.day = v_today),
            'bytes',    (select sum(v::bigint) from jsonb_each_text(public.church_bytes(c.id)) x(k, v)),
            'last_used', public.church_last_used(c.id)) order by c.created_at), '[]'::jsonb) from public.churches c);
end $$;
create or replace function public.super_church(p_church uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not public.is_super() then raise exception '전체 관리자만 볼 수 있어요'; end if;
  return jsonb_build_object(
    'memo',  coalesce((select memo from public.church_memos where church_id = p_church), ''),
    'bytes', public.church_bytes(p_church),
    'ai_days', (select jsonb_agg(coalesce(d.n, 0) order by g.i desc) from generate_series(0, 13) g(i)
                  left join public.ai_daily d on d.church_id = p_church and d.day = v_today - g.i));
end $$;
create or replace function public.super_set_memo(p_church uuid, p_memo text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super() then raise exception '전체 관리자만 할 수 있어요'; end if;
  if p_memo is null or char_length(p_memo) > 2000 then raise exception '메모는 2000글자까지 적을 수 있어요'; end if;
  insert into public.church_memos (church_id, memo) values (p_church, p_memo)
    on conflict (church_id) do update set memo = excluded.memo, updated_at = now();
  return true;
end $$;
revoke execute on function public.ai_church(uuid, uuid), public.log_ai(uuid, uuid), public.clear_old_ai(), public.church_last_used(uuid), public.church_bytes(uuid) from public, anon, authenticated;
grant execute on function public.ai_church(uuid, uuid), public.log_ai(uuid, uuid) to service_role;
revoke execute on function public.super_church(uuid), public.super_set_memo(uuid, text) from public, anon;
grant execute on function public.super_church(uuid), public.super_set_memo(uuid, text) to authenticated;

select cron.schedule('hogam-clear-ai', '30 18 * * *', 'select public.clear_old_ai()');
