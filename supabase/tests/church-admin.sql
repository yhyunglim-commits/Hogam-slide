-- 시험 프로젝트 전용: 11단계(교회 관리자 · 7일 링크 · 전체 관리자). 실제 서버에서는 돌리지 마세요.
-- 끝에 일부러 오류를 내서 넣은 것을 모두 되돌려요. '모두 통과 N개'라는 오류가 나오면 성공이에요.
do $$
declare
  t record; got text; n int := 0; bad text := ''; code text;
  u text := 'a0000000-0000-4000-8000-00000000000'; -- 1 관리자 · 2 팀원 · 3 새로 온 사람 · 4 다른 교회 관리자 · 5 전체 관리자
  ca text := 'c0000000-0000-4000-8000-000000000001'; cb text := 'c0000000-0000-4000-8000-000000000002';
begin
  if (select count(*) from public.songs) > 50 then raise exception '곡이 너무 많아요. 실제 서버 같아서 멈췄어요'; end if;
  for i in 1..5 loop insert into auth.users (id, email) values ((u || i)::uuid, 'admin-sql-' || i || '@hogamslide.app'); end loop;
  insert into public.churches (id, name) values (ca::uuid, '관리시험A'), (cb::uuid, '관리시험B');
  insert into public.members (user_id, name, church_id, role) values ((u||1)::uuid,'관리자',ca::uuid,'admin'), ((u||2)::uuid,'팀원',ca::uuid,'member'), ((u||4)::uuid,'남관리자',cb::uuid,'admin');
  insert into public.super_admins values ((u||5)::uuid);
  insert into public.services (church_id, id, name, text) values (ca::uuid,'adm-1','예배','내용'), (ca::uuid,'adm-2','예배2','내용');
  for t in select * from (values
    -- 누구(0=서버), 교회, 무엇, 바라는 것, 이름
    (2,ca,'select get_invite()->>''code''','________','팀원도 초대 링크를 만듦'),
    (1,ca,'select get_invite()->>''code'' = ''{code}''','true','기한 안에는 같은 링크'),
    (0,'','select round(extract(epoch from invite_expires_at-now())/86400)::int from churches where id=''{a}''','7','기한은 7일'),
    (3,ca,'select get_invite()','ERR:%','교회 밖 사람은 링크를 못 만듦'),
    (0,'','with x as (update churches set invite_expires_at=now()-interval ''1 second'' where id=''{a}'' returning 1) select count(*) from x','1','(기한 지나게)'),
    (3,'','select join_church(''{code}'',''새사람'')->>''ok''','false','기한 지난 링크는 막힘'),
    (0,'','select clear_old_invites()::text','%','(날마다 정리)'),
    (0,'','select (invite_code is null)::text from churches where id=''{a}''','true','기한 지난 링크는 저절로 지워짐'),
    (2,ca,'select get_invite()->>''code'' <> ''{code}''','true','기한이 지나면 새 링크'),
    (0,'','select invite_code from churches where id=''{a}''','________','(새 코드 읽기)'),
    (3,'','select join_church(''{code}'',''새사람'')->>''ok''','true','새 링크로 들어옴'),
    (2,ca,'select remove_member(''{a}'',''{u}3'')','ERR:%관리자만%','팀원은 내보내지 못함'),
    (2,ca,'select set_admin(''{a}'',''{u}2'',true)','ERR:%관리자만%','팀원은 스스로 관리자가 못 됨'),
    (2,ca,'with x as (update members set role=''admin'' returning 1) select count(*) from x','ERR:%permission%','표를 직접 고쳐도 못 됨'),
    (4,cb,'select remove_member(''{a}'',''{u}3'')','ERR:%관리자만%','다른 교회 관리자는 못 내보냄'),
    (4,ca,'select remove_member(''{a}'',''{u}3'')','ERR:%관리자만%','교회 번호를 속여도 못 내보냄'),
    (1,ca,'select set_admin(''{a}'',''{u}1'',false)->>''error''','마지막 관리자%','마지막 관리자는 못 내림'),
    (5,'','select remove_member(''{a}'',''{u}1'')->>''error''','마지막 관리자%','마지막 관리자는 전체 관리자도 못 내보냄'),
    (1,ca,'select remove_member(''{a}'',''{u}1'')->>''error''','나 자신%','나 자신은 못 내보냄'),
    (3,ca,'select count(*) from services where church_id=''{a}''','2','내보내기 전에는 보임'),
    (1,ca,'select remove_member(''{a}'',''{u}3'')->>''ok''','true','관리자는 내보냄'),
    (3,ca,'select count(*) from services','0','내보낸 사람은 못 봄(교회를 알려도)'),
    (3,'','select count(*) from services','0','내보낸 사람은 못 봄(안 알려도)'),
    (3,ca,'select save_service(''adm-9'',null,''x'',''x'',''[]'',''x'',''x'',false)','ERR:%','내보낸 사람은 저장 못 함'),
    (3,ca,'with x as (update services set text=''x'' returning 1) select count(*) from x','0','내보낸 사람은 못 고침'),
    (3,'','select join_church(''{code}'',''새사람'')->>''ok''','false','내보내면 옛 링크가 막힘'),
    (2,ca,'with x as (delete from services where id=''adm-1'' returning 1) select count(*) from x','ERR:%permission%','바로 지우기는 닫힘'),
    (2,ca,'with x as (update services set deleted_at=now() where id=''adm-1'' returning 1) select count(*) from x','1','휴지통에 넣기는 팀원도'),
    (2,ca,'select purge_service(''adm-1'')','ERR:%관리자만%','팀원은 완전히 못 지움'),
    (2,ca,'with x as (update services set deleted_at=null where id=''adm-1'' returning 1) select count(*) from x','1','되돌리기는 팀원도'),
    (2,ca,'with x as (update services set deleted_at=now() where id=''adm-1'' returning 1) select count(*) from x','1','(다시 휴지통)'),
    (1,ca,'select purge_service(''adm-1'')','true','관리자는 완전히 지움'),
    (1,ca,'select set_admin(''{a}'',''{u}2'',true)->>''ok''','true','관리자 세우기'),
    (2,ca,'select set_admin(''{a}'',''{u}1'',false)->>''ok''','true','관리자가 둘이면 내림'),
    (1,ca,'select remove_member(''{a}'',''{u}2'')','ERR:%관리자만%','내려온 사람은 관리 못 함'),
    (1,ca,'select super_churches()','ERR:%전체 관리자만%','교회 관리자는 전체 목록을 못 봄'),
    (2,ca,'select super_members(''{b}'')','ERR:%전체 관리자만%','교회 관리자는 남의 팀원을 못 봄'),
    (2,ca,'select set_suspended(''{a}'',true)','ERR:%전체 관리자만%','교회 관리자는 교회를 못 멈춤'),
    (2,ca,'with x as (insert into super_admins values (''{u}2'') returning 1) select count(*) from x','ERR:%permission%','전체 관리자를 스스로 못 넣음'),
    (2,ca,'select count(*) from super_admins','ERR:%permission%','전체 관리자 표를 못 봄'),
    (2,ca,'select lock_for_admin(''{a}'')','ERR:%permission%','안쪽 기능은 못 부름'),
    (5,'','select jsonb_array_length(super_churches()) >= 2','true','전체 관리자는 모든 교회를 봄'),
    (5,'','select jsonb_array_length(super_members(''{b}''))','1','전체 관리자는 팀원을 봄'),
    (5,ca,'select (select count(*) from services)+(select count(*) from songs)+(select count(*) from team_settings)+(select count(*) from edit_log)','0','전체 관리자도 예배·곡 내용은 못 봄'),
    (5,'','select set_admin(''{a}'',''{u}1'',true)->>''ok''','true','전체 관리자는 관리자를 바꿈'),
    (5,'','select remove_member(''{a}'',''{u}1'')->>''ok''','true','전체 관리자는 내보냄'),
    (5,'','select set_suspended(''{a}'',true)','true','교회 멈추기'),
    (2,ca,'select count(*) from services','0','멈춘 교회는 안 열림'),
    (2,ca,'select get_invite()','ERR:%','멈춘 교회는 초대 못 함'),
    (2,ca,'select set_admin(''{a}'',''{u}2'',false)','ERR:%','멈춘 교회는 교회 관리자도 관리 못 함'),
    (5,'','select set_suspended(''{a}'',false)','true','다시 열기'),
    (2,ca,'select count(*) from services','1','다시 열면 그대로 보임'),
    (-1,'','select get_invite()','ERR:%permission%','로그인 안 하면 못 부름')
  ) as x(who, church, sql, want, label) loop
    perform set_config('request.jwt.claims', case when t.who > 0 then json_build_object('sub', u || t.who, 'role', 'authenticated')::text else '' end, true);
    perform set_config('request.jwt.claim.sub', case when t.who > 0 then u || t.who else '' end, true);
    perform set_config('request.headers', json_build_object('x-church', t.church)::text, true);
    begin
      if t.who > 0 then set local role authenticated; elsif t.who < 0 then set local role anon; end if;
      execute replace(replace(replace(replace(t.sql, '{a}', ca), '{b}', cb), '{u}', u), '{code}', coalesce(code, '')) into got;
    exception when others then got := 'ERR:' || sqlerrm;
    end;
    reset role;
    if got in ('t','f') then got := case got when 't' then 'true' else 'false' end; end if;
    if t.want = '________' then code := got; end if;
    n := n + 1;
    if got is null or got not like t.want then
      if not (got is null and t.want = '%') then bad := bad || E'\n실패 · ' || t.label || ' · ' || coalesce(got, '(빈 값)'); end if;
    end if;
  end loop;
  if bad <> '' then raise exception '%', bad; end if;
  raise exception '모두 통과 %개 (일부러 낸 오류예요. 시험 자료는 되돌렸어요)', n;
end $$;
