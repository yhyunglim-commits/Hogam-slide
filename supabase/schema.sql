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

-- 누가 고쳤는지는 서버가 직접 적어요 (화면에서 이름을 꾸며 넣을 수 없게)
create or replace function public.stamp_editor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_by_name := public.my_name();
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by_name := new.updated_by_name;
    new.created_at := now();
  else
    new.created_by_name := old.created_by_name;
    new.created_at := old.created_at;
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
  insert into public.edit_log (user_id, name, action, target_type, target_id, summary)
    values (auth.uid(), v_name, v_act, v_type, v_id, v_sum);
  return null;
end $$;

drop trigger if exists songs_stamp on public.songs;
create trigger songs_stamp before insert or update on public.songs for each row execute function public.stamp_editor();
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
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on function public.is_member(), public.my_name() to authenticated, service_role;
grant execute on function public.ping() to anon, authenticated;
