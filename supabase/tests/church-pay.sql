-- 시험 프로젝트 전용: 17단계(유료 1단계 · AI 충전 · 용량 추가 · 교회 정보). 실제 서버에서는 돌리지 마세요.
-- 끝에 일부러 오류를 내서 넣은 것을 모두 되돌려요. '모두 통과 N개'라는 오류가 나오면 성공이에요.
-- 점: 악보 1번 = 5점, 맞춤법 1번 = 1점. 아래 '매달,처음,충전'은 이번 달 매달 무료에서 쓴 점 · 처음 무료 남은 점 · 충전 남은 점이에요.
do $$
declare
  t record; got text; n int := 0; bad text := ''; s text := '';
  u text := 'b0000000-0000-4000-8000-00000000000'; -- 1 A관리자 · 2 A팀원 · 3·6·7 새 교회 만들 사람 · 4 B관리자 · 5 전체 관리자
  ca text := 'c1000000-0000-4000-8000-000000000001'; cb text := 'c1000000-0000-4000-8000-000000000002';
  j text := 'e0000000-0000-4000-8000-00000000000';
  pts text := 'select month_pts(''{a}'') || '','' || free_pts || '','' || paid_pts from churches where id=''{a}''';
  road text := '서울 성동구 한림말5길 33-9';
begin
  if (select count(*) from public.songs) > 50 then raise exception '곡이 너무 많아요. 실제 서버 같아서 멈췄어요'; end if;
  for i in 1..7 loop insert into auth.users (id, email) values ((u || i)::uuid, 'pay-sql-' || i || '@hogamslide.app'); end loop;
  insert into public.churches (id, name, ai_limit, free_pts) values (ca::uuid, '유료시험A', 1, 5); -- 매달 1번 · 처음 무료 1번
  insert into public.churches (id, name) values (cb::uuid, '유료시험B');
  insert into public.members (user_id, name, church_id, role) values ((u||1)::uuid,'관리자',ca::uuid,'admin'), ((u||2)::uuid,'팀원',ca::uuid,'member'), ((u||4)::uuid,'남관리자',cb::uuid,'admin');
  insert into public.super_admins values ((u||5)::uuid);
  insert into public.consents (user_id, ver) select (u || i)::uuid, public.terms_ver() from generate_series(1, 7) i;
  for t in select * from (values
    -- 누구(0=서버, -1=로그인 안 함), 교회, 무엇, 바라는 것('{save}'면 값을 {s}로 기억), 이름
    -- 교회 정보 · 같은 주소
    (3,'','select create_church(''새교회'',''새사람'')->>''error''','%주소가 필요%','옛 화면(주소 없이)은 막힘'),
    (3,'','select create_church(''새교회'',''새사람'',''{"road":""}'')->>''error''','%주소%','주소 없으면 못 만듦'),
    (3,'','select create_church(''새교회'',''새사람'',''{"road":"{road}","zip":"12ab"}'')->>''error''','%우편번호%','이상한 우편번호는 막힘'),
    (3,'','select create_church(''새교회'',''새사람'',''{"road":"{road}","phone":"<script>"}'')->>''error''','%전화번호%','이상한 전화번호는 막힘'),
    (-1,'','select create_church(''새교회'',''새사람'',''{"road":"{road}"}'')','ERR:%','로그인 안 하면 못 만듦'),
    (3,'','select create_church(''새교회'',''새사람'',''{"road":"{road}","detail":"2층","zip":"04700","denom":"예장","phone":"02-000-0000"}'')->>''free''','true','처음 주소면 무료 50번'),
    (0,'','select id from churches where name=''새교회''','{save}','(새 교회 번호)'),
    (0,'','select ai_limit || '','' || free_pts || '','' || paid_pts || '','' || mb_limit from churches where id=''{s}''','0,250,0,20','새 교회: 매달 0 · 처음 50번 · 20MB'),
    (3,'{s}','select ai_left()->>''left''','50','새 교회 남은 횟수 50'),
    (6,'','select create_church(''옆교회'',''옆사람'',''{"road":"  서울 성동구  한림말5길 33-9 "}'')->>''free''','false','같은 도로명 주소면(띄어쓰기 달라도) 무료 없음'),
    (0,'','select free_pts::text from churches where name=''옆교회''','0','(처음 무료 0)'),
    (7,'','select create_church(''먼교회'',''먼사람'',''{"road":"부산 해운대구 해운대로 1"}'')->>''free''','true','다른 주소는 무료'),
    (3,'{s}','select church_info_get(''{s}'')->>''road''','서울 성동구 한림말5길 33-9','관리자는 교회 정보를 봄'),
    (5,'','select super_church(''{s}'')->''info''->>''denom''','예장','호감은 교회 정보를 봄'),
    (4,cb,'select church_info_get(''{s}'')','ERR:%관리자만%','다른 교회 관리자는 못 봄'),
    (2,ca,'select church_info_get(''{a}'')','ERR:%관리자만%','팀원은 교회 정보를 못 봄'),
    (3,'{s}','select count(*) from church_info','ERR:%permission%','정보 표를 직접 못 읽음'),
    (1,ca,'select church_info_set(''{a}'',''{"road":"서울 성동구 무학로 1"}'')->>''ok''','true','초기 교회는 나중에 정보를 채움'),
    (1,ca,'select church_info_get(''{a}'')->>''road''','서울 성동구 무학로 1','(채운 정보)'),
    (0,'','select free_pts::text from churches where id=''{a}''','5','나중에 채워도 처음 무료는 그대로'),
    (2,ca,'select church_info_set(''{a}'',''{"road":"서울 어딘가 1"}'')','ERR:%관리자만%','팀원은 정보를 못 고침'),
    (4,ca,'select church_info_set(''{a}'',''{"road":"서울 어딘가 1"}'')','ERR:%관리자만%','교회 번호를 속여도 못 고침'),
    -- 빠지는 순서 · 맞춤법 5:1 · 실패 돌려주기
    (1,ca,'select ai_left()->>''left''','2','A 남은 횟수 2 (매달 1 + 처음 1)'),
    (0,'','select ai_begin(''{u}1'',''{a}'',''{j}1'',''score'')->>''ok''','true','악보 1번'),
    (0,'','{pts}','5,5,0','매달 무료부터 빠짐'),
    (0,'','select ai_begin(''{u}1'',''{a}'',''{j}2'',''spell'')->>''ok''','true','맞춤법 1번'),
    (0,'','{pts}','5,4,0','다음은 처음 무료 · 맞춤법은 1점'),
    (1,ca,'select ai_left()->>''left''','0.8','남은 횟수 0.8'),
    (0,'','select ai_begin(''{u}1'',''{a}'',''{j}3'',''score'')->>''code''','charge','모자라면 충전 안내'),
    (0,'','{pts}','5,4,0','막힌 요청은 안 뺌'),
    (0,'','select ai_begin(''{u}1'',''{a}'',null,''spell'')->>''ok''','true','(맞춤법)'),
    (0,'','select ai_begin(''{u}1'',''{a}'',null,''spell'')->>''ok''','true','(맞춤법)'),
    (0,'','select ai_begin(''{u}1'',''{a}'',null,''spell'')->>''ok''','true','(맞춤법)'),
    (0,'','select ai_begin(''{u}1'',''{a}'',null,''spell'')->>''ok''','true','맞춤법 5번 = 1번'),
    (0,'','{pts}','5,0,0','(다 씀)'),
    (0,'','select ai_begin(''{u}1'',''{a}'',null,''spell'')->>''error''','이번 달 AI 1번을 다 썼어요. 다음 달 1일에 다시 되고, 지금 더 쓰려면 충전을%','매달 무료 교회는 다음 달 + 충전 안내'),
    (0,'','select ai_end(''{j}2'',false,'''',0,0)::text','%','(맞춤법 실패)'),
    (0,'','{pts}','5,1,0','실패하면 처음 무료로 돌려줌'),
    (0,'','select ai_end(''{j}1'',false,'''',0,0)::text','%','(악보 실패)'),
    (0,'','{pts}','0,1,0','실패하면 매달 무료로 돌려줌'),
    (0,'','select ai_end(''{j}1'',false,'''',0,0)::text','%','(한 번 더 끝내기)'),
    (0,'','{pts}','0,1,0','두 번 돌려주지 않음'),
    -- 신청 · 먼저 5번
    (2,ca,'select pay_request(''ai'','' '')->>''error''','%입금자%','입금자 이름이 없으면 막힘'),
    (2,ca,'select pay_request(''ai'',''김입금'')->>''ok''','true','팀원도 충전 신청'),
    (0,'','{pts}','0,1,25','신청하면 5번을 먼저 엶'),
    (1,ca,'select (ai_left()->>''paid'') || '','' || (ai_left()->>''pending'')','5,true','남은 충전 5 · 확인 중'),
    (1,ca,'select pay_request(''mb'',''김입금'')->>''error''','입금 확인 중%','처리 안 된 신청은 하나만'),
    (4,cb,'select pay_request(''ai'',''남입금'')->>''ok''','true','다른 교회는 따로 신청'),
    (4,ca,'select pay_request(''ai'',''남입금'')','ERR:%팀원만%','교회 번호를 속여도 남의 교회에 못 신청'),
    (4,cb,'select count(*) from pay_requests','ERR:%permission%','신청 표를 직접 못 읽음'),
    (4,cb,'with x as (update churches set paid_pts=99999 returning 1) select count(*) from x','ERR:%permission%','잔액을 직접 못 고침'),
    (2,ca,'select jsonb_array_length(pay_mine())::text','1','우리 교회 신청만 보임'),
    (2,ca,'select pay_mine()->0->>''payer''','김입금','(우리 것)'),
    (1,ca,'select super_pay_list()','ERR:%전체 관리자만%','교회 관리자는 신청 목록을 못 봄'),
    (0,'','select id from pay_requests where church_id=''{a}''','{save}','(A 신청 번호)'),
    (1,ca,'select super_pay_set({s},''approve'')','ERR:%전체 관리자만%','교회 관리자는 승인 못 함'),
    (-1,'','select super_pay_set({s},''approve'')','ERR:%','로그인 안 하면 승인 못 함'),
    (5,'','select (super_home()->>''pay_new'') || '','' || (super_home()->>''pay_pending'')','2,2','관리 홈: NEW 2 · 확인 중 2'),
    (5,'','select ((super_pay_list()->>''db_bytes'')::bigint > 0)::text','true','서버 전체 사용량'),
    (5,'','select (select x->>''is_new'' from jsonb_array_elements(super_pay_list()->''list'') x where x->>''id''=''{s}'')','true','새 신청은 NEW'),
    (5,'','select super_pay_seen()::text','2','(봤어요)'),
    (5,'','select (select x->>''is_new'' from jsonb_array_elements(super_pay_list()->''list'') x where x->>''id''=''{s}'')','false','보면 NEW가 꺼짐'),
    (5,'','select string_agg(k, '','' order by k) from jsonb_object_keys(super_pay_list()->''list''->0) k','amount,at,church_id,church_name,done_at,id,is_new,kind,payer,status,user_name','신청 목록은 허용 목록뿐'),
    (5,'','select super_pay_set({s},''refund'')->>''error''','승인한 신청만%','승인 전에는 환불됨 못 누름'),
    (5,'','select super_pay_set({s},''approve'')->>''ok''','true','승인'),
    (0,'','{pts}','0,1,250','승인하면 50번(먼저 연 5번 포함)'),
    (5,'','select super_pay_set({s},''approve'')->>''error''','이미 처리%','승인은 한 번만'),
    (5,'','select super_pay_set({s},''cancel'')->>''error''','이미 처리%','승인한 뒤엔 취소 못 함'),
    (0,'','{pts}','0,1,250','두 번 눌러도 그대로'),
    (5,'','select super_church(''{a}'')->''history''->0->>''what''','AI 충전 승인 (+50번) · 김입금','호감 기록에 남음'),
    (0,'','select ai_begin(''{u}1'',''{a}'',null,''score'')->>''ok''','true','(악보: 매달에서)'),
    (0,'','select ai_begin(''{u}1'',''{a}'',''{j}4'',''score'')->>''ok''','true','(악보: 처음 1점 + 충전 4점)'),
    (0,'','{pts}','5,0,246','모자라면 다음 곳에서 나눠 뺌'),
    (0,'','select ai_end(''{j}4'',false,'''',0,0)::text','%','(실패)'),
    (0,'','{pts}','5,1,250','나눠 뺀 것도 제자리로 돌려줌'),
    (0,'','with x as (update churches set paid_pts=300 where id=''{a}'' returning 1) select count(*) from x','1','(충전 60번 남은 걸로)'),
    (5,'','select super_pay_set({s},''refund'')->>''ok''','true','환불됨'),
    (0,'','{pts}','5,1,50','환불되면 50번까지만 뺌'),
    (5,'','select super_pay_set({s},''refund'')->>''error''','승인한 신청만%','환불됨은 한 번만'),
    (2,ca,'select pay_mine()->0->>''status''','refunded','교회도 환불됨을 봄'),
    -- 취소하면 먼저 연 5번을 뺌 (써 버렸으면 마이너스)
    (0,'','with x as (update churches set paid_pts=0, free_pts=0 where id=''{a}'' returning 1) select count(*) from x','1','(잔액 0으로)'),
    (2,ca,'select pay_request(''ai'',''김입금'')->>''ok''','true','다시 신청'),
    (0,'','select ai_begin(''{u}2'',''{a}'',null,''score'')->>''ok''','true','먼저 연 5번 중 1번(악보) 씀'),
    (0,'','select max(id) from pay_requests where church_id=''{a}''','{save}','(새 신청 번호)'),
    (5,'','select super_pay_set({s},''cancel'')->>''ok''','true','입금이 안 돼 취소'),
    (0,'','{pts}','5,0,-5','쓴 만큼 마이너스'),
    (1,ca,'select (ai_left()->>''paid'') || '','' || (ai_left()->>''left'')','-1,0','남은 횟수는 0으로 보임'),
    (0,'','select ai_begin(''{u}2'',''{a}'',null,''spell'')->>''code''','charge','마이너스면 못 씀'),
    (5,'','select super_pay_set({s},''approve'')->>''error''','이미 처리%','취소한 뒤엔 승인 못 함'),
    -- 용량 추가
    (1,ca,'select pay_request(''mb'',''김입금'')->>''ok''','true','용량 추가 신청'),
    (0,'','select mb_limit::text from churches where id=''{a}''','20','신청만으론 안 늘어남'),
    (0,'','select max(id) from pay_requests where church_id=''{a}''','{save}','(용량 신청 번호)'),
    (5,'','select super_pay_set({s},''approve'')->>''ok''','true','용량 승인'),
    (0,'','select mb_limit::text from churches where id=''{a}''','70','50MB 늘어남'),
    (0,'','{pts}','5,0,-5','용량은 AI 횟수와 따로'),
    (5,'','select super_pay_set({s},''refund'')->>''ok''','true','용량 환불됨'),
    (0,'','select mb_limit::text from churches where id=''{a}''','20','50MB 내려감'),
    (2,ca,'select pay_request(''zz'',''김입금'')','ERR:%종류%','이상한 신청 종류는 막힘'),
    -- 기록 보관
    (0,'','select confdeltype::text from pg_constraint where conrelid=''public.pay_requests''::regclass and conname like ''%church_id%''','n','교회가 지워져도 입금 기록은 남음'),
    (0,'','select confdeltype::text from pg_constraint where conrelid=''public.pay_requests''::regclass and conname like ''%user_id%''','n','탈퇴해도 입금 기록은 남음'),
    (0,'','with x as (update pay_requests set at=now()-interval ''5 years 1 day'' where church_id=''{b}'' returning 1) select count(*) from x','1','(5년 전으로)'),
    (0,'','select clear_old_pay()::text','%','(날마다 정리)'),
    (0,'','select count(*) from pay_requests where church_id=''{b}''','0','5년 지나면 지움'),
    (0,'','select (count(*) > 0)::text from pay_requests where church_id=''{a}''','true','5년 안 된 건 남음'),
    (0,'','select count(*) from cron.job where jobname=''hogam-clear-pay''','1','날마다 정리 예약')
  ) as x(who, church, sql, want, label) loop
    perform set_config('request.jwt.claims', case when t.who > 0 then json_build_object('sub', u || t.who, 'role', 'authenticated')::text else '' end, true);
    perform set_config('request.jwt.claim.sub', case when t.who > 0 then u || t.who else '' end, true);
    perform set_config('request.headers', json_build_object('x-church', replace(t.church, '{s}', s))::text, true);
    begin
      if t.who > 0 then set local role authenticated; elsif t.who < 0 then set local role anon; end if;
      execute replace(replace(replace(replace(replace(replace(replace(t.sql, '{pts}', pts), '{road}', road), '{a}', ca), '{b}', cb), '{u}', u), '{j}', j), '{s}', s) into got;
    exception when others then got := 'ERR:' || sqlerrm;
    end;
    reset role;
    if got in ('t','f') then got := case got when 't' then 'true' else 'false' end; end if;
    n := n + 1;
    if t.want = '{save}' then
      if got is null or got like 'ERR:%' then bad := bad || E'\n실패 · ' || t.label || ' · ' || coalesce(got, '(빈 값)'); else s := got; end if;
    elsif got is null or got not like t.want then
      if not (got is null and t.want = '%') then bad := bad || E'\n실패 · ' || t.label || ' · ' || coalesce(got, '(빈 값)'); end if;
    end if;
  end loop;
  if bad <> '' then raise exception '%', bad; end if;
  raise exception '모두 통과 %개 (일부러 낸 오류예요. 시험 자료는 되돌렸어요)', n;
end $$;
