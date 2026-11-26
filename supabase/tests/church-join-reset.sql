-- 시험 프로젝트 전용: church-join.mjs 를 다시 돌릴 수 있게 test4·test5 를 '아무 교회에도 안 속한 사람'으로 되돌려요.
-- 실제 서버에서는 돌리지 마세요.  test4·test5 는 Authentication › Users 에서 미리 만들어 두세요.
do $$ begin
  if (select count(*) from public.songs) > 50 then raise exception '곡이 너무 많아요. 실제 서버 같아서 멈췄어요'; end if;
end $$;
delete from public.members where user_id in (select id from auth.users where email in ('test4@hogamslide.app', 'test5@hogamslide.app'));
-- church-multi.mjs 가 만든 새 교회도 지워요
delete from public.edit_log where church_id in (select c.id from public.churches c join auth.users u on u.id = c.created_by where u.email in ('test4@hogamslide.app', 'test5@hogamslide.app'));
delete from public.songs where church_id in (select c.id from public.churches c join auth.users u on u.id = c.created_by where u.email in ('test4@hogamslide.app', 'test5@hogamslide.app'));
delete from public.services where church_id in (select c.id from public.churches c join auth.users u on u.id = c.created_by where u.email in ('test4@hogamslide.app', 'test5@hogamslide.app'));
delete from public.team_settings where church_id in (select c.id from public.churches c join auth.users u on u.id = c.created_by where u.email in ('test4@hogamslide.app', 'test5@hogamslide.app'));
-- 지울 때 생긴 '지움' 기록까지
delete from public.edit_log where church_id in (select c.id from public.churches c join auth.users u on u.id = c.created_by where u.email in ('test4@hogamslide.app', 'test5@hogamslide.app'));
delete from public.churches where created_by in (select id from auth.users where email in ('test4@hogamslide.app', 'test5@hogamslide.app'));
delete from public.join_attempts where user_id in (select id from auth.users where email in ('test4@hogamslide.app', 'test5@hogamslide.app'));
-- 약관 동의도 되돌려요 (14단계. 동의 전에는 못 들어가는지부터 봐요)
delete from public.consents where user_id in (select id from auth.users where email in ('test4@hogamslide.app', 'test5@hogamslide.app'));
select (select count(*) from public.members m join auth.users u on u.id = m.user_id where u.email in ('test4@hogamslide.app', 'test5@hogamslide.app')) 남은_팀원;
