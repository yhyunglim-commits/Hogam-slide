-- 시험 프로젝트 전용: 두 번째 교회와 두 교회의 시험 팀원을 만들어요. 실제 서버에서는 돌리지 마세요.
-- 순서: church-step1-reset → church-step1-seed → schema.sql → 이 파일 → church-step2.mjs
-- 먼저 Authentication › Users 에 test2@hogamslide.app (옥수교회용), test3@hogamslide.app (시험교회용)을 만들어 두세요.
do $$ declare a uuid; b uuid; c2 uuid := '00000000-0000-0000-0000-000000000002';
begin
  if (select count(*) from public.songs) > 50 then raise exception '곡이 너무 많아요. 실제 서버 같아서 멈췄어요'; end if;
  select id into a from auth.users where email = 'test2@hogamslide.app';
  select id into b from auth.users where email = 'test3@hogamslide.app';
  if a is null or b is null then raise exception '먼저 Authentication에서 test2, test3 사용자를 만들어 주세요'; end if;
  insert into public.churches (id, name) values (c2, '시험교회') on conflict (id) do nothing;
  insert into public.members (user_id, name, church_id) values (a, '옥수시험', '00000000-0000-0000-0000-000000000001') on conflict do nothing;
  insert into public.members (user_id, name, church_id) values (b, '다른교회시험', c2) on conflict do nothing;
  -- 옥수교회와 같은 제목의 곡을 일부러 넣어요 (제목이 같아도 서로 섞이지 않는지 보려고)
  insert into public.songs (church_id, title, result) values (c2, '시험곡 하나', '{"slides":["시험교회"]}') on conflict do nothing;
  insert into public.services (church_id, id, name) values (c2, 'svc-test-2', '시험교회 예배') on conflict do nothing;
  insert into public.team_settings (church_id, key, value) values (c2, 'look', '{"a":9}') on conflict do nothing;
end $$;
select c.name 교회, (select count(*) from public.members m where m.church_id = c.id) 팀원,
       (select count(*) from public.songs s where s.church_id = c.id) 곡,
       (select count(*) from public.services s where s.church_id = c.id) 예배,
       (select count(*) from public.edit_log l where l.church_id = c.id) 기록
  from public.churches c order by c.id;
