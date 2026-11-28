-- 시험 프로젝트 전용: 18단계(호감 읽기 전용 보기). 실제 서버에서는 돌리지 마세요.
-- 끝에 일부러 오류를 내서 넣은 것을 모두 되돌려요. '모두 통과 N개'라는 오류가 나오면 성공이에요.
do $$
declare
  t record; got text; n int := 0; bad text := '';
  u text := 'd0000000-0000-4000-8000-00000000000'; -- 1 A관리자 · 2 A팀원 · 4 B관리자 · 5 호감(전체 관리자)
  ca text := 'c2000000-0000-4000-8000-000000000001'; cb text := 'c2000000-0000-4000-8000-000000000002';
begin
  if (select count(*) from public.songs) > 50 then raise exception '곡이 너무 많아요. 실제 서버 같아서 멈췄어요'; end if;
  for i in 1..5 loop insert into auth.users (id, email) values ((u || i)::uuid, 'view-sql-' || i || '@hogamslide.app'); end loop;
  insert into public.churches (id, name) values (ca::uuid, '보기시험A'), (cb::uuid, '보기시험B');
  insert into public.members (user_id, name, church_id, role) values ((u||1)::uuid,'관리자',ca::uuid,'admin'), ((u||2)::uuid,'팀원',ca::uuid,'member'), ((u||4)::uuid,'남관리자',cb::uuid,'admin');
  insert into public.super_admins values ((u||5)::uuid);
  insert into public.services (church_id, id, name, text) values (ca::uuid,'v-1','예배','내용'), (ca::uuid,'v-2','예배2','내용'), (cb::uuid,'v-3','B예배','B내용');
  insert into public.songs (church_id, title, result) values (ca::uuid,'A곡','{"t":"가사"}'), (cb::uuid,'B곡','{"t":"가사"}');
  insert into public.team_settings (church_id, key, value) values (ca::uuid,'look','{"a":1}'), (cb::uuid,'look','{"b":1}');
  for t in select * from (values
    (5,ca,'select count(*) from services','0','열기 전에는 호감도 못 읽음'),
    (2,ca,'select super_view_open(''{a}'')','ERR:%전체 관리자만%','팀원은 열 수 없음'),
    (4,cb,'select super_view_open(''{a}'')','ERR:%전체 관리자만%','다른 교회 관리자도 못 엶'),
    (-1,'','select super_view_open(''{a}'')','ERR:%','로그인 안 하면 못 엶'),
    (5,'','select super_view_open(''c2000000-0000-4000-8000-000000000009'')->>''ok''','false','없는 교회는 못 엶'),
    (5,'','select super_view_open(''{a}'')->>''name''','보기시험A','호감이 A를 엶'),
    (0,'','select count(*) from super_views where church_id=''{a}''','1','연 기록이 남음'),
    (0,'','select what from super_log where church_id=''{a}'' order by id desc limit 1','읽기 전용으로 봄','호감 기록에도 남음'),
    (5,ca,'select count(*) from services','2','연 뒤에는 A 예배를 읽음'),
    (5,ca,'select count(*) from songs','1','곡도 읽음'),
    (5,ca,'select count(*) from team_settings','1','슬라이드 모양 설정도 읽음'),
    (5,ca,'select count(*) from edit_log','0','편집 기록은 안 열림'),
    (5,ca,'select count(*) from members where church_id=''{a}''','0','팀원 목록은 안 열림'),
    (5,'','select count(*) from services','0','교회를 안 알리면 못 읽음 (실시간 알림 포함)'),
    (5,cb,'select count(*) from services','0','안 연 교회(B)는 못 읽음'),
    (5,cb,'select count(*) from services where church_id=''{a}''','0','B라고 알리고 A를 읽을 수 없음'),
    (5,ca,'with x as (insert into services (church_id,id,name,text) values (''{a}'',''v-9'',''몰래'',''x'') returning 1) select count(*) from x','ERR:%','예배를 새로 못 씀'),
    (5,ca,'with x as (update services set text=''바꿈'' returning 1) select count(*) from x','0','예배를 못 고침'),
    (5,ca,'with x as (update services set deleted_at=now() returning 1) select count(*) from x','0','휴지통에도 못 넣음'),
    (5,ca,'select save_service(''v-1'',1,''예배'',''바꿈'',''[]'','''','''',false)','ERR:%팀원만%','저장 함수로도 못 씀'),
    (5,ca,'with x as (insert into songs (church_id,title,result) values (''{a}'',''몰래곡'',''{}'') returning 1) select count(*) from x','ERR:%','곡을 못 씀'),
    (5,ca,'with x as (update songs set result=''{}'' returning 1) select count(*) from x','0','곡을 못 고침'),
    (5,ca,'with x as (delete from songs returning 1) select count(*) from x','0','곡을 못 지움'),
    (5,ca,'with x as (insert into team_settings (church_id,key,value) values (''{a}'',''look2'',''1'') returning 1) select count(*) from x','ERR:%','설정을 못 씀'),
    (5,ca,'with x as (update team_settings set value=''2'' returning 1) select count(*) from x','0','설정을 못 고침'),
    (0,'','select text from services where id=''v-1''','내용','A 예배 내용은 그대로'),
    (5,ca,'select get_invite()','ERR:%','초대 코드도 못 만듦'),
    (1,ca,'select count(*) from super_views','ERR:%permission%','교회 관리자는 연 기록을 못 봄'),
    (5,ca,'select count(*) from super_views','ERR:%permission%','호감도 표를 직접은 못 읽음 (함수로만)'),
    (1,ca,'select super_viewing(''{a}'')::text','false','교회 관리자는 보는 중이 아님'),
    (0,'','with x as (update super_views set at=now()-interval ''121 minutes'' where church_id=''{a}'' returning 1) select count(*) from x','1','(2시간 지나게)'),
    (5,ca,'select count(*) from services','0','2시간이 지나면 다시 못 읽음'),
    (5,'','select (super_view_open(''{a}'')->>''ok'')','true','다시 열면'),
    (5,ca,'select count(*) from services','2','다시 읽음'),
    (0,'','select count(*) from super_views where church_id=''{a}''','2','열 때마다 기록'),
    (0,'','with x as (delete from super_admins where user_id=''{u}5'' returning 1) select count(*) from x','1','(호감 자격을 뺌)'),
    (5,ca,'select count(*) from services','0','자격을 잃으면 2시간 안이라도 못 읽음'),
    (0,'','with x as (insert into super_admins values (''{u}5'') returning 1) select count(*) from x','1','(되돌림)'),
    (1,ca,'select count(*) from services','2','팀원은 그대로 자기 교회를 봄'),
    (4,cb,'select count(*) from services where church_id=''{a}''','0','다른 교회 관리자는 여전히 못 봄'),
    (0,'','with x as (update super_views set at=now()-interval ''366 days'' returning 1) select (count(*)>0)::text from x','true','(1년 전으로)'),
    (0,'','select clear_old_super_views()::text','%','(날마다 정리)'),
    (0,'','select count(*) from super_views','0','1년 지난 기록은 지움'),
    (0,'','select count(*) from cron.job where jobname=''hogam-clear-super-views''','1','날마다 정리 예약')
  ) as x(who, church, sql, want, label) loop
    perform set_config('request.jwt.claims', case when t.who > 0 then json_build_object('sub', u || t.who, 'role', 'authenticated')::text else '' end, true);
    perform set_config('request.jwt.claim.sub', case when t.who > 0 then u || t.who else '' end, true);
    perform set_config('request.headers', json_build_object('x-church', t.church)::text, true);
    begin
      if t.who > 0 then set local role authenticated; elsif t.who < 0 then set local role anon; end if;
      execute replace(replace(replace(t.sql, '{a}', ca), '{b}', cb), '{u}', u) into got;
    exception when others then got := 'ERR:' || sqlerrm;
    end;
    reset role;
    if got in ('t','f') then got := case got when 't' then 'true' else 'false' end; end if;
    n := n + 1;
    if got is null or got not like t.want then
      if not (got is null and t.want = '%') then bad := bad || E'\n실패 · ' || t.label || ' · ' || coalesce(got, '(빈 값)'); end if;
    end if;
  end loop;
  if bad <> '' then raise exception '%', bad; end if;
  raise exception '모두 통과 %개 (일부러 낸 오류예요. 시험 자료는 되돌렸어요)', n;
end $$;
