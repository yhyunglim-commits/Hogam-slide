-- 시험 프로젝트 전용: 교회 칸을 넣기 '전' 모양의 예시 데이터를 만들어요. 실제 서버에서는 돌리지 마세요.
-- 먼저 Authentication › Users › Add user 에서 test1@hogamslide.app 사용자를 만들어 두세요 (Auto Confirm 켜기).
do $$ declare uid uuid;
begin
  if (select count(*) from public.songs) > 50 then raise exception '곡이 너무 많아요. 실제 서버 같아서 멈췄어요'; end if;
  select id into uid from auth.users where email = 'test1@hogamslide.app';
  if uid is null then raise exception '먼저 Authentication에서 test1@hogamslide.app 사용자를 만들어 주세요'; end if;
  insert into public.members (user_id, name) values (uid, '시험팀원') on conflict do nothing;
  insert into public.songs (title, result) values ('시험곡 하나', '{"slides":["처음"]}'), ('시험곡 둘', '{"slides":[]}') on conflict do nothing;
  update public.songs set result = '{"slides":["고침"]}' where title = '시험곡 하나';  -- 되돌리기용 기록이 생겨요
  insert into public.services (id, name) values ('svc-test-1', '시험 예배') on conflict do nothing;
  insert into public.team_settings (key, value) values ('look', '{"a":1}') on conflict do nothing;
end $$;
select (select count(*) from public.members) 팀원, (select count(*) from public.songs) 곡,
       (select count(*) from public.services) 예배, (select count(*) from public.team_settings) 설정,
       (select count(*) from public.edit_log) 기록;
